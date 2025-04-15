#!/usr/bin/env python3
import asyncio
import json
import sys
import websockets
import argparse
from datetime import datetime
from colorama import init, Fore, Style

# Initialize colorama for colored output
init()

# python log_streamer.py f407ebc4-6121-5238-91f6-99c3ef7f2834


async def stream_logs(deployment_id):
    """
    Connect to the WebSocket endpoint and stream logs
    """
    uri = f"ws://localhost:8000/ws/logs/{deployment_id}"
    print(f"{Fore.CYAN}Connecting to {uri}{Style.RESET_ALL}")

    try:
        async with websockets.connect(uri) as websocket:
            print(
                f"{Fore.GREEN}Connected! Streaming logs for deployment {deployment_id}...{Style.RESET_ALL}"
            )
            print(f"{Fore.YELLOW}Press Ctrl+C to exit{Style.RESET_ALL}")

            while True:
                try:
                    message = await websocket.recv()
                    data = json.loads(message)

                    # Check if it's an error message
                    if "error" in data:
                        print(f"{Fore.RED}ERROR: {data['error']}{Style.RESET_ALL}")
                        continue

                    # Format the log entry
                    timestamp = data.get("timestamp", datetime.now().isoformat())
                    pod_name = data.get("pod_name", "unknown")
                    log = data.get("log", "")

                    # Print with nice formatting
                    time_str = timestamp.split("T")[1].split(".")[0]  # Extract HH:MM:SS
                    print(
                        f"{Fore.BLUE}[{time_str}] {Fore.MAGENTA}{pod_name}{Fore.RESET}: {log}"
                    )

                except json.JSONDecodeError:
                    print(
                        f"{Fore.RED}Failed to parse message: {message}{Style.RESET_ALL}"
                    )
                except websockets.exceptions.ConnectionClosed:
                    print(f"{Fore.RED}Connection closed{Style.RESET_ALL}")
                    break
    except Exception as e:
        print(f"{Fore.RED}Error: {str(e)}{Style.RESET_ALL}")
        return


def main():
    parser = argparse.ArgumentParser(description="Stream logs from a deployment")
    parser.add_argument("deployment_id", help="The deployment ID to stream logs from")
    args = parser.parse_args()

    try:
        asyncio.run(stream_logs(args.deployment_id))
    except KeyboardInterrupt:
        print(f"{Fore.YELLOW}Streaming stopped by user{Style.RESET_ALL}")
        sys.exit(0)


if __name__ == "__main__":
    main()
