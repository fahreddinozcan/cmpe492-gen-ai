import requests
import time
import matplotlib.pyplot as plt
import numpy as np
import json
import os
import asyncio
import aiohttp
from datetime import datetime
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Configuration
MAX_CONCURRENT_REQUESTS = 7  # Maximum number of concurrent requests
STEP_SIZE = 1  # Increase concurrent requests by this amount each step
REQUESTS_PER_STEP = 20  # Increased for better statistical significance
TEST_PROMPT = "How can I improve my productivity?"
FLASK_ENDPOINT = "http://35.193.232.83:8000/generate"
VDEPLOY_ENDPOINT = (
    "http://34.55.97.136/v1/completions"  # Replace with your vDeploy endpoint
)

# Create results directory if it doesn't exist
results_dir = "benchmark_results"
os.makedirs(results_dir, exist_ok=True)

# Timestamp for this benchmark run
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


class RequestTimer:
    """Context manager for timing requests"""

    def __init__(self):
        self.start_time = None
        self.end_time = None

    def __enter__(self):
        self.start_time = time.perf_counter()
        return self

    def __exit__(self, *args):
        self.end_time = time.perf_counter()

    @property
    def elapsed(self):
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return None


def make_flask_request(session=None):
    """Make a request to the Flask server and measure latency"""
    if session is None:
        session = requests.Session()

    with RequestTimer() as timer:
        try:
            response = session.post(
                FLASK_ENDPOINT,
                headers={"Content-Type": "application/json"},
                json={"prompt": TEST_PROMPT},
                timeout=200,
            )

            if response.status_code != 200:
                print(
                    f"Error with Flask request: {response.status_code} - {response.text}"
                )
                return None

            # For fair comparison, we should consume the entire response
            _ = response.text

        except Exception as e:
            print(f"Exception during Flask request: {e}")
            return None

    return timer.elapsed


def make_vdeploy_request(session=None):
    """Make a request to the vDeploy server and measure latency"""
    if session is None:
        session = requests.Session()

    with RequestTimer() as timer:
        try:
            response = session.post(
                VDEPLOY_ENDPOINT,
                headers={"Content-Type": "application/json"},
                json={
                    "model": "google/gemma-1.1-2b-it",
                    "prompt": TEST_PROMPT,
                    "max_tokens": 100,
                    "stream": False,  # Changed to False for fair comparison
                },
                timeout=30,
            )

            if response.status_code != 200:
                print(
                    f"Error with vDeploy request: {response.status_code} - {response.text}"
                )
                return None

            # Consume the entire response for fair comparison
            _ = response.text

        except Exception as e:
            print(f"Exception during vDeploy request: {e}")
            return None

    return timer.elapsed


def run_concurrent_requests_improved(endpoint_type, concurrency, num_requests):
    """
    Improved concurrent request handling that maintains true concurrency levels
    """
    latencies = []
    request_func = (
        make_flask_request if endpoint_type == "flask" else make_vdeploy_request
    )

    # Create a session pool to reuse connections
    sessions = [requests.Session() for _ in range(concurrency)]

    # Calculate how many batches we need
    batches = []
    remaining_requests = num_requests

    while remaining_requests > 0:
        batch_size = min(concurrency, remaining_requests)
        batches.append(batch_size)
        remaining_requests -= batch_size

    print(f"Running {len(batches)} batches with concurrency {concurrency}")

    for batch_idx, batch_size in enumerate(batches):
        print(f"  Batch {batch_idx + 1}/{len(batches)}: {batch_size} requests")

        with ThreadPoolExecutor(max_workers=batch_size) as executor:
            # Submit exactly batch_size requests
            futures = []
            for i in range(batch_size):
                session = sessions[i % len(sessions)]
                future = executor.submit(request_func, session)
                futures.append(future)

            # Collect results
            batch_latencies = []
            for future in as_completed(futures):
                try:
                    latency = future.result()
                    if latency is not None:
                        batch_latencies.append(latency)
                        print(f"    Request completed in {latency:.4f} seconds")
                except Exception as e:
                    print(f"    Request generated an exception: {e}")

            latencies.extend(batch_latencies)

            # Small delay between batches to avoid overwhelming the server
            if batch_idx < len(batches) - 1:
                time.sleep(0.1)

    # Clean up sessions
    for session in sessions:
        session.close()

    return latencies


