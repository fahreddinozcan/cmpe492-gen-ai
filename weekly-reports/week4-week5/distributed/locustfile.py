# locustfile.py
import time
import json
import statistics
from locust import HttpUser, task, between, events
import numpy as np
import os
import datetime
import csv

# Test prompts of varying lengths
TEST_PROMPTS_SHORT = [
    "What is Python?",
    "Define HTML.",
    "Who created Linux?",
    "What is an API?",
    "Explain DNS.",
]

TEST_PROMPTS_MEDIUM = [
    "Explain quantum computing in 200 words.",
    "Compare and contrast REST and GraphQL APIs.",
    "What are the key principles of object-oriented programming?",
    "Describe the differences between SQL and NoSQL databases.",
    "Explain how containerization improves application deployment.",
]

TEST_PROMPTS_LONG = [
    "Write a detailed essay about the ethical implications of artificial intelligence in modern society.",
    "Explain how neural networks work from basic principles to advanced applications in depth.",
    "Provide a comprehensive overview of cloud computing architectures, services, and best practices.",
    "Describe the evolution of programming languages from assembly to modern languages, highlighting key innovations.",
    "Analyze the future of cybersecurity challenges and potential solutions over the next decade.",
]

# Get test configuration from environment variables
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 32))
USER_COUNT = int(os.environ.get("USER_COUNT", 10))
TEST_PHASE = os.environ.get("TEST_PHASE", "baseline")
TEST_DURATION = int(os.environ.get("TEST_DURATION", 120))
MODEL_NAME = os.environ.get("MODEL_NAME", "unknown")
PROMPT_TYPE = os.environ.get("PROMPT_TYPE", "mixed")
MAX_TOKENS = 256

# CSV file for detailed metrics
TIMESTAMP = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
METRICS_CSV_FILE = f"vllm_metrics_{TEST_PHASE}_{TIMESTAMP}.csv"

