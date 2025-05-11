import logging
import json
import time
import sys
import argparse
from .parser import modify_parser
import subprocess

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("gke-cluster-creator")


def run_command(command, check=True):
    """Run a shell command and return output"""
    logger.info(f"Running command: {command}")
    try:
        result = subprocess.run(
            command, shell=True, check=check, text=True, capture_output=True
        )

        if result.stdout:
            logger.info(f"Command output:\n{result.stdout}")
        return result
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {e}")
        logger.error(f"Error output: {e.stderr}")
        if check:
            raise
        return e


def check_gcloud_auth():
    """Check if gcloud is authenticated"""
    logger.info("Checking gcloud authentication...")
    result = run_command("gcloud auth list --format=json", check=False)

    # Log the raw output for debugging
    logger.info(f"gcloud auth list output: {result.stdout}")

    if result.returncode != 0:
        logger.error(
            f"gcloud authentication failed (return code {result.returncode}). Please run 'gcloud auth login' first. Error: {result.stderr}"
        )
        return False

    try:
        accounts = json.loads(result.stdout)
        logger.info(f"Found {len(accounts)} gcloud accounts: {accounts}")

        if not accounts:
            logger.error(
                "No gcloud accounts found. Please run 'gcloud auth login' first."
            )
            return False

        # Check if at least one account is active
        active_accounts = [acc for acc in accounts if acc.get("status") == "ACTIVE"]
        logger.info(f"Found {len(active_accounts)} active gcloud accounts")

        if not active_accounts:
            logger.warning("No active gcloud accounts found. Auth may be incomplete.")
            # Still return True if there are accounts, even if none are marked as active
            return len(accounts) > 0

        return True
    except json.JSONDecodeError as e:
        logger.error(
            f"Failed to parse gcloud auth output: {e}. Please check gcloud installation."
        )
        return False
    except Exception as e:
        logger.error(f"Unexpected error checking gcloud auth: {e}")
        return False


def list_gcp_projects():
    """List all available GCP projects"""
    logger.info("Fetching available GCP projects...")
    result = run_command("gcloud projects list --format=json", check=False)

    if result.returncode != 0:
        logger.error("Failed to list GCP projects.")
        return []

    try:
        projects = json.loads(result.stdout)
        # Extract only the project IDs and names
        project_list = [
            {
                "project_id": project.get("projectId", ""),
                "name": project.get("name", ""),
            }
            for project in projects
        ]
        return project_list
    except json.JSONDecodeError:
        logger.error("Failed to parse gcloud projects output.")
        return []


def check_project(project_id):
    """Check if the project exists and is accessible"""
    logger.info(f"Checking project {project_id}...")
    result = run_command(
        f"gcloud projects describe {project_id} --format=json", check=False
    )

    if result.returncode != 0:
        logger.error(f"Project {project_id} not found or not accessible.")
        return False

    # Set as default project
    run_command(f"gcloud config set project {project_id}")
    return True


def enable_required_apis(project_id):
    """Enable required GCP APIs for GKE with GPUs"""
    required_apis = [
        "container.googleapis.com",
        "compute.googleapis.com",
        "iam.googleapis.com",
        "artifactregistry.googleapis.com",
        "cloudresourcemanager.googleapis.com",
    ]

    logger.info("Enabling required GCP APIs...")

    for api in required_apis:
        logger.info(f"Enabling {api}...")
        run_command(f"gcloud services enable {api} --project={project_id}")

    logger.info("All required APIs enabled successfully.")


