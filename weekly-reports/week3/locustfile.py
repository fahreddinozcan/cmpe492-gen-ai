import time
import json
import statistics
from locust import HttpUser, task, between, events
import numpy as np
import os
import datetime
import csv

# ==================================================================
# MANUAL CONFIGURATION - ADJUST THESE SETTINGS
# ==================================================================
# Model and endpoint configuration
OPENAI_CHAT_API_URL = "/v1/chat/completions"
MODEL_NAME = "google/gemma-1.1-2b-it"  # Replace with your model


BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 4))
USER_COUNT = int(os.environ.get("USER_COUNT", 10))
TEST_PHASE = os.environ.get("TEST_PHASE", "baseline")
TEST_DURATION = int(os.environ.get("TEST_DURATION", 60))


SAVE_RESULTS = True  # Whether to save results to a file
PROMPT_TYPE = "mixed"  # One of: "short", "medium", "long", or "mixed"

# Maximum tokens to generate in each response
MAX_TOKENS = 256

# Test duration in seconds - the test will keep running until manually stopped
# but this helps with proper labeling in result files


# ==================================================================
# END OF CONFIGURATION
# ==================================================================

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

# Generate current timestamp for filenames
TIMESTAMP = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
# Create a unique test ID based on configuration
TEST_ID = f"batch{BATCH_SIZE}_users{USER_COUNT}_{TEST_PHASE}_{TIMESTAMP}"

# CSV file for detailed metrics
METRICS_CSV_FILE = f"vllm_metrics_{TEST_ID}.csv"