# Create CSV file with headers
with open(METRICS_CSV_FILE, "w", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(
        [
            "timestamp",
            "phase",
            "model",
            "batch_size",
            "users",
            "ttft",
            "tpot",
            "request_time",
            "tokens_generated",
            "concurrent_users",
            "is_streaming",
            "prompt_type",
        ]
    )

# Store metrics for analysis
metrics_store = {
    "ttft": [],  # Time to first token
    "tpot": [],  # Tokens per output time
    "request_time": [],  # Total request time
    "tokens_generated": [],  # Number of tokens in response
    "concurrent_users": [],  # Number of concurrent users
    "timestamps": [],  # Timestamps for each request
    "is_streaming": [],  # Whether the request was streaming or not
}


def save_metrics_to_csv(
    timestamp,
    phase,
    model,
    batch_size,
    users,
    ttft,
    tpot,
    request_time,
    tokens_generated,
    concurrent_users,
    is_streaming,
    prompt_type,
):
    """Save detailed metrics to CSV file"""
    with open(METRICS_CSV_FILE, "a", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(
            [
                timestamp,
                phase,
                model,
                batch_size,
                users,
                ttft,
                tpot,
                request_time,
                tokens_generated,
                concurrent_users,
                is_streaming,
                prompt_type,
            ]
        )


class VLLMUser(HttpUser):
    wait_time = between(0.5, 2)  # Default wait time between requests

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.prompt_type = PROMPT_TYPE

    def on_start(self):
        # Record number of concurrent users for analysis
        metrics_store["concurrent_users"].append(self.environment.runner.user_count)

    def get_prompt(self):
        """Select prompt based on current test configuration"""
        if self.prompt_type == "short":
            return np.random.choice(TEST_PROMPTS_SHORT)
        elif self.prompt_type == "medium":
            return np.random.choice(TEST_PROMPTS_MEDIUM)
        elif self.prompt_type == "long":
            return np.random.choice(TEST_PROMPTS_LONG)
        else:  # mixed - select from all prompt types
            all_prompts = TEST_PROMPTS_SHORT + TEST_PROMPTS_MEDIUM + TEST_PROMPTS_LONG
            return np.random.choice(all_prompts)

    @task(3)  # Higher weight for streaming API
    def test_openai_chat_api_streaming(self):
        prompt = self.get_prompt()

        current_timestamp = time.time()
        metrics_store["timestamps"].append(current_timestamp)
        metrics_store["is_streaming"].append(True)

        # Prepare request payload for OpenAI-compatible chat API
        payload = {
            "model": MODEL_NAME,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "top_p": 1.0,
            "max_tokens": MAX_TOKENS,
            "stream": True,
        }

        start_time = time.time()
        first_token_time = None

        with self.client.post(
            "/v1/chat/completions",
            json=payload,
            name=f"Streaming API - {TEST_PHASE}",
            stream=True,
            catch_response=True,
            timeout=60,
        ) as response:
            if response.status_code != 200:
                response.failure(f"Failed with status code: {response.status_code}")
                return

            full_text = ""
            token_stream_started = False

            try:
                for line in response.iter_lines():
                    if line:
                        # Skip the "data: " prefix if present
                        line_str = line.decode("utf-8")
                        if line_str.startswith("data: "):
                            line_str = line_str[6:]

                        # Skip "[DONE]" message
                        if line_str == "[DONE]":
                            continue

                        try:
                            chunk_data = json.loads(line_str)
                            if not token_stream_started:
                                first_token_time = time.time()
                                token_stream_started = True

                            if (
                                "choices" in chunk_data
                                and len(chunk_data["choices"]) > 0
                            ):
                                if (
                                    "delta" in chunk_data["choices"][0]
                                    and "content" in chunk_data["choices"][0]["delta"]
                                ):
                                    full_text += chunk_data["choices"][0]["delta"][
                                        "content"
                                    ]
                        except json.JSONDecodeError:
                            # Some lines might not be valid JSON
                            pass
            except Exception as e:
                response.failure(f"Streaming error: {str(e)}")
                return

            end_time = time.time()

            # Calculate metrics
            if first_token_time:
                ttft = first_token_time - start_time
                total_time = end_time - start_time
                generation_time = end_time - first_token_time

                # Estimate token count from words
                token_count = len(full_text.split())
                tpot = token_count / generation_time if generation_time > 0 else 0

                # Record metrics
                metrics_store["ttft"].append(ttft)
                metrics_store["tpot"].append(tpot)
                metrics_store["request_time"].append(total_time)
                metrics_store["tokens_generated"].append(token_count)

                # Save detailed metrics to CSV
                save_metrics_to_csv(
                    current_timestamp,
                    TEST_PHASE,
                    MODEL_NAME,
                    BATCH_SIZE,
                    USER_COUNT,
                    ttft,
                    tpot,
                    total_time,
                    token_count,
                    self.environment.runner.user_count,
                    True,
                    PROMPT_TYPE,
                )

                # Report custom metrics to Locust
                events.request.fire(
                    request_type="TTFT",
                    name=f"TTFT - {TEST_PHASE}",
                    response_time=ttft * 1000,  # Convert to milliseconds
                    response_length=0,
                    exception=None,
                )

                events.request.fire(
                    request_type="TPOT",
                    name=f"TPOT - {TEST_PHASE}",
                    response_time=tpot,
                    response_length=token_count,
                    exception=None,
                )

    @task(1)  # Lower weight for non-streaming API
    def test_openai_chat_api_nonstreaming(self):
        prompt = self.get_prompt()

        current_timestamp = time.time()
        metrics_store["timestamps"].append(current_timestamp)
        metrics_store["is_streaming"].append(False)

        # Prepare request payload for OpenAI-compatible chat API
        payload = {
            "model": MODEL_NAME,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "top_p": 1.0,
            "max_tokens": MAX_TOKENS,
            "stream": False,
        }

        start_time = time.time()

        with self.client.post(
            "/v1/chat/completions",
            json=payload,
            name=f"Non-Streaming API - {TEST_PHASE}",
            catch_response=True,
            timeout=60,
        ) as response:
            end_time = time.time()

            if response.status_code != 200:
                response.failure(f"Failed with status code: {response.status_code}")
                return

            try:
                response_data = response.json()

                # Extract token counts from the API response
                if "usage" in response_data:
                    prompt_tokens = response_data["usage"].get("prompt_tokens", 0)
                    completion_tokens = response_data["usage"].get(
                        "completion_tokens", 0
                    )
                    total_tokens = response_data["usage"].get("total_tokens", 0)

                    # Calculate metrics
                    total_time = end_time - start_time

                    # For non-streaming, estimate TTFT based on token ratio
                    if total_tokens > 0:
                        estimated_ttft = total_time * (prompt_tokens / total_tokens)
                        ttft = min(max(estimated_ttft, 0.05), total_time * 0.5)
                    else:
                        ttft = total_time * 0.1  # Fallback estimate

                    generation_time = total_time - ttft
                    tpot = (
                        completion_tokens / generation_time
                        if generation_time > 0
                        else 0
                    )

                    # Record metrics
                    metrics_store["ttft"].append(ttft)
                    metrics_store["tpot"].append(tpot)
                    metrics_store["request_time"].append(total_time)
                    metrics_store["tokens_generated"].append(completion_tokens)

                    # Save detailed metrics to CSV
                    save_metrics_to_csv(
                        current_timestamp,
                        TEST_PHASE,
                        MODEL_NAME,
                        BATCH_SIZE,
                        USER_COUNT,
                        ttft,
                        tpot,
                        total_time,
                        completion_tokens,
                        self.environment.runner.user_count,
                        False,
                        PROMPT_TYPE,
                    )

                    # Report custom metrics to Locust
                    events.request.fire(
                        request_type="TTFT",
                        name=f"TTFT - {TEST_PHASE}",
                        response_time=ttft * 1000,  # Convert to milliseconds
                        response_length=0,
                        exception=None,
                    )

                    events.request.fire(
                        request_type="TPOT",
                        name=f"TPOT - {TEST_PHASE}",
                        response_time=tpot,
                        response_length=completion_tokens,
                        exception=None,
                    )
            except Exception as e:
                response.failure(f"Failed to parse response: {str(e)}")
