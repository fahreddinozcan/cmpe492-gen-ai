#!/usr/bin/env python3
# visualize_results.py
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import glob
import os
import argparse


def main():
    parser = argparse.ArgumentParser(description="Visualize vLLM benchmark results")
    parser.add_argument(
        "--results-dir", type=str, default=".", help="Directory containing CSV results"
    )
    args = parser.parse_args()

    # Create output directory
    output_dir = "benchmark_charts"
    os.makedirs(output_dir, exist_ok=True)

    # Find all metrics CSV files
    csv_files = glob.glob(f"{args.results_dir}/vllm_metrics_*.csv")
    if not csv_files:
        print(f"No metrics files found in {args.results_dir}")
        return

    # Combine all CSV files
    df_list = []
    for file in csv_files:
        try:
            df = pd.read_csv(file)
            df_list.append(df)
        except Exception as e:
            print(f"Error reading {file}: {e}")

    if not df_list:
        print("No valid data found in CSV files")
        return

    df = pd.concat(df_list, ignore_index=True)

    # Extract test parameters from phase
    df["model_short"] = df["model"].apply(lambda x: x.split("/")[-1])

    # Create visualizations
    plot_ttft_by_model_and_seq_size(df, output_dir)
    plot_tpot_by_model_and_seq_size(df, output_dir)
    plot_request_time_by_model_and_batch_size(df, output_dir)
    plot_heatmaps(df, output_dir)

    print(f"Visualizations saved to {output_dir}/")


def plot_ttft_by_model_and_seq_size(df, output_dir):
    plt.figure(figsize=(12, 8))
    ax = sns.boxplot(x="max_num_seqs", y="ttft", hue="model_short", data=df)
    ax.set_title("Time to First Token by Model and Sequence Size", fontsize=14)
    ax.set_xlabel("Max Sequences", fontsize=12)
    ax.set_ylabel("TTFT (seconds)", fontsize=12)
    plt.grid(True, linestyle="--", alpha=0.7)
    plt.legend(title="Model")
    plt.tight_layout()
    plt.savefig(f"{output_dir}/ttft_by_model_and_seq_size.png", dpi=300)
    plt.close()


def plot_tpot_by_model_and_seq_size(df, output_dir):
    plt.figure(figsize=(12, 8))
    ax = sns.boxplot(x="max_num_seqs", y="tpot", hue="model_short", data=df)
    ax.set_title("Tokens Per Second by Model and Sequence Size", fontsize=14)
    ax.set_xlabel("Max Sequences", fontsize=12)
    ax.set_ylabel("Tokens per Second", fontsize=12)
    plt.grid(True, linestyle="--", alpha=0.7)
    plt.legend(title="Model")
    plt.tight_layout()
    plt.savefig(f"{output_dir}/tpot_by_model_and_seq_size.png", dpi=300)
    plt.close()


def plot_request_time_by_model_and_batch_size(df, output_dir):
    plt.figure(figsize=(12, 8))
    ax = sns.boxplot(x="batch_size", y="request_time", hue="model_short", data=df)
    ax.set_title("Request Time by Model and Batch Size", fontsize=14)
    ax.set_xlabel("Batch Size", fontsize=12)
    ax.set_ylabel("Request Time (seconds)", fontsize=12)
    plt.grid(True, linestyle="--", alpha=0.7)
    plt.legend(title="Model")
    plt.tight_layout()
    plt.savefig(f"{output_dir}/request_time_by_model_and_batch_size.png", dpi=300)
    plt.close()


def plot_heatmaps(df, output_dir):
    for model in df["model_short"].unique():
        model_df = df[df["model_short"] == model]

        # Create pivot tables for different metrics
        for metric, title in [
            ("ttft", "Time to First Token (s)"),
            ("tpot", "Tokens Per Second"),
            ("request_time", "Request Time (s)"),
        ]:
            try:
                pivot = model_df.pivot_table(
                    index="max_num_seqs",
                    columns="batch_size",
                    values=metric,
                    aggfunc="mean",
                )

                plt.figure(figsize=(10, 8))
                sns.heatmap(pivot, annot=True, fmt=".2f", cmap="YlGnBu")
                plt.title(f"{model}: {title} by Seq Size and Batch Size", fontsize=14)
                plt.xlabel("Batch Size", fontsize=12)
                plt.ylabel("Max Sequences", fontsize=12)
                plt.tight_layout()
                plt.savefig(f"{output_dir}/{model}_{metric}_heatmap.png", dpi=300)
                plt.close()
            except:
                print(f"Could not create heatmap for {model} {metric}")


if __name__ == "__main__":
    main()
