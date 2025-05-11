#!/usr/bin/env python3
"""
Metrics Fetcher for vLLM Deployments

This script fetches metrics from a vLLM deployment using the Prometheus HTTP API
and displays them in a readable format. It can be used to monitor the performance
of your vLLM deployment in real-time.

Usage:
  python metrics_fetcher.py --endpoint http://your-endpoint-ip
  python metrics_fetcher.py --endpoint http://your-endpoint-ip --format json
  python metrics_fetcher.py --endpoint http://your-endpoint-ip --watch
"""

import argparse
import json
import requests
import sys
import time
from datetime import datetime
import os
from typing import Dict, Any, List, Optional, Union
import re

# ANSI color codes for terminal output
COLORS = {
    "HEADER": "\033[95m",
    "BLUE": "\033[94m",
    "GREEN": "\033[92m",
    "YELLOW": "\033[93m",
    "RED": "\033[91m",
    "ENDC": "\033[0m",
    "BOLD": "\033[1m",
    "UNDERLINE": "\033[4m",
}

def color_text(text: str, color: str) -> str:
    """Add color to text for terminal output"""
    return f"{COLORS.get(color, '')}{text}{COLORS['ENDC']}"

def parse_prometheus_metrics(metrics_text: str) -> Dict[str, Dict[str, Union[float, str]]]:
    """
    Parse Prometheus metrics format into a structured dictionary
    
    Example input:
    # HELP vllm_request_success_count Number of successful requests
    # TYPE vllm_request_success_count counter
    vllm_request_success_count 42
    
    Example output:
    {
        "vllm_request_success_count": {
            "value": 42.0,
            "help": "Number of successful requests",
            "type": "counter"
        }
    }
    """
    result = {}
    current_metric = None
    current_help = None
    current_type = None
    
    for line in metrics_text.split('\n'):
        line = line.strip()
        if not line:
            continue
            
        # Parse HELP comments
        if line.startswith('# HELP '):
            parts = line[len('# HELP '):].split(' ', 1)
            if len(parts) == 2:
                metric_name, help_text = parts
                current_metric = metric_name
                current_help = help_text
            
        # Parse TYPE comments
        elif line.startswith('# TYPE '):
            parts = line[len('# TYPE '):].split(' ', 1)
            if len(parts) == 2:
                metric_name, type_text = parts
                current_metric = metric_name
                current_type = type_text
                
        # Parse actual metric values
        elif not line.startswith('#'):
            # Handle metrics with labels
            if '{' in line:
                metric_with_labels, value_str = line.rsplit(' ', 1)
                metric_name = metric_with_labels.split('{')[0]
                
                # Extract labels
                labels_str = metric_with_labels.split('{')[1].split('}')[0]
                labels = {}
                for label_pair in labels_str.split(','):
                    if '=' in label_pair:
                        k, v = label_pair.split('=', 1)
                        labels[k] = v.strip('"')
                
                # Create a unique key for this metric with its labels
                label_key = json.dumps(labels, sort_keys=True)
                full_key = f"{metric_name}[{label_key}]"
                
                try:
                    result[full_key] = {
                        "value": float(value_str),
                        "labels": labels
                    }
                    if current_help:
                        result[full_key]["help"] = current_help
                    if current_type:
                        result[full_key]["type"] = current_type
                except ValueError:
                    # Skip metrics with non-numeric values
                    pass
            else:
                # Simple metrics without labels
                parts = line.split(' ')
                if len(parts) >= 2:
                    metric_name = parts[0]
                    try:
                        value = float(parts[1])
                        result[metric_name] = {"value": value}
                        if current_help:
                            result[metric_name]["help"] = current_help
                        if current_type:
                            result[metric_name]["type"] = current_type
                    except ValueError:
                        # Skip metrics with non-numeric values
                        pass
    
    return result

