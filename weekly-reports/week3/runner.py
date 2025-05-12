#!/usr/bin/env python3
import subprocess
import os
import time
import datetime
import csv


def run_test(
    batch_size, user_count, test_phase, duration="2m", host="http://localhost:8000"
):
    # Set environment variables for locustfile.py to pick up (if used in your test code)
    os.environ["BATCH_SIZE"] = str(batch_size)
    os.environ["USER_COUNT"] = str(user_count)
    os.environ["TEST_PHASE"] = test_phase
    os.environ["TEST_DURATION"] = str(180)  # 2 minutes

    start_time = datetime.datetime.now()
    print(
        f"Starting test '{test_phase}' with batch_size={batch_size}, user_count={user_count} at {start_time}"
    )

    # Build the locust command line
    # Note the addition of "--host" to specify the LLM server (e.g., http://localhost:8000)
    cmd = [
        "locust",
        "-f",
        "locustfile.py",
        "--host",
        host,
        "--headless",
        "-u",
        str(user_count),
        "-r",
        str(max(1, user_count // 10)),
        "--run-time",
        duration,
        "--only-summary",
    ]

    subprocess.run(cmd)
    end_time = datetime.datetime.now()
    print(f"Finished test '{test_phase}' at {end_time}\n")
    return start_time, end_time


def main():
    log_filename = "automated_test_timestamps.csv"
    with open(log_filename, "w", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(
            [
                "test_category",
                "test_phase",
                "batch_size",
                "user_count",
                "start_time",
                "end_time",
            ]
        )

    # TEST 2: Vary user_count while keeping batch_size fixed
    fixed_batch_size = 64
    user_counts = [10, 20, 40, 60]
    for uc in user_counts:
        phase = f"vary_user_count_{uc}"
        start_time, end_time = run_test(
            batch_size=fixed_batch_size, user_count=uc, test_phase=phase, duration="2m"
        )
        with open(log_filename, "a", newline="") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(
                [
                    "user_count",
                    phase,
                    fixed_batch_size,
                    uc,
                    start_time.isoformat(),
                    end_time.isoformat(),
                ]
            )
        print("Waiting 60 seconds before starting next test...\n")
        time.sleep(45)


if __name__ == "__main__":
    main()