# Create CSV file with headers
with open(METRICS_CSV_FILE, "w", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(
        [
            "timestamp",
            "phase",
            "batch_size",
            "users",
            "ttft",
            "tpot",
            "request_time",
            "tokens_generated",
            "concurrent_users",
            "is_streaming",
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

# Set global test start time
test_start_time = None


def save_metrics_to_csv(
    timestamp,
    phase,
    batch_size,
    users,
    ttft,
    tpot,
    request_time,
    tokens_generated,
    concurrent_users,
    is_streaming,
):
    """Save detailed metrics to CSV file"""
    with open(METRICS_CSV_FILE, "a", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(
            [
                timestamp,
                phase,
                batch_size,
                users,
                ttft,
                tpot,
                request_time,
                tokens_generated,
                concurrent_users,
                is_streaming,
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
            OPENAI_CHAT_API_URL,
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
                    BATCH_SIZE,
                    USER_COUNT,
                    ttft,
                    tpot,
                    total_time,
                    token_count,
                    self.environment.runner.user_count,
                    True,
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
            OPENAI_CHAT_API_URL,
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
                        BATCH_SIZE,
                        USER_COUNT,
                        ttft,
                        tpot,
                        total_time,
                        completion_tokens,
                        self.environment.runner.user_count,
                        False,
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


def analyze_metrics():
    """Analyze all collected metrics"""
    if not metrics_store["ttft"]:
        return None

    ttft_values = metrics_store["ttft"]
    tpot_values = metrics_store["tpot"]
    latency_values = metrics_store["request_time"]
    tokens_generated = metrics_store["tokens_generated"]

    # Calculate time span for QPS
    if len(metrics_store["timestamps"]) < 2:
        qps = 0
    else:
        time_span = max(metrics_store["timestamps"]) - min(metrics_store["timestamps"])
        qps = len(ttft_values) / time_span if time_span > 0 else 0

    # Calculate p99 latency
    latency_p99 = np.percentile(latency_values, 99) if len(latency_values) > 1 else 0

    # Calculate max QPS in 10-second windows
    if len(metrics_store["timestamps"]) > 2:
        timestamps = np.array(metrics_store["timestamps"])
        window_size = 10  # 10-second window
        max_qps_window = 0

        for start_time in np.arange(min(timestamps), max(timestamps), window_size / 2):
            end_time = start_time + window_size
            requests_in_window = sum(
                (timestamps >= start_time) & (timestamps < end_time)
            )
            window_qps = requests_in_window / window_size
            max_qps_window = max(max_qps_window, window_qps)
    else:
        max_qps_window = qps

    return {
        "ttft_avg": statistics.mean(ttft_values) if ttft_values else 0,
        "ttft_p95": np.percentile(ttft_values, 95) if len(ttft_values) > 1 else 0,
        "tpot_avg": statistics.mean(tpot_values) if tpot_values else 0,
        "latency_avg": statistics.mean(latency_values) if latency_values else 0,
        "latency_p95": (
            np.percentile(latency_values, 95) if len(latency_values) > 1 else 0
        ),
        "latency_p99": latency_p99,
        "requests": len(ttft_values),
        "qps": qps,
        "max_qps_window": max_qps_window,
        "tokens_generated": sum(tokens_generated),
    }


@events.init.add_listener
def on_locust_init(environment, **kwargs):
    global test_start_time
    test_start_time = time.time()

    # Set user count in the environment
    if environment.runner:
        environment.runner.target_user_count = USER_COUNT

    print("\n" + "=" * 80)
    print(f"vLLM MANUAL LOAD TEST STARTING")
    print(f"Model: {MODEL_NAME}")
    print(f"Batch Size: {BATCH_SIZE}")
    print(f"Users: {USER_COUNT}")
    print(f"Test Phase: {TEST_PHASE}")
    print(f"Prompt Type: {PROMPT_TYPE}")
    print(f"Test Duration: {TEST_DURATION} seconds")
    print(f"Metrics CSV: {METRICS_CSV_FILE}")
    print("=" * 80 + "\n")

    # Print reminder about env variable for batch size
    print("IMPORTANT: Make sure to set the vLLM server batch size with:")
    print(f"export VLLM_WORKER_MAX_BATCH_SIZE={BATCH_SIZE}")
    print("before starting the vLLM server\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Save results when test stops"""
    if not metrics_store["ttft"]:
        print("No data collected during the test")
        return

    # Calculate overall results
    results = analyze_metrics()

    if not results:
        print("No data available for analysis")
        return

    # Display summary results
    print("\n" + "=" * 100)
    print("vLLM LOAD TEST RESULTS")
    print("=" * 100)

    # Test information
    total_duration = (time.time() - test_start_time) / 60
    print(f"Test Duration: {total_duration:.1f} minutes")
    print(f"Model: {MODEL_NAME}")
    print(f"Batch Size: {BATCH_SIZE}")
    print(f"Users: {USER_COUNT}")
    print(f"Test Phase: {TEST_PHASE}")
    print(f"Prompt Type: {PROMPT_TYPE}")
    print(f"Total Requests: {results['requests']}")
    print(f"Total Tokens Generated: {results['tokens_generated']}")

    # Performance metrics
    print("\nPERFORMANCE METRICS:")
    print(f"QPS: {results['qps']:.2f} requests/second")
    print(f"Max QPS (10s window): {results['max_qps_window']:.2f} requests/second")
    print(f"Avg TTFT: {results['ttft_avg']*1000:.1f}ms")
    print(f"P95 TTFT: {results['ttft_p95']*1000:.1f}ms")
    print(f"Avg TPOT: {results['tpot_avg']:.2f} tokens/second")
    print(f"Avg Latency: {results['latency_avg']*1000:.1f}ms")
    print(f"P95 Latency: {results['latency_p95']*1000:.1f}ms")
    print(f"P99 Latency: {results['latency_p99']*1000:.1f}ms")

    # Save results to file if requested
    if SAVE_RESULTS:
        os.makedirs("vllm_test_results", exist_ok=True)
        results_file = f"vllm_test_results/results_{TEST_ID}.txt"

        with open(results_file, "w") as f:
            f.write(f"vLLM Load Test Results - {datetime.datetime.now()}\n")
            f.write(f"Model: {MODEL_NAME}\n")
            f.write(f"Batch Size: {BATCH_SIZE}\n")
            f.write(f"Users: {USER_COUNT}\n")
            f.write(f"Test Phase: {TEST_PHASE}\n")
            f.write(f"Prompt Type: {PROMPT_TYPE}\n")
            f.write("=" * 80 + "\n\n")

            f.write("TEST RESULTS\n")
            f.write("=" * 40 + "\n\n")
            f.write(f"Test Duration: {total_duration:.1f} minutes\n")
            f.write(f"Total Requests: {results['requests']}\n")
            f.write(f"Total Tokens Generated: {results['tokens_generated']}\n\n")

            f.write("PERFORMANCE METRICS\n")
            f.write("=" * 40 + "\n\n")
            f.write(f"QPS: {results['qps']:.2f} requests/second\n")
            f.write(
                f"Max QPS (10s window): {results['max_qps_window']:.2f} requests/second\n"
            )
            f.write(f"Avg TTFT: {results['ttft_avg']*1000:.1f}ms\n")
            f.write(f"P95 TTFT: {results['ttft_p95']*1000:.1f}ms\n")
            f.write(f"Avg TPOT: {results['tpot_avg']:.2f} tokens/second\n")
            f.write(f"Avg Latency: {results['latency_avg']*1000:.1f}ms\n")
            f.write(f"P95 Latency: {results['latency_p95']*1000:.1f}ms\n")
            f.write(f"P99 Latency: {results['latency_p99']*1000:.1f}ms\n")

        print(f"\nResults saved to {results_file}")

    print(f"\nDetailed metrics saved to {METRICS_CSV_FILE}")
    print(
        "\nTest completed. You can now run another test with different batch size and user count."
    )