def fetch_metrics(endpoint: str) -> Dict[str, Dict[str, Union[float, str]]]:
    """Fetch metrics from the specified endpoint"""
    metrics_url = f"{endpoint.rstrip('/')}/metrics"
    try:
        response = requests.get(metrics_url, timeout=10)
        if response.status_code == 200:
            return parse_prometheus_metrics(response.text)
        else:
            print(f"Error fetching metrics: HTTP {response.status_code}")
            return {}
    except requests.exceptions.RequestException as e:
        print(f"Error connecting to {metrics_url}: {e}")
        return {}

def categorize_metrics(metrics: Dict[str, Dict[str, Union[float, str]]]) -> Dict[str, Dict[str, Dict[str, Union[float, str]]]]:
    """Categorize metrics by their prefix"""
    categories = {}
    
    for metric_name, metric_data in metrics.items():
        # Extract the prefix (e.g., "vllm" from "vllm_request_count")
        parts = metric_name.split('_', 1)
        if len(parts) > 1:
            prefix = parts[0]
        else:
            prefix = "other"
            
        if prefix not in categories:
            categories[prefix] = {}
            
        categories[prefix][metric_name] = metric_data
    
    return categories

def print_metrics(metrics: Dict[str, Dict[str, Union[float, str]]], format_type: str = "human") -> None:
    """Print metrics in the specified format"""
    if format_type == "json":
        # Convert to a simpler structure for JSON output
        output = {}
        for metric_name, metric_data in metrics.items():
            if isinstance(metric_data, dict) and "value" in metric_data:
                # Include labels if present
                if "labels" in metric_data:
                    output[metric_name] = {
                        "value": metric_data["value"],
                        "labels": metric_data["labels"]
                    }
                else:
                    output[metric_name] = metric_data["value"]
        
        print(json.dumps(output, indent=2))
    else:
        # Human-readable format with categories
        categories = categorize_metrics(metrics)
        
        for category, category_metrics in sorted(categories.items()):
            print(color_text(f"\n=== {category.upper()} METRICS ===", "HEADER"))
            
            for metric_name, metric_data in sorted(category_metrics.items()):
                if isinstance(metric_data, dict) and "value" in metric_data:
                    # Format the value based on its magnitude
                    value = metric_data["value"]
                    if value >= 1000000:
                        value_str = f"{value/1000000:.2f}M"
                    elif value >= 1000:
                        value_str = f"{value/1000:.2f}K"
                    else:
                        value_str = f"{value:.4f}".rstrip('0').rstrip('.')
                    
                    # Add help text if available
                    help_text = f" - {metric_data.get('help', '')}" if "help" in metric_data else ""
                    
                    # Add type information
                    type_info = f" ({metric_data.get('type', 'unknown')})" if "type" in metric_data else ""
                    
                    # Handle metrics with labels
                    if "labels" in metric_data:
                        labels_str = ", ".join([f"{k}={v}" for k, v in metric_data["labels"].items()])
                        print(f"{color_text(metric_name, 'BOLD')} {color_text(value_str, 'GREEN')}{type_info}{help_text}")
                        print(f"  Labels: {color_text(labels_str, 'BLUE')}")
                    else:
                        print(f"{color_text(metric_name, 'BOLD')} {color_text(value_str, 'GREEN')}{type_info}{help_text}")

