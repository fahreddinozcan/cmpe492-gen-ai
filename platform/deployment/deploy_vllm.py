import os
import logging
import json
from utils.command import run_command

# from generate_values import generate_values
from .generate_values import generate_values

logger = logging.getLogger("vllm-deploy")


def create_namespace_if_not_exists(namespace, stream_output=False):
    """
    Create K8s namespace if it doesn't exist

    Args:
        namespace: Kubernetes namespace
        stream_output: Whether to stream command output
    """
    result = run_command(
        f"kubectl get namespace {namespace}", check=False, stream_output=stream_output
    )

    if result.returncode != 0:
        logger.info(f"Creating namespace {namespace}")
        run_command(
            f"kubectl create namespace {namespace}", stream_output=stream_output
        )
    else:
        logger.info(f"Namespace {namespace} already exists")


def deploy_vllm(args):
    """
    Deploy vLLM using Helm with the provided arguments

    Args:
        args: Command line arguments with deployment options

    Returns:
        bool: True if deployment succeeded, False otherwise
    """

    if not args.model_path and args.command != "list" and args.command != "delete":
        logger.error("Model path is required for deployment")
        return False

    # create_namespace_if_not_exists(args.namespace)

    values_file = generate_values(args)

    if args.debug:
        with open(values_file, "r") as f:
            logger.debug(f"Values file content:\n{f.read()}")

    additional_args = args.helm_args if args.helm_args else ""

    helm_cmd = (
        f"helm upgrade --install --create-namespace "
        f"--namespace={args.namespace} {args.release_name} "
        f"{args.chart_path} -f {values_file} {additional_args}"
    )

    logger.info(f"Deplying vLLM with helm")

    result = run_command(helm_cmd)
    os.unlink(values_file)

    logger.info(
        f"Deployment complete. Service available at: {args.release_name}.{args.namespace}.svc.cluster.local"
    )

    logger.info(f"To test the deployment:")
    logger.info(
        f"  kubectl port-forward -n {args.namespace} svc/{args.release_name}-router-service 8000:80"
    )
    logger.info(
        f'  curl http://localhost:8000/v1/completions -H "Content-Type: application/json" -d \'{{\n'
    )

    model_path = args.model_path
    logger.info(
        f'    "model": "{model_path}",\n    "prompt": "Write a poem about AI",\n    "max_tokens": 100\n  }}\''
    )

    return True


def delete_deployment(args):
    """
    Delete vLLM deployment

    Args:
        args: Command line arguments with deletion options

    Returns:
        bool: True if deletion succeeded, False otherwise
    """
    try:
        # Note: --purge flag is not needed in Helm 3+, it's the default behavior
        helm_cmd = f"helm uninstall {args.release_name} --namespace={args.namespace}"

        logger.info(
            f"Deleting vLLM deployment {args.release_name} in namespace {args.namespace}..."
        )
        result = run_command(helm_cmd)

        logger.info(f"Deployment {args.release_name} deleted successfully")
        return True

    except Exception as e:
        logger.error(f"Deletion failed: {str(e)}")
        if args.debug:
            import traceback

            traceback.print_exc()
        return False


def list_deployments(args):
    """
    List vLLM deployments

    Args:
        args: Command line arguments with list options

    Returns:
        bool: True if listing succeeded, False otherwise
    """
    try:
        # Build helm command
        namespace_flag = (
            f"--namespace={args.namespace}" if args.namespace else "--all-namespaces"
        )
        helm_cmd = f"helm list {namespace_flag} -o json"

        # Run helm command
        logger.info(f"Listing vLLM deployments...")
        result = run_command(helm_cmd, stream_output=args.stream_output)

        # Parse and display deployments
        try:
            deployments = json.loads(result.stdout)
            vllm_deployments = [
                d
                for d in deployments
                if "vllm" in d.get("chart", "").lower()
                or "vllm" in d.get("name", "").lower()
            ]

            if not vllm_deployments:
                logger.info("No vLLM deployments found")
            else:
                logger.info(f"Found {len(vllm_deployments)} vLLM deployments:")
                for d in vllm_deployments:
                    logger.info(
                        f"  {d['name']} in namespace {d['namespace']} (chart: {d['chart']}, version: {d['app_version']})"
                    )

            return True

        except json.JSONDecodeError:
            logger.error(f"Error parsing Helm output")
            return False

    except Exception as e:
        logger.error(f"Listing failed: {str(e)}")
        if args.debug:
            import traceback

            traceback.print_exc()
        return False