def create_gke_cluster(args):
    """Create a GKE cluster with GPU node pool"""
    logger.info(f"Creating GKE cluster {args.cluster_name} in zone {args.zone}...")

    create_cmd = [
        f"gcloud container clusters create {args.cluster_name}",
        f"--project={args.project_id}",
        f"--zone={args.zone}",
        f"--machine-type={args.machine_type}",
        f"--num-nodes={args.num_nodes}",
        "--enable-autoupgrade",
        "--release-channel=rapid",
        "--scopes=gke-default,storage-rw",
    ]

    if args.network:
        create_cmd.append(f"--network={args.network}")
    if args.subnetwork:
        create_cmd.append(f"--subnetwork={args.subnetwork}")

    result = run_command(" ".join(create_cmd))

    if result.returncode != 0:
        logger.error("Failed to create GKE cluster.")
        return False

    logger.info("Base GKE cluster created successfully.")

    logger.info(f"Creating GPU node pool with {args.gpu_type} GPUs...")

    gpu_pool_cmd = [
        f"gcloud container node-pools create {args.gpu_pool_name}",
        f"--project={args.project_id}",
        f"--cluster={args.cluster_name}",
        f"--zone={args.zone}",
        f"--machine-type={args.gpu_machine_type}",
        f"--num-nodes={args.gpu_nodes}",
        f"--accelerator=type={args.gpu_type},count={args.gpus_per_node},gpu-driver-version=default",
        "--enable-autoupgrade",
        f"--disk-size=100",
        # "--enable-autoscaling",
        f"--min-nodes={args.min_gpu_nodes}",
        f"--max-nodes={args.max_gpu_nodes}",
    ]

    result = run_command(" ".join(gpu_pool_cmd))

    if result.returncode != 0:
        logger.error("Failed to create GPU node pool.")
        return False

    logger.info("GPU node pool created successfully.")

    logger.info("Configuring kubectl to use the new cluster...")
    run_command(
        f"gcloud container clusters get-credentials {args.cluster_name} --zone={args.zone} --project={args.project_id}"
    )

    logger.info("Waiting for nodes to be ready...")

    time.sleep(60)

    logger.info("Checking GPU node status...")
    run_command("kubectl get nodes -l cloud.google.com/gke-accelerator")

    logger.info(
        f"GKE cluster with GPU support created successfully: {args.cluster_name}"
    )
    logger.info(f"GPU node pool: {args.gpu_pool_name} with {args.gpu_type} GPUs")

    return True


def delete_gke_cluster(args):
    """Delete the GKE cluster"""
    logger.info(f"Deleting GKE cluster {args.cluster_name} in zone {args.zone}...")

    if not args.force_delete:
        confirm = input(
            f"Are you sure you want to delete cluster '{args.cluster_name}'? This cannot be undone. (y/N): "
        )
        if confirm.lower() != "y":
            logger.info("Cluster deletion cancelled.")
            return False

    delete_cmd = [
        f"gcloud container clusters delete {args.cluster_name}",
        f"--project={args.project_id}",
        f"--zone={args.zone}",
        "--quiet",
    ]

    result = run_command(" ".join(delete_cmd))

    if result.returncode != 0:
        logger.error("Failed to delete GKE cluster.")
        return False

    logger.info(f"GKE cluster {args.cluster_name} deleted successfully.")
    return True


def main():
    """Main function to parse arguments and create GKE cluster"""
    parser = argparse.ArgumentParser(description="Create or delete a GKE cluster")

    parser = modify_parser(parser)

    args = parser.parse_args()

    print(args)

    if not hasattr(args, "command") or not args.command:
        args.command = "create"

    if args.debug:
        logger.setLevel(logging.DEBUG)

    if not check_gcloud_auth():
        sys.exit(1)

    if not check_project(args.project_id):
        sys.exit(1)

    if args.command == "create":
        enable_required_apis(args.project_id)

        if create_gke_cluster(args):
            logger.info("GKE cluster setup completed successfully.")
            sys.exit(0)
        else:
            logger.error("GKE cluster setup failed.")
            sys.exit(1)

    elif args.command == "delete":
        if delete_gke_cluster(args):
            logger.info("GKE cluster deletion completed successfully.")
            sys.exit(0)
        else:
            logger.error("GKE cluster deletion failed.")
            sys.exit(1)
    else:
        logger.error(f"Unknown command: {args.command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
