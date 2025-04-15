import argparse


def parse_args(args=None):
    """
    Parse command line arguments for vLLM deployment

    Args:
        args: Command line arguments (optional)

    Returns:
        parsed_args: Parsed arguments object
    """
    parser = argparse.ArgumentParser(description="Deploy vLLM to Kubernetes using Helm")

    # Create subparsers for different commands
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Create parser for deployment
    deploy_parser = subparsers.add_parser("deploy", help="Deploy vLLM model")
    _add_deploy_args(deploy_parser)

    # Create parser for deletion
    delete_parser = subparsers.add_parser("delete", help="Delete vLLM deployment")
    _add_delete_args(delete_parser)

    # Create parser for listing deployments
    list_parser = subparsers.add_parser("list", help="List vLLM deployments")
    _add_list_args(list_parser)

    # For backward compatibility, also add deployment args to main parser
    _add_deploy_args(parser)

    return parser.parse_args(args)


def _add_deploy_args(parser):
    """Add deployment arguments to parser"""
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
        "-m", "--model-path", help="Model path or name (required for deploy command)"
    )
    parser.add_argument(
        "-N",
        "--model-name",
        help="Served model name (default: derived from model path)",
    )
    parser.add_argument(
        "--dtype",
        default="bfloat16",
        choices=["float16", "bfloat16", "float32"],
        help="Model dtype (default: bfloat16)",
    )

    # Resource configuration
    parser.add_argument(
        "-g", "--gpu-type", default="nvidia-l4", help="GPU type (default: nvidia-l4)"
    )
    parser.add_argument(
        "-c", "--gpu-count", default=1, type=int, help="Number of GPUs (default: 1)"
    )
    parser.add_argument(
        "-C", "--cpu-count", default=2, type=int, help="Number of CPUs (default: 2)"
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
    parser.add_argument(
        "--image-repo",
        default="vllm/vllm-openai",
        help="Image repository (default: vllm/vllm-openai)",
    )

    # Additional parameters
    parser.add_argument("-t", "--hf-token", help="Hugging Face token")
    parser.add_argument(
        "-e", "--environment", default="prod", help="Environment name (default: prod)"
    )
    parser.add_argument(
        "--tensor-parallel-size",
        type=int,
        default=1,
        help="Tensor parallel size for multi-GPU inference (default: 1)",
    )
    parser.add_argument(
        "--max-num-seqs",
        type=int,
        default=64,
        help="Maximum number of sequences (default: 64)",
    )
    parser.add_argument(
        "--enable-chunked-prefill", action="store_true", help="Enable chunked prefill"
    )

    # Helm configuration
    parser.add_argument("--values-file", help="Path to custom values.yaml file")
    parser.add_argument("--helm-args", help="Additional arguments to pass to Helm")

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
    parser.add_argument(
        "--stream-output",
        action="store_true",
        help="Stream command output in real-time",
    )

    # Chart path
    parser.add_argument(
        "--chart-path",
        default="./vllm-chart",
        help="Path to vLLM Helm chart (default: ./vllm-chart)",
    )


def _add_delete_args(parser):
    """Add deletion arguments to parser"""
    parser.add_argument(
        "-n", "--namespace", default="vllm", help="Kubernetes namespace"
    )
    parser.add_argument(
        "-r", "--release-name", required=True, help="Helm release name to delete"
    )
    parser.add_argument(
        "--purge", action="store_true", help="Completely remove the release"
    )
    parser.add_argument("--debug", action="store_true", help="Enable debug output")
    parser.add_argument(
        "--stream-output",
        action="store_true",
        help="Stream command output in real-time",
    )


def _add_list_args(parser):
    """Add list arguments to parser"""
    parser.add_argument(
        "-n", "--namespace", help="Kubernetes namespace (default: all namespaces)"
    )
    parser.add_argument("--debug", action="store_true", help="Enable debug output")
    parser.add_argument(
        "--stream-output",
        action="store_true",
        help="Stream command output in real-time",
    )
