#!/usr/bin/env python3
import logging
import sys
import os
from parser import parse_args
from deploy_vllm import deploy_vllm, delete_deployment, list_deployments

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("vllm-deploy")


def check_prerequisites():
    """Check if required tools are installed"""
    tools = ["kubectl", "helm"]
    missing = []

    for tool in tools:
        result = os.system(f"which {tool} > /dev/null 2>&1")
        if result != 0:
            missing.append(tool)

    if missing:
        logger.error(f"Missing required tools: {', '.join(missing)}")
        logger.error(f"Please install them before continuing.")
        return False

    return True


def main():
    """Main function"""
    # Parse command line arguments
    args = parse_args()

    # Set log level based on debug flag
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.setLevel(logging.DEBUG)

    # Check prerequisites
    # if not check_prerequisites():
    #     sys.exit(1)

    # Determine the command to execute
    # If no command is specified but model_path is, assume deploy
    if not hasattr(args, "command") or not args.command:
        if hasattr(args, "model_path") and args.model_path:
            args.command = "deploy"
        else:
            logger.error("No command specified and no model path provided")
            sys.exit(1)

    # Execute the corresponding command
    success = False
    if args.command == "deploy":
        logger.info(
            f"Deploying vLLM model {args.model_path} as {args.release_name} in namespace {args.namespace}"
        )
        success = deploy_vllm(args)
    elif args.command == "delete":
        logger.info(
            f"Deleting vLLM deployment {args.release_name} from namespace {args.namespace}"
        )
        success = delete_deployment(args)
    elif args.command == "list":
        namespace_msg = (
            f"in namespace {args.namespace}" if args.namespace else "in all namespaces"
        )
        logger.info(f"Listing vLLM deployments {namespace_msg}")
        success = list_deployments(args)
    else:
        logger.error(f"Unknown command: {args.command}")
        sys.exit(1)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
