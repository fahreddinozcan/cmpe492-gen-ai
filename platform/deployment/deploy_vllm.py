import logging

from utils.command import run_command
from generate_values import generate_values
import os

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("vllm-deploy")


def create_namespace_if_not_exists(namespace):
    """Create K8s namespace if it doesn't exist"""
    result = run_command(f"kubectl get namespace {namespace}", check=False)

    if result.returncode != 0:
        logger.info(f"Creating namespace {namespace}")
        run_command(f"kubectl create namespace {namespace}")
    else:
        logger.info(f"Namespace {namespace} already exists")


def deploy_vllm(args):
    try:
        create_namespace_if_not_exists(args.namespace)

        values_file = generate_values(args)

        logger.info("Generated values file")

        if args.debug:
            with open(values_file) as f:
                logger.debug(f"Values file content: {f.read()}")

        helm_cmd = (
            f"helm upgrade --install --create-namespace "
            f"--namespace={args.namespace} {args.release_name} "
            f"./vllm-chart -f {values_file}"
        )

        logger.info(f"Deploying vLLM with Helm...")
        result = run_command(helm_cmd)

        logger.info(result.stdout)
        if result.stderr:
            logger.warning(result.stderr)

        logger.info(
            f"Deployment complete. Service available at: {args.release_name}.{args.namespace}.svc.cluster.local"
        )

        os.remove(values_file)
        return True

    except Exception as e:
        logger.error(f"Deployment failed: {e}")
        return False
