import argparse
import json
import logging
import subprocess
import sys
from ..utils.command import run_command

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("vllm-manager")


def list_deployments(namespace=None):
    """List all vLLM deployments"""
    logger.info("Listing vLLM deployments...")

    if namespace:
        cmd = f"helm list -n {namespace} -o json"
    else:
        cmd = "helm list --all-namespaces -o json"

    result = run_command(cmd)

    try:
        deployments = json.loads(result.stdout)
        vllm_deployments = [
            d for d in deployments if "vllm" in d.get("chart", "").lower()
        ]

        if not vllm_deployments:
            logger.info("No vLLM deployments found")

        return vllm_deployments
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing JSON: {str(e)}")
        return []


def get_deployment_status(namespace, release_name):
    """Get status of a specific deployment"""
    logger.info(f"Checking status of {release_name} in namespace {namespace}...")

    k8s_cmd = f"kubectl get all -n {namespace} -l app={release_name} -o wide"
    k8s_result = run_command(k8s_cmd, check=False)

    helm_cmd = f"helm status {release_name} -n {namespace}"
    helm_result = run_command(helm_cmd, check=False)

    return {
        "kubectl_output": (
            k8s_result.stdout
            if k8s_result.returncode == 0
            else f"Error: {k8s_result.stderr}"
        ),
        "helm_output": (
            helm_result.stdout
            if helm_result.returncode == 0
            else f"Error: {helm_result.stderr}"
        ),
    }


def delete_deployment(namespace, release_name, delete_pvc=False):
    """Delete a specific deployment"""
    logger.info(f"Deleting {release_name} from namespace {namespace}...")

    helm_cmd = f"helm uninstall {release_name} -n {namespace}"
    helm_result = run_command(helm_cmd, check=False)

    if helm_result.returncode != 0:
        logger.error(f"Error deleting Helm release: {helm_result.stderr}")
        return False

    if delete_pvc:
        logger.info(f"Deleting associated PVC for {release_name}...")
        pvc_cmd = f"kubectl delete pvc {release_name}-pvc -n {namespace}"
        pvc_result = run_command(pvc_cmd, check=False)

        if pvc_result.returncode != 0:
            logger.warning(f"PVC not found or already deleted: {pvc_result.stderr}")

    logger.info("Deployment deleted successfully")
    return True


def main():
    """Main function to parse arguments and manage deployments"""
    parser = argparse.ArgumentParser(
        description="Manage vLLM deployments on Kubernetes"
    )
    parser.add_argument(
        "action", choices=["list", "status", "delete"], help="Action to perform"
    )
    parser.add_argument("-n", "--namespace", help="Kubernetes namespace")
    parser.add_argument("-r", "--release-name", help="Helm release name")
    parser.add_argument(
        "--delete-pvc",
        action="store_true",
        help="Delete associated PVC when deleting a deployment",
    )
    parser.add_argument("--debug", action="store_true", help="Enable debug output")

    args = parser.parse_args()

    if args.debug:
        logger.setLevel(logging.DEBUG)

    if args.action in ["status", "delete"] and (
        not args.namespace or not args.release_name
    ):
        logger.error(
            f"Namespace and release name are required for {args.action} action"
        )
        parser.print_help()
        sys.exit(1)

    if args.action == "list":
        deployments = list_deployments(args.namespace)
        print(json.dumps(deployments, indent=2))

    elif args.action == "status":
        status = get_deployment_status(args.namespace, args.release_name)
        print("\n=== Kubernetes Resources ===")
        print(status["kubectl_output"])
        print("\n=== Helm Release Status ===")
        print(status["helm_output"])

    elif args.action == "delete":
        success = delete_deployment(args.namespace, args.release_name, args.delete_pvc)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