def calculate_advanced_metrics(latencies):
    """Calculate comprehensive latency metrics"""
    if not latencies:
        return {}

    return {
        "count": len(latencies),
        "mean": statistics.mean(latencies),
        "median": statistics.median(latencies),
        "stdev": statistics.stdev(latencies) if len(latencies) > 1 else 0,
        "min": min(latencies),
        "max": max(latencies),
        "p50": np.percentile(latencies, 50),
        "p90": np.percentile(latencies, 90),
        "p95": np.percentile(latencies, 95),
        "p99": np.percentile(latencies, 99),
    }


def run_load_test(endpoint_type):
    """Run load test with increasing concurrency"""
    results = {
        "endpoint_type": endpoint_type,
        "timestamp": timestamp,
        "concurrency_levels": [],
        "raw_latencies": [],
        "metrics": [],
    }

    print(f"\nStarting load test for {endpoint_type}...")
    print(f"Testing concurrency levels 1 to {MAX_CONCURRENT_REQUESTS}")
    print(f"Making {REQUESTS_PER_STEP} requests per concurrency level")

    for concurrency in range(1, MAX_CONCURRENT_REQUESTS + 1, STEP_SIZE):
        print(f"\n{'='*50}")
        print(f"Testing concurrency level: {concurrency}")
        print(f"{'='*50}")

        latencies = run_concurrent_requests_improved(
            endpoint_type, concurrency, REQUESTS_PER_STEP
        )

        if latencies:
            metrics = calculate_advanced_metrics(latencies)

            results["concurrency_levels"].append(concurrency)
            results["raw_latencies"].append(latencies)
            results["metrics"].append(metrics)

            print(f"\nResults for concurrency {concurrency}:")
            print(f"  Successful requests: {metrics['count']}/{REQUESTS_PER_STEP}")
            print(f"  Mean latency: {metrics['mean']:.4f}s")
            print(f"  Median latency: {metrics['median']:.4f}s")
            print(f"  Std deviation: {metrics['stdev']:.4f}s")
            print(f"  Min/Max: {metrics['min']:.4f}s / {metrics['max']:.4f}s")
            print(
                f"  P90/P95/P99: {metrics['p90']:.4f}s / {metrics['p95']:.4f}s / {metrics['p99']:.4f}s"
            )

            # Calculate success rate
            success_rate = metrics["count"] / REQUESTS_PER_STEP * 100
            print(f"  Success rate: {success_rate:.1f}%")

            if success_rate < 80:
                print(
                    f"  WARNING: Low success rate ({success_rate:.1f}%). Service may be overloaded."
                )

        else:
            print(
                f"No valid latencies for concurrency level {concurrency}. Service may be overloaded."
            )
            # Continue testing even if some requests fail
            results["concurrency_levels"].append(concurrency)
            results["raw_latencies"].append([])
            results["metrics"].append({})

    # Save results to file
    results_file = f"{results_dir}/{endpoint_type}_load_test_{timestamp}.json"
    with open(results_file, "w") as f:
        json.dump(results, f, indent=2, default=str)

    print(f"\n{endpoint_type} load test results saved to {results_file}")
    return results


