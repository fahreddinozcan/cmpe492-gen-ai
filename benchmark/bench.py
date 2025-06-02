import json
import matplotlib.pyplot as plt
import os
from datetime import datetime


def load_benchmark_results(flask_file, vdeploy_file):
    """Load benchmark results from JSON files"""

    # Load Flask results
    with open(flask_file, "r") as f:
        flask_data = json.load(f)

    # Load vDeploy results
    with open(vdeploy_file, "r") as f:
        vdeploy_data = json.load(f)

    return flask_data, vdeploy_data


def extract_mean_latencies(results):
    """Extract concurrency levels and mean latencies from results"""
    concurrency_levels = []
    mean_latencies = []

    metrics = results["metrics"]

    for i, metric in enumerate(metrics):
        if metric and "mean" in metric:
            concurrency_levels.append(results["concurrency_levels"][i])
            mean_latencies.append(metric["mean"])

    return concurrency_levels, mean_latencies


def create_mean_comparison_chart(
    flask_data, vdeploy_data, save_path="comparison_mean_latency.png"
):
    """Create a single chart comparing mean latencies"""

    # Extract data
    flask_concurrency, flask_means = extract_mean_latencies(flask_data)
    vdeploy_concurrency, vdeploy_means = extract_mean_latencies(vdeploy_data)

    # Create the plot
    plt.figure(figsize=(12, 8))

    # Plot Flask data
    plt.plot(
        flask_concurrency,
        flask_means,
        marker="o",
        linestyle="-",
        linewidth=3,
        markersize=8,
        color="#e74c3c",
        label="Simple Inference Engine",
        alpha=0.8,
    )

    # Plot vDeploy data
    plt.plot(
        vdeploy_concurrency,
        vdeploy_means,
        marker="s",
        linestyle="-",
        linewidth=3,
        markersize=8,
        color="#2ecc71",
        label="vDeploy with vLLM",
        alpha=0.8,
    )

    # Customize the plot
    plt.xlabel("Concurrent Requests", fontsize=14, fontweight="bold")
    plt.ylabel("Mean Latency (seconds)", fontsize=14, fontweight="bold")
    plt.title(
        "Mean Latency Comparison at Different Concurrency Levels",
        fontsize=16,
        fontweight="bold",
        pad=20,
    )

    # Add grid for better readability
    plt.grid(True, linestyle="--", alpha=0.3)

    # Customize legend
    plt.legend(fontsize=12, loc="upper left", frameon=True, fancybox=True, shadow=True)

    # Add value annotations on data points
    for i, (x, y) in enumerate(zip(flask_concurrency, flask_means)):
        plt.annotate(
            f"{y:.2f}s",
            (x, y),
            textcoords="offset points",
            xytext=(0, 10),
            ha="center",
            fontsize=9,
            alpha=0.7,
        )

    for i, (x, y) in enumerate(zip(vdeploy_concurrency, vdeploy_means)):
        plt.annotate(
            f"{y:.2f}s",
            (x, y),
            textcoords="offset points",
            xytext=(0, -15),
            ha="center",
            fontsize=9,
            alpha=0.7,
        )

    # Set axis limits with some padding
    all_latencies = flask_means + vdeploy_means
    plt.ylim(0, max(all_latencies) * 1.1)

    # Ensure integer ticks on x-axis
    max_concurrency = max(max(flask_concurrency), max(vdeploy_concurrency))
    plt.xticks(range(1, max_concurrency + 1))

    # Tight layout
    plt.tight_layout()

    # Save the plot
    plt.savefig(save_path, dpi=300, bbox_inches="tight", facecolor="white")
    print(f"Comparison chart saved as: {save_path}")

    # Show the plot
    plt.show()

    # Print summary statistics
    print("\n" + "=" * 60)
    print("PERFORMANCE SUMMARY")
    print("=" * 60)

    # Calculate average latencies
    flask_avg = sum(flask_means) / len(flask_means)
    vdeploy_avg = sum(vdeploy_means) / len(vdeploy_means)

    print(f"Flask Average Latency: {flask_avg:.3f} seconds")
    print(f"vDeploy Average Latency: {vdeploy_avg:.3f} seconds")

    # Performance ratio
    if vdeploy_avg < flask_avg:
        ratio = flask_avg / vdeploy_avg
        print(f"vDeploy is {ratio:.2f}x faster than Flask")
    else:
        ratio = vdeploy_avg / flask_avg
        print(f"Flask is {ratio:.2f}x faster than vDeploy")

    # Best performance at each concurrency level
    print(f"\nConcurrency Level Performance:")
    for i in range(min(len(flask_concurrency), len(vdeploy_concurrency))):
        conc = flask_concurrency[i]
        flask_lat = flask_means[i]
        vdeploy_lat = vdeploy_means[i]

        if vdeploy_lat < flask_lat:
            winner = "vDeploy"
            diff = ((flask_lat - vdeploy_lat) / flask_lat) * 100
        else:
            winner = "Flask"
            diff = ((vdeploy_lat - flask_lat) / vdeploy_lat) * 100

        print(f"  Concurrency {conc}: {winner} wins by {diff:.1f}%")


def main():
    """Main function to run the comparison"""

    # File paths - update these to match your actual file paths
    flask_file = "benchmark_results/flask_load_test_20250602_201701.json"
    vdeploy_file = "benchmark_results/vdeploy_load_test_20250602_221312.json"

    # Check if files exist
    if not os.path.exists(flask_file):
        print(f"Error: Flask results file not found: {flask_file}")
        print("Available files in benchmark_results/:")
        if os.path.exists("benchmark_results/"):
            for file in os.listdir("benchmark_results/"):
                if file.endswith(".json"):
                    print(f"  {file}")
        return

    if not os.path.exists(vdeploy_file):
        print(f"Error: vDeploy results file not found: {vdeploy_file}")
        print("Available files in benchmark_results/:")
        if os.path.exists("benchmark_results/"):
            for file in os.listdir("benchmark_results/"):
                if file.endswith(".json"):
                    print(f"  {file}")
        return

    try:
        # Load the data
        print("Loading benchmark results...")
        flask_data, vdeploy_data = load_benchmark_results(flask_file, vdeploy_file)

        # Create timestamp for output file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"flask_vs_vdeploy_comparison_{timestamp}.png"

        # Create the comparison chart
        print("Creating comparison chart...")
        create_mean_comparison_chart(flask_data, vdeploy_data, output_file)

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
