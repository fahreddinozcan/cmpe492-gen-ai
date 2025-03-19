import argparse


def parse_args(args):
    parser = argparse.ArgumentParser(description="Deploy VLLM to Kubernetes using Helm")

    # Basic deployment parameters
    parser.add_argument(
        "-n", "--namespace", default="vllm", help="Kubernetes namespace (default: vllm)"
    )
    parser.add_argument(
        "-r",
        "--release-name",
        default="vllm-model",
        help="Helm release name (default: vllm-model)",
    )
    parser.add_argument(
        "-m", "--model-path", required=True, help="Model path or name (required)"
    )
    parser.add_argument(
        "-N",
        "--model-name",
        help="Served model name (default: derived from model path)",
    )

    # Resource configuration
    parser.add_argument(
        "-g", "--gpu-type", default="nvidia-l4", help="GPU type (default: nvidia-l4)"
    )
    parser.add_argument(
        "-c", "--gpu-count", default=1, type=int, help="Number of GPUs (default: 1)"
    )
    parser.add_argument(
        "-C", "--cpu-count", default=4, type=int, help="Number of CPUs (default: 4)"
    )
    parser.add_argument(
        "-M", "--memory", default="8Gi", help="Memory size (default: 8Gi)"
    )
    parser.add_argument(
        "-s", "--storage", default="10Gi", help="PVC storage size (default: 10Gi)"
    )

    # Image configuration
    parser.add_argument(
        "-i", "--image-tag", default="latest", help="Image tag (default: latest)"
    )

    # Additional parameters
    parser.add_argument("-t", "--hf-token", help="Hugging Face token")
    parser.add_argument(
        "-e", "--environment", default="prod", help="Environment name (default: prod)"
    )

    # S3 configuration
    parser.add_argument(
        "--use-s3", action="store_true", help="Use S3 for model storage"
    )
    parser.add_argument("--s3-endpoint", help="S3 endpoint URL")
    parser.add_argument("--s3-bucket", help="S3 bucket name")
    parser.add_argument("--s3-access-key", help="S3 access key id")
    parser.add_argument("--s3-secret-key", help="S3 secret access key")

    # Debug mode
    parser.add_argument("--debug", action="store_true", help="Enable debug output")

    args = parser.parse_args()

    return args