def create_comprehensive_visualization(results, save_only=False):
    """Create comprehensive visualization with multiple metrics"""
    endpoint_type = results["endpoint_type"]
    concurrency_levels = results["concurrency_levels"]
    metrics = results["metrics"]

    # Extract data for plotting
    valid_indices = [i for i, m in enumerate(metrics) if m and "mean" in m]

    if not valid_indices:
        print(f"No valid data to plot for {endpoint_type}")
        return

    valid_concurrency = [concurrency_levels[i] for i in valid_indices]
    mean_latencies = [metrics[i]["mean"] for i in valid_indices]
    p95_latencies = [metrics[i]["p95"] for i in valid_indices]
    p99_latencies = [metrics[i]["p99"] for i in valid_indices]
    min_latencies = [metrics[i]["min"] for i in valid_indices]
    max_latencies = [metrics[i]["max"] for i in valid_indices]

    # Create subplot figure
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))

    color = "#3498db" if endpoint_type == "flask" else "#2ecc71"

    # Plot 1: Mean latency
    ax1.plot(
        valid_concurrency,
        mean_latencies,
        marker="o",
        linestyle="-",
        linewidth=2,
        color=color,
        label="Mean",
    )
    ax1.set_xlabel("Concurrent Requests")
    ax1.set_ylabel("Latency (seconds)")
    ax1.set_title(f"Mean Latency - {endpoint_type.capitalize()}")
    ax1.grid(True, linestyle="--", alpha=0.7)

    # Plot 2: Percentile comparison
    ax2.plot(
        valid_concurrency,
        mean_latencies,
        marker="o",
        linestyle="-",
        linewidth=2,
        color=color,
        label="Mean",
    )
    ax2.plot(
        valid_concurrency,
        p95_latencies,
        marker="s",
        linestyle="--",
        linewidth=2,
        color=color,
        alpha=0.7,
        label="P95",
    )
    ax2.plot(
        valid_concurrency,
        p99_latencies,
        marker="^",
        linestyle=":",
        linewidth=2,
        color=color,
        alpha=0.5,
        label="P99",
    )
    ax2.set_xlabel("Concurrent Requests")
    ax2.set_ylabel("Latency (seconds)")
    ax2.set_title(f"Latency Percentiles - {endpoint_type.capitalize()}")
    ax2.legend()
    ax2.grid(True, linestyle="--", alpha=0.7)

    # Plot 3: Min/Max range
    ax3.fill_between(
        valid_concurrency,
        min_latencies,
        max_latencies,
        alpha=0.3,
        color=color,
        label="Min-Max Range",
    )
    ax3.plot(
        valid_concurrency,
        mean_latencies,
        marker="o",
        linestyle="-",
        linewidth=2,
        color=color,
        label="Mean",
    )
    ax3.set_xlabel("Concurrent Requests")
    ax3.set_ylabel("Latency (seconds)")
    ax3.set_title(f"Latency Range - {endpoint_type.capitalize()}")
    ax3.legend()
    ax3.grid(True, linestyle="--", alpha=0.7)

    # Plot 4: Success rate
    success_rates = [
        (metrics[i]["count"] / REQUESTS_PER_STEP * 100) for i in valid_indices
    ]
    ax4.bar(valid_concurrency, success_rates, color=color, alpha=0.7)
    ax4.set_xlabel("Concurrent Requests")
    ax4.set_ylabel("Success Rate (%)")
    ax4.set_title(f"Success Rate - {endpoint_type.capitalize()}")
    ax4.set_ylim(0, 105)
    ax4.grid(True, linestyle="--", alpha=0.7)

    plt.tight_layout()

    # Save figure
    fig_path = f"{results_dir}/{endpoint_type}_comprehensive_{timestamp}.png"
    plt.savefig(fig_path, dpi=300, bbox_inches="tight")
    print(f"{endpoint_type} comprehensive visualization saved to {fig_path}")

    if not save_only:
        plt.show()

    plt.close()


def create_comparison_visualization(flask_results, vdeploy_results, save_only=False):
    """Create side-by-side comparison of both systems"""
    # Extract valid data from both results
    flask_metrics = flask_results["metrics"]
    vdeploy_metrics = vdeploy_results["metrics"]

    flask_valid = [i for i, m in enumerate(flask_metrics) if m and "mean" in m]
    vdeploy_valid = [i for i, m in enumerate(vdeploy_metrics) if m and "mean" in m]

    if not flask_valid or not vdeploy_valid:
        print("Insufficient data for comparison")
        return

    flask_concurrency = [flask_results["concurrency_levels"][i] for i in flask_valid]
    vdeploy_concurrency = [
        vdeploy_results["concurrency_levels"][i] for i in vdeploy_valid
    ]

    flask_mean = [flask_metrics[i]["mean"] for i in flask_valid]
    vdeploy_mean = [vdeploy_metrics[i]["mean"] for i in vdeploy_valid]

    flask_p95 = [flask_metrics[i]["p95"] for i in flask_valid]
    vdeploy_p95 = [vdeploy_metrics[i]["p95"] for i in vdeploy_valid]

    # Create comparison plot
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))

    # Mean latency comparison
    ax1.plot(
        flask_concurrency,
        flask_mean,
        marker="o",
        linestyle="-",
        linewidth=2,
        color="#3498db",
        label="Flask",
    )
    ax1.plot(
        vdeploy_concurrency,
        vdeploy_mean,
        marker="s",
        linestyle="-",
        linewidth=2,
        color="#2ecc71",
        label="vDeploy",
    )
    ax1.set_xlabel("Concurrent Requests")
    ax1.set_ylabel("Mean Latency (seconds)")
    ax1.set_title("Mean Latency Comparison")
    ax1.legend()
    ax1.grid(True, linestyle="--", alpha=0.7)

    # P95 latency comparison
    ax2.plot(
        flask_concurrency,
        flask_p95,
        marker="o",
        linestyle="-",
        linewidth=2,
        color="#3498db",
        label="Flask",
    )
    ax2.plot(
        vdeploy_concurrency,
        vdeploy_p95,
        marker="s",
        linestyle="-",
        linewidth=2,
        color="#2ecc71",
        label="vDeploy",
    )
    ax2.set_xlabel("Concurrent Requests")
    ax2.set_ylabel("P95 Latency (seconds)")
    ax2.set_title("P95 Latency Comparison")
    ax2.legend()
    ax2.grid(True, linestyle="--", alpha=0.7)

    plt.tight_layout()

    # Save figure
    fig_path = f"{results_dir}/comparison_{timestamp}.png"
    plt.savefig(fig_path, dpi=300, bbox_inches="tight")
    print(f"Comparison visualization saved to {fig_path}")

    if not save_only:
        plt.show()

    plt.close()


