import argparse


def modify_parser(parser):
    """Add delete options to the parser"""
    # Create a subparser for commands
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Create parser
    create_parser = subparsers.add_parser(
        "create", help="Create a GKE cluster with GPU support"
    )
    # Add all existing arguments to the create parser
    create_parser.add_argument("--project-id", required=True, help="GCP Project ID")
    create_parser.add_argument(
        "--zone", default="us-central1-a", help="GCP zone (default: us-central1-a)"
    )
    create_parser.add_argument("--network", help="VPC network name (optional)")
    create_parser.add_argument("--subnetwork", help="VPC subnetwork name (optional)")
    create_parser.add_argument(
        "--cluster-name",
        default="vllm-cluster",
        help="GKE cluster name (default: vllm-cluster)",
    )
    create_parser.add_argument(
        "--machine-type",
        default="e2-standard-4",
        help="Machine type for CPU nodes (default: e2-standard-4)",
    )
    create_parser.add_argument(
        "--num-nodes", default=3, type=int, help="Number of CPU nodes (default: 3)"
    )
    create_parser.add_argument(
        "--gpu-pool-name",
        default="gpu-pool",
        help="Name for the GPU node pool (default: gpu-pool)",
    )
    create_parser.add_argument(
        "--gpu-machine-type",
        default="n1-standard-8",
        help="Machine type for GPU nodes (default: n1-standard-8)",
    )
    create_parser.add_argument(
        "--gpu-type",
        default="nvidia-l4",
        choices=["nvidia-l4", "nvidia-t4", "nvidia-a100", "nvidia-v100"],
        help="GPU type (default: nvidia-l4)",
    )
    create_parser.add_argument(
        "--gpu-nodes", default=1, type=int, help="Number of GPU nodes (default: 1)"
    )
    create_parser.add_argument(
        "--gpus-per-node",
        default=1,
        type=int,
        help="Number of GPUs per node (default: 1)",
    )
    create_parser.add_argument(
        "--min-gpu-nodes",
        default=0,
        type=int,
        help="Minimum number of GPU nodes for autoscaling (default: 0)",
    )
    create_parser.add_argument(
        "--max-gpu-nodes",
        default=5,
        type=int,
        help="Maximum number of GPU nodes for autoscaling (default: 5)",
    )
    create_parser.add_argument(
        "--debug", action="store_true", help="Enable debug output"
    )

    # Delete parser
    delete_parser = subparsers.add_parser("delete", help="Delete a GKE cluster")
    delete_parser.add_argument("--project-id", required=True, help="GCP Project ID")
    delete_parser.add_argument(
        "--zone", default="us-central1-a", help="GCP zone where the cluster is located"
    )
    delete_parser.add_argument(
        "--cluster-name", required=True, help="Name of the GKE cluster to delete"
    )
    delete_parser.add_argument(
        "--force-delete", action="store_true", help="Delete without confirmation prompt"
    )
    delete_parser.add_argument(
        "--debug", action="store_true", help="Enable debug output"
    )

    return parser