def print_summary(metrics: Dict[str, Dict[str, Union[float, str]]]) -> None:
    """Print a summary of the most important metrics"""
    print(color_text("\n=== SUMMARY ===", "HEADER"))
    
    # Define important metrics to look for
    important_metrics = {
        "requests": [
            "vllm_request_success_count",
            "vllm_request_failure_count",
            "vllm_request_count"
        ],
        "latency": [
            "vllm_request_latency_seconds_sum",
            "vllm_request_latency_seconds_count",
            "vllm_request_latency_seconds_bucket"
        ],
        "tokens": [
            "vllm_generated_tokens_count",
            "vllm_prompt_tokens_count"
        ],
        "gpu": [
            "gpu_memory_used",
            "gpu_utilization"
        ],
        "queue": [
            "vllm_queue_size",
            "vllm_batch_size"
        ]
    }
    
    # Extract and calculate important metrics
    summary = {}
    
    # Request counts
    success_count = 0
    failure_count = 0
    total_count = 0
    
    for metric_name, metric_data in metrics.items():
        if "vllm_request_success_count" in metric_name:
            success_count += metric_data.get("value", 0)
        elif "vllm_request_failure_count" in metric_name:
            failure_count += metric_data.get("value", 0)
        elif "vllm_request_count" in metric_name and "success" not in metric_name and "failure" not in metric_name:
            total_count += metric_data.get("value", 0)
    
    # If total_count is 0 but we have success or failure counts, use their sum
    if total_count == 0 and (success_count > 0 or failure_count > 0):
        total_count = success_count + failure_count
    
    if total_count > 0:
        summary["Total Requests"] = total_count
        summary["Success Rate"] = f"{(success_count / total_count) * 100:.2f}%"
    
    # Token generation
    generated_tokens = 0
    prompt_tokens = 0
    
    for metric_name, metric_data in metrics.items():
        if "vllm_generated_tokens_count" in metric_name:
            generated_tokens += metric_data.get("value", 0)
        elif "vllm_prompt_tokens_count" in metric_name:
            prompt_tokens += metric_data.get("value", 0)
    
    if generated_tokens > 0:
        summary["Generated Tokens"] = generated_tokens
    if prompt_tokens > 0:
        summary["Prompt Tokens"] = prompt_tokens
    
    # GPU metrics
    gpu_memory = None
    gpu_util = None
    
    for metric_name, metric_data in metrics.items():
        if "gpu_memory_used" in metric_name:
            gpu_memory = metric_data.get("value", 0)
        elif "gpu_utilization" in metric_name:
            gpu_util = metric_data.get("value", 0)
    
    if gpu_memory is not None:
        summary["GPU Memory Used"] = f"{gpu_memory / 1024 / 1024 / 1024:.2f} GB"
    if gpu_util is not None:
        summary["GPU Utilization"] = f"{gpu_util:.2f}%"
    
    # Print the summary
    if summary:
        for key, value in summary.items():
            print(f"{color_text(key, 'BOLD')}: {color_text(str(value), 'GREEN')}")
    else:
        print(color_text("No summary metrics available", "YELLOW"))

def watch_metrics(endpoint: str, interval: int = 5, format_type: str = "human") -> None:
    """Watch metrics in real-time with periodic updates"""
    try:
        while True:
            # Clear screen
            os.system('cls' if os.name == 'nt' else 'clear')
            
            # Fetch and print metrics
            metrics = fetch_metrics(endpoint)
            
            # Print timestamp
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(color_text(f"Metrics as of {now} (refreshing every {interval}s)", "HEADER"))
            print(color_text(f"Endpoint: {endpoint}", "BLUE"))
            
            if metrics:
                # Print summary first
                print_summary(metrics)
                
                # Then print all metrics
                print_metrics(metrics, format_type)
            else:
                print(color_text("No metrics available", "RED"))
            
            # Wait for the next update
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nExiting metrics watch mode")

def main():
    parser = argparse.ArgumentParser(description="Fetch and display metrics from a vLLM deployment")
    parser.add_argument("--endpoint", required=True, help="The endpoint URL (e.g., http://35.226.134.75)")
    parser.add_argument("--format", choices=["human", "json"], default="human", help="Output format")
    parser.add_argument("--watch", action="store_true", help="Watch metrics in real-time")
    parser.add_argument("--interval", type=int, default=5, help="Refresh interval in seconds (for watch mode)")
    
    args = parser.parse_args()
    
    if args.watch:
        watch_metrics(args.endpoint, args.interval, args.format)
    else:
        metrics = fetch_metrics(args.endpoint)
        if metrics:
            if args.format == "human":
                print_summary(metrics)
            print_metrics(metrics, args.format)
        else:
            print("No metrics available")

if __name__ == "__main__":
    main()