if __name__ == "__main__":
    print("Improved Load Test Benchmark Tool for Flask vs. vDeploy Comparison")
    print("================================================================")
    print("1. Run Flask load test")
    print("2. Run vDeploy load test")
    print("3. Run both tests sequentially")
    print("4. Load existing results and create visualizations")
    print("5. Exit")

    choice = input("\nEnter your choice (1-5): ")

    if choice == "1":
        flask_results = run_load_test("flask")
        if flask_results and any(flask_results["metrics"]):
            create_comprehensive_visualization(flask_results)

    elif choice == "2":
        vdeploy_results = run_load_test("vdeploy")
        if vdeploy_results and any(vdeploy_results["metrics"]):
            create_comprehensive_visualization(vdeploy_results)

    elif choice == "3":
        print("Running both tests sequentially...")
        flask_results = run_load_test("flask")
        print("\n" + "=" * 80 + "\n")
        vdeploy_results = run_load_test("vdeploy")

        # Create individual visualizations
        if flask_results and any(flask_results["metrics"]):
            create_comprehensive_visualization(flask_results, save_only=True)
        if vdeploy_results and any(vdeploy_results["metrics"]):
            create_comprehensive_visualization(vdeploy_results, save_only=True)

        # Create comparison if both succeeded
        if (
            flask_results
            and any(flask_results["metrics"])
            and vdeploy_results
            and any(vdeploy_results["metrics"])
        ):
            create_comparison_visualization(flask_results, vdeploy_results)

    elif choice == "4":
        # Load and visualize existing results
        load_test_files = [
            f for f in os.listdir(results_dir) if f.endswith("_load_test_*.json")
        ]

        if not load_test_files:
            print("No existing results found.")
        else:
            print("Available result files:")
            for i, file in enumerate(load_test_files):
                print(f"{i+1}. {file}")

            selection = input(
                "Enter file number to visualize (or 'all' for comparison): "
            )

            if selection.lower() == "all":
                # Try to find Flask and vDeploy results for comparison
                flask_file = next((f for f in load_test_files if "flask" in f), None)
                vdeploy_file = next(
                    (f for f in load_test_files if "vdeploy" in f), None
                )

                if flask_file and vdeploy_file:
                    with open(f"{results_dir}/{flask_file}", "r") as f:
                        flask_results = json.load(f)
                    with open(f"{results_dir}/{vdeploy_file}", "r") as f:
                        vdeploy_results = json.load(f)

                    create_comparison_visualization(flask_results, vdeploy_results)
                else:
                    print(
                        "Could not find both Flask and vDeploy results for comparison."
                    )
            else:
                try:
                    idx = int(selection) - 1
                    if 0 <= idx < len(load_test_files):
                        with open(f"{results_dir}/{load_test_files[idx]}", "r") as f:
                            results = json.load(f)
                        create_comprehensive_visualization(results)
                    else:
                        print("Invalid selection.")
                except ValueError:
                    print("Invalid input.")

    elif choice == "5":
        print("Exiting...")
    else:
        print("Invalid choice. Exiting...")
