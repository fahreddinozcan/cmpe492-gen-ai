from fastapi import (
    FastAPI,
    HTTPException,
    BackgroundTasks,
    Depends,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
import logging
import asyncio
import json
import subprocess
from datetime import datetime
import os
import uuid
from argparse import Namespace
import sys
import re
import threading
import queue
import requests
from urllib.parse import quote, urlencode
import re
import time

# Google Cloud libraries
from google.auth import default
from google.auth.transport.requests import Request as GoogleAuthRequest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from deployment.deploy_vllm import deploy_vllm, delete_deployment, list_deployments
from deployment.utils.command import run_command
from gcloud.main import (
    check_gcloud_auth,
    check_project,
    enable_required_apis,
    create_gke_cluster,
    delete_gke_cluster,
    list_gcp_projects,
)


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vllm-api")

app = FastAPI(title="vLLM Deployment API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize the application on startup"""
    logger.info("Initializing deployments...")
    await initialize_deployments()


class DeploymentRequest(BaseModel):
    model_path: str = Field(..., description="Model path or Hugging Face model ID")
    release_name: str = Field(..., description="Name for the deployment")
    namespace: str = Field("vllm", description="Kubernetes namespace")
    cluster_id: Optional[str] = Field(
        None, description="Target cluster ID for deployment"
    )
    hf_token: Optional[str] = Field(None, description="Hugging Face token")
    gpu_type: str = Field("nvidia-l4", description="GPU type")
    cpu_count: int = Field(2, description="CPU count")
    memory: str = Field("8Gi", description="Memory")
    gpu_count: int = Field(1, description="GPU count")
    environment: str = Field("dev", description="Deployment environment")
    image_repo: str = Field("vllm/vllm-openai", description="Image repo")
    image_tag: str = Field("latest", description="Image tag")
    dtype: str = Field("bfloat16", description="Model dtype")
    tensor_parallel_size: int = Field(1, description="Tensor parallel size")
    enable_chunked_prefill: bool = Field(False, description="Enable chunked prefill")
    debug: bool = Field(False, description="Enable debug output")
    helm_args: Optional[str] = Field(None, description="Additional Helm arguments")


class UpdateDeploymentRequest(BaseModel):
    gpu_count: Optional[int] = Field(None, description="GPU count")
    cpu_count: Optional[int] = Field(None, description="CPU count")
    memory: Optional[str] = Field(None, description="Memory allocation")
    image_tag: Optional[str] = Field(None, description="Image tag")
    replicas: Optional[int] = Field(None, description="Number of replicas")
    tensor_parallel_size: Optional[int] = Field(
        None, description="Tensor parallel size"
    )
    enable_chunked_prefill: Optional[bool] = Field(
        None, description="Enable chunked prefill"
    )
    helm_args: Optional[str] = Field(None, description="Additional Helm arguments")


class DeploymentResponse(BaseModel):
    success: bool
    message: str
    service_url: Optional[str] = None
    deployment_id: Optional[str] = None


class DeploymentListItem(BaseModel):
    deployment_id: str
    name: str
    namespace: str
    status: str
    model: str
    created_at: str
    ready: bool = False
    health_status: str = "unknown"


class DeploymentStatus(BaseModel):
    deployment_id: str
    name: str
    namespace: str
    status: str
    model: str
    created_at: str
    updated_at: Optional[str] = None
    gpu_count: int
    cpu_count: int
    memory: str
    image: str
    service_url: str
    external_ip: Optional[str] = None
    public_url: Optional[str] = None
    ready: bool = False
    health_status: str = (
        "unknown"  # Can be "healthy", "unhealthy", "starting", "unknown"
    )
    # pod_status is removed as we don't want to expose pod details to the UI


class DeploymentLog(BaseModel):
    pod_name: str
    container_name: str
    log: str
    timestamp: str


class MetricsResponse(BaseModel):
    success: bool
    message: str
    metrics: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None


class DeploymentMetricsRequest(BaseModel):
    namespace: str = Field(..., description="Kubernetes namespace")
    release_name: str = Field(..., description="Release name of the deployment")
    metric_names: Optional[List[str]] = Field(
        None, description="List of metric names to fetch"
    )
    time_range_minutes: Optional[int] = Field(
        30, description="Time range in minutes for metrics query"
    )
    use_range_query: Optional[bool] = Field(
        False, description="Use range query instead of instant query"
    )


active_deployments = {}

# Store active cluster operations
active_clusters = {}

# Store cluster logs
cluster_logs = {}

# Cache for metrics to avoid too frequent requests
metrics_cache = {}

# Log queue for WebSocket connections
log_queue = {}


def parse_prometheus_metrics(metrics_text: str) -> Dict[str, Any]:
    """
    Parse Prometheus metrics format into a structured dictionary

    Example input:
    # HELP vllm_request_success_count Number of successful requests
    # TYPE vllm_request_success_count counter
    vllm_request_success_count 42

    Example output:
    {
        "vllm_request_success_count": {
            "value": 42.0,
            "help": "Number of successful requests",
            "type": "counter"
        }
    }
    """
    result = {}
    current_metric = None
    current_help = None
    current_type = None

    for line in metrics_text.split("\n"):
        line = line.strip()
        if not line:
            continue

        # Parse HELP comments
        if line.startswith("# HELP "):
            parts = line[len("# HELP ") :].split(" ", 1)
            if len(parts) == 2:
                metric_name, help_text = parts
                current_metric = metric_name
                current_help = help_text

        # Parse TYPE comments
        elif line.startswith("# TYPE "):
            parts = line[len("# TYPE ") :].split(" ", 1)
            if len(parts) == 2:
                metric_name, type_text = parts
                current_metric = metric_name
                current_type = type_text

        # Parse actual metric values
        elif not line.startswith("#"):
            # Handle metrics with labels
            if "{" in line:
                metric_with_labels, value_str = line.rsplit(" ", 1)
                metric_name = metric_with_labels.split("{")[0]

                # Extract labels
                labels_str = metric_with_labels.split("{")[1].split("}")[0]
                labels = {}
                for label_pair in labels_str.split(","):
                    if "=" in label_pair:
                        k, v = label_pair.split("=", 1)
                        labels[k] = v.strip('"')

                # Create a unique key for this metric with its labels
                label_key = json.dumps(labels, sort_keys=True)
                full_key = f"{metric_name}[{label_key}]"

                try:
                    result[full_key] = {"value": float(value_str), "labels": labels}
                    if current_help:
                        result[full_key]["help"] = current_help
                    if current_type:
                        result[full_key]["type"] = current_type
                except ValueError:
                    # Skip metrics with non-numeric values
                    pass
            else:
                # Simple metrics without labels
                parts = line.split(" ")
                if len(parts) >= 2:
                    metric_name = parts[0]
                    try:
                        value = float(parts[1])
                        result[metric_name] = {"value": value}
                        if current_help:
                            result[metric_name]["help"] = current_help
                        if current_type:
                            result[metric_name]["type"] = current_type
                    except ValueError:
                        # Skip metrics with non-numeric values
                        pass

    return result


async def fetch_deployment_metrics(namespace: str, release_name: str) -> Dict[str, Any]:
    """
    Fetch metrics for a specific deployment

    First tries to get the service URL, then fetches metrics from the /metrics endpoint
    """
    try:
        # Get the service URL
        service_cmd = f"kubectl get svc -n {namespace} -l release={release_name} -o jsonpath='{{.items[0].status.loadBalancer.ingress[0].ip}}'"
        result = await asyncio.to_thread(
            lambda: subprocess.run(
                service_cmd, shell=True, text=True, capture_output=True
            )
        )

        if result.returncode != 0 or not result.stdout.strip():
            # Try to port-forward to the service
            logger.info(
                f"No external IP found for {release_name}, trying to port-forward"
            )

            # Get the pod name
            pod_cmd = f"kubectl get pods -n {namespace} -l release={release_name} -o jsonpath='{{.items[0].metadata.name}}'"
            pod_result = await asyncio.to_thread(
                lambda: subprocess.run(
                    pod_cmd, shell=True, text=True, capture_output=True
                )
            )

            if pod_result.returncode != 0 or not pod_result.stdout.strip():
                return {
                    "error": f"Failed to find pods for {release_name}: {pod_result.stderr}"
                }

            pod_name = pod_result.stdout.strip()

            # Port-forward to the pod
            port = 8000  # Default vLLM port
            port_forward_cmd = (
                f"kubectl port-forward -n {namespace} {pod_name} {port}:{port}"
            )

            # Start port-forwarding in the background
            port_forward_process = await asyncio.create_subprocess_shell(
                port_forward_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # Give it a moment to establish the connection
            await asyncio.sleep(2)

            try:
                # Fetch metrics from the forwarded port
                metrics_url = f"http://localhost:{port}/metrics"
                response = await asyncio.to_thread(
                    lambda: requests.get(metrics_url, timeout=5)
                )

                if response.status_code == 200:
                    metrics = parse_prometheus_metrics(response.text)

                    # Add summary metrics
                    summary = calculate_summary_metrics(metrics)

                    return {"metrics": metrics, "summary": summary}
                else:
                    return {
                        "error": f"Failed to fetch metrics: HTTP {response.status_code}"
                    }
            finally:
                # Clean up the port-forwarding process
                try:
                    port_forward_process.terminate()
                    await port_forward_process.wait()
                except Exception as e:
                    logger.error(f"Error terminating port-forward: {str(e)}")
        else:
            # We have an external IP, use it directly
            external_ip = result.stdout.strip()
            metrics_url = f"http://{external_ip}/metrics"

            response = await asyncio.to_thread(
                lambda: requests.get(metrics_url, timeout=5)
            )

            if response.status_code == 200:
                metrics = parse_prometheus_metrics(response.text)

                # Add summary metrics
                summary = calculate_summary_metrics(metrics)

                return {"metrics": metrics, "summary": summary}
            else:
                return {
                    "error": f"Failed to fetch metrics: HTTP {response.status_code}"
                }
    except Exception as e:
        logger.error(f"Error fetching metrics: {str(e)}")
        return {"error": f"Error fetching metrics: {str(e)}"}


def calculate_summary_metrics(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate summary metrics from the raw metrics
    """
    summary = {}

    # Request counts
    success_count = 0
    failure_count = 0
    total_count = 0

    for metric_name, metric_data in metrics.items():
        if "vllm_request_success_count" in metric_name:
            success_count += metric_data.get("value", 0)
        elif "vllm_request_failure_count" in metric_name:
            failure_count += metric_data.get("value", 0)
        elif (
            "vllm_request_count" in metric_name
            and "success" not in metric_name
            and "failure" not in metric_name
        ):
            total_count += metric_data.get("value", 0)

    # If total_count is 0 but we have success or failure counts, use their sum
    if total_count == 0 and (success_count > 0 or failure_count > 0):
        total_count = success_count + failure_count

    if total_count > 0:
        summary["total_requests"] = total_count
        summary["success_rate"] = (success_count / total_count) * 100

    # Token generation
    generated_tokens = 0
    prompt_tokens = 0

    for metric_name, metric_data in metrics.items():
        if "vllm_generated_tokens_count" in metric_name:
            generated_tokens += metric_data.get("value", 0)
        elif "vllm_prompt_tokens_count" in metric_name:
            prompt_tokens += metric_data.get("value", 0)

    if generated_tokens > 0:
        summary["generated_tokens"] = generated_tokens
    if prompt_tokens > 0:
        summary["prompt_tokens"] = prompt_tokens

    # GPU metrics
    gpu_memory = None
    gpu_util = None

    for metric_name, metric_data in metrics.items():
        if "gpu_memory_used" in metric_name:
            gpu_memory = metric_data.get("value", 0)
        elif "gpu_utilization" in metric_name:
            gpu_util = metric_data.get("value", 0)

    if gpu_memory is not None:
        summary["gpu_memory_used_gb"] = gpu_memory / 1024 / 1024 / 1024
    if gpu_util is not None:
        summary["gpu_utilization"] = gpu_util

    return summary


async def initialize_deployments():
    """Initialize the active_deployments dictionary with existing deployments"""
    global active_deployments
    # Ensure active_deployments is initialized as an empty dict
    if not isinstance(active_deployments, dict):
        active_deployments = {}

    try:
        # First check if kubectl is available and we can access the cluster
        # Use a timeout to prevent hanging indefinitely
        logger.info("Checking for Kubernetes cluster access...")
        try:
            check_cmd = "kubectl cluster-info"
            # Use a timeout to prevent hanging
            process = await asyncio.create_subprocess_shell(
                check_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # Wait for the process with a timeout
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=5.0
                )
                kubectl_available = process.returncode == 0
            except asyncio.TimeoutError:
                logger.warning("kubectl command timed out. Assuming no cluster access.")
                kubectl_available = False
                # Ensure we don't leave zombie processes
                try:
                    process.kill()
                except ProcessLookupError:
                    pass
        except (FileNotFoundError, PermissionError) as e:
            logger.warning(f"kubectl command not available: {str(e)}")
            kubectl_available = False

        if not kubectl_available:
            logger.warning(
                "No Kubernetes cluster access available. Skipping deployment initialization."
            )
            logger.info("Initialized with empty deployments list")
            return

        # Get all namespaces with timeout
        try:
            ns_cmd = "kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'"
            ns_process = await asyncio.create_subprocess_shell(
                ns_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    ns_process.communicate(), timeout=5.0
                )
                if ns_process.returncode == 0 and stdout:
                    namespaces = stdout.decode().strip().split()
                else:
                    logger.warning(
                        f"Failed to get namespaces: {stderr.decode() if stderr else 'No output'}"
                    )
                    namespaces = []
            except asyncio.TimeoutError:
                logger.warning("namespace command timed out")
                try:
                    ns_process.kill()
                except ProcessLookupError:
                    pass
                namespaces = []
        except Exception as e:
            logger.error(f"Error getting namespaces: {str(e)}")
            namespaces = []

        # For each namespace, get the deployments
        for namespace in namespaces:
            try:
                helm_cmd = f"helm list -n {namespace} -o json"
                helm_process = await asyncio.create_subprocess_shell(
                    helm_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                try:
                    stdout, stderr = await asyncio.wait_for(
                        helm_process.communicate(), timeout=5.0
                    )
                    if helm_process.returncode == 0 and stdout:
                        try:
                            helm_releases = json.loads(stdout.decode())

                            for release in helm_releases:
                                release_name = release.get("name")
                                release_namespace = release.get("namespace", namespace)

                                # Check if it's a vLLM deployment
                                if release_name and (
                                    "vllm" in release.get("chart", "").lower()
                                    or "llm" in release_name.lower()
                                ):
                                    # Generate a deterministic deployment ID based on namespace and release name
                                    unique_key = f"{release_namespace}:{release_name}"
                                    deployment_id = str(
                                        uuid.uuid5(uuid.NAMESPACE_DNS, unique_key)
                                    )

                                    # Get enhanced status with timeout
                                    try:
                                        status = await asyncio.wait_for(
                                            get_enhanced_deployment_status(
                                                release_namespace, release_name
                                            ),
                                            timeout=5.0,
                                        )
                                    except asyncio.TimeoutError:
                                        logger.warning(
                                            f"Timeout getting status for {release_name} in {release_namespace}"
                                        )
                                        status = {}

                                    # Add to active_deployments
                                    active_deployments[deployment_id] = {
                                        "release_name": release_name,
                                        "namespace": release_namespace,
                                        "status": status.get("status", "unknown"),
                                        "model_path": status.get("model", "unknown"),
                                        "created_at": release.get(
                                            "updated", datetime.now().isoformat()
                                        ),
                                        "llm_ready": status.get("llm_ready", False),
                                        "llm_status": status.get(
                                            "llm_status", "unknown"
                                        ),
                                        "gpu_count": status.get("gpu_count", 1),
                                        "cpu_count": status.get("cpu_count", 2),
                                        "memory": status.get("memory", "8Gi"),
                                        "image": status.get(
                                            "image", "vllm/vllm-openai:latest"
                                        ),
                                    }

                                    logger.info(
                                        f"Initialized deployment {release_name} in namespace {release_namespace} with ID {deployment_id}"
                                    )
                        except json.JSONDecodeError as e:
                            logger.error(
                                f"Error parsing Helm JSON in namespace {namespace}: {str(e)}"
                            )
                except asyncio.TimeoutError:
                    logger.warning(f"Helm command timed out for namespace {namespace}")
                    try:
                        helm_process.kill()
                    except ProcessLookupError:
                        pass
            except Exception as e:
                logger.error(f"Error processing namespace {namespace}: {str(e)}")

        logger.info(f"Initialized {len(active_deployments)} deployments")
    except Exception as e:
        logger.error(f"Error initializing deployments: {str(e)}")
        logger.info("Continuing with empty deployments list")


@app.get("/api/deployments/{deployment_id}/metrics", response_model=MetricsResponse)
async def get_deployment_metrics(deployment_id: str):
    """
    Get metrics for a specific deployment
    """
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Check if we have recent metrics in cache (less than 10 seconds old)
    cache_key = f"{namespace}:{release_name}"
    current_time = datetime.now()

    if cache_key in metrics_cache:
        cache_entry = metrics_cache[cache_key]
        cache_age = (current_time - cache_entry["timestamp"]).total_seconds()

        if cache_age < 10:  # Use cached metrics if less than 10 seconds old
            return MetricsResponse(
                success=True,
                message="Metrics retrieved from cache",
                metrics=cache_entry["data"],
                timestamp=cache_entry["timestamp"].isoformat(),
            )

    # Fetch fresh metrics
    metrics_data = await fetch_deployment_metrics(namespace, release_name)

    # Update cache
    metrics_cache[cache_key] = {"data": metrics_data, "timestamp": current_time}

    return MetricsResponse(
        success=True,
        message="Metrics retrieved successfully",
        metrics=metrics_data,
        timestamp=current_time.isoformat(),
    )


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.log_tasks: Dict[str, asyncio.Task] = {}

    async def connect(
        self, websocket: WebSocket, deployment_id: str, pod_type: str = None
    ):
        await websocket.accept()
        if deployment_id not in self.active_connections:
            self.active_connections[deployment_id] = []
        self.active_connections[deployment_id].append(websocket)

        if deployment_id not in self.log_tasks or self.log_tasks[deployment_id].done():
            deployment = active_deployments.get(deployment_id)
            if deployment:
                self.log_tasks[deployment_id] = asyncio.create_task(
                    self.stream_logs(
                        deployment_id,
                        deployment["namespace"],
                        deployment["release_name"],
                        pod_type,
                    )
                )

    def disconnect(self, websocket: WebSocket, deployment_id: str):
        if deployment_id in self.active_connections:
            self.active_connections[deployment_id].remove(websocket)
            if (
                not self.active_connections[deployment_id]
                and deployment_id in self.log_tasks
            ):
                self.log_tasks[deployment_id].cancel()
                del self.log_tasks[deployment_id]
                del self.active_connections[deployment_id]

    async def send_message(self, message: str, deployment_id: str):
        if deployment_id in self.active_connections:
            disconnected_websockets = []
            for websocket in self.active_connections[deployment_id]:
                try:
                    await websocket.send_text(message)
                except Exception as e:
                    logger.error(f"Error sending message: {e}")
                    disconnected_websockets.append(websocket)
            for websocket in disconnected_websockets:
                self.disconnect(websocket, deployment_id)

    async def stream_logs(
        self,
        deployment_id: str,
        namespace: str,
        release_name: str,
        pod_type: str = None,
    ):
        try:
            # Get all pods in the namespace
            pod_cmd = f"kubectl get pods -n {namespace} -o json"
            result = await asyncio.to_thread(
                lambda: subprocess.run(
                    pod_cmd, shell=True, text=True, capture_output=True
                )
            )

            if result.returncode != 0:
                await self.send_message(
                    json.dumps({"error": f"Failed to get pods: {result.stderr}"}),
                    deployment_id,
                )
                return

            # Parse the JSON and filter for pods that belong to this deployment
            pod_names = []
            try:
                pods_data = json.loads(result.stdout)
                for pod in pods_data.get("items", []):
                    pod_name = pod["metadata"]["name"]
                    # Filter for pods that belong to this deployment
                    if release_name in pod_name:
                        # Filter by pod type if specified
                        if (
                            pod_type == "vllm"
                            and "-vllm-" in pod_name
                            and "-router-" not in pod_name
                        ):
                            pod_names.append(pod_name)
                            logger.info(
                                f"Found vLLM pod for streaming logs from deployment {release_name}: {pod_name}"
                            )
                        elif pod_type == "router" and "-router-" in pod_name:
                            pod_names.append(pod_name)
                            logger.info(
                                f"Found router pod for streaming logs from deployment {release_name}: {pod_name}"
                            )
                        elif pod_type is None:
                            # If no pod_type specified, include all pods
                            pod_names.append(pod_name)
                            logger.info(
                                f"Found pod for streaming logs from deployment {release_name}: {pod_name}"
                            )
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse pods JSON: {str(e)}")
                await self.send_message(
                    json.dumps({"error": f"Failed to parse pods data: {str(e)}"}),
                    deployment_id,
                )
                return

            if not pod_names:
                await self.send_message(
                    json.dumps({"error": "No pods found"}), deployment_id
                )
                return

            for pod_name in pod_names:
                log_cmd = f"kubectl logs -n {namespace} {pod_name} -f"
                process = await asyncio.create_subprocess_shell(
                    log_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                # Start a task to stream stdout
                async def read_stream(stream):
                    while True:
                        line = await stream.readline()
                        if not line:
                            break

                        log_entry = {
                            "pod_name": pod_name,
                            "container_name": "vllm",
                            "log": line.decode().strip(),
                            "timestamp": datetime.now().isoformat(),
                        }

                        await self.send_message(json.dumps(log_entry), deployment_id)

                stdout_task = asyncio.create_task(read_stream(process.stdout))
                stderr_task = asyncio.create_task(read_stream(process.stderr))

                # Wait for the process to complete
                await process.wait()
                await stdout_task
                await stderr_task

        except asyncio.CancelledError:
            logger.info(f"Log streaming cancelled for deployment {deployment_id}")
            raise
        except Exception as e:
            logger.error(f"Error streaming logs: {str(e)}")
            await self.send_message(
                json.dumps({"error": f"Log streaming error: {str(e)}"}), deployment_id
            )


manager = ConnectionManager()


@app.websocket("/ws/logs/{deployment_id}")
async def websocket_logs(
    websocket: WebSocket, deployment_id: str, pod_type: str = None
):
    try:
        await manager.connect(websocket, deployment_id, pod_type)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, deployment_id)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await manager.disconnect(websocket, deployment_id)


@app.post("/deployments/", response_model=DeploymentResponse)
async def create_deployment(
    request: DeploymentRequest, background_tasks: BackgroundTasks
):
    try:
        logger.info(f"Creating deployment for model {request.model_path}")

        # If a specific cluster is requested, set the kubernetes context first
        if request.cluster_id:
            logger.info(f"Setting Kubernetes context for cluster {request.cluster_id}")
            # Get cluster information
            if request.cluster_id not in active_clusters:
                raise HTTPException(
                    status_code=404,
                    detail=f"Cluster with ID {request.cluster_id} not found",
                )

            cluster = active_clusters[request.cluster_id]

            # Set the kubectl context to use this cluster
            try:
                # Get GKE credentials for the cluster
                cmd = f"gcloud container clusters get-credentials {cluster['cluster_name']} --project={cluster['project_id']} --zone={cluster['zone']}"
                logger.info(f"Running command: {cmd}")
                result = subprocess.run(
                    cmd, shell=True, check=True, text=True, capture_output=True
                )
                logger.info(f"Successfully set Kubernetes context: {result.stdout}")
            except subprocess.CalledProcessError as e:
                error_msg = f"Failed to set Kubernetes context: {e.stderr}"
                logger.error(error_msg)
                raise HTTPException(status_code=500, detail=error_msg)

        # Generate a deterministic deployment ID based only on release name
        # This ensures the same deployment gets the same ID across server restarts
        # Using release name as the namespace for better isolation
        unique_key = f"{request.release_name}:{request.release_name}"
        deployment_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_key))
        logger.info(f"Deployment ID: {deployment_id}")

        args = Namespace(
            model_path=request.model_path,
            release_name=request.release_name,
            namespace=request.release_name,  # Use release name as namespace for isolation
            hf_token=request.hf_token,
            gpu_type=request.gpu_type,
            cpu_count=request.cpu_count,
            memory=request.memory,
            gpu_count=request.gpu_count,
            environment=request.environment,
            image_repo=request.image_repo,
            image_tag=request.image_tag,
            dtype=request.dtype,
            tensor_parallel_size=request.tensor_parallel_size,
            enable_chunked_prefill=request.enable_chunked_prefill,
            debug=request.debug,
            helm_args=request.helm_args,
            chart_path=os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "vllm-stack")
            ),
            command="deploy",
        )

        active_deployments[deployment_id] = {
            "id": deployment_id,
            "release_name": request.release_name,
            "namespace": request.release_name,  # Using release name as namespace
            "model_path": request.model_path,
            "created_at": datetime.now().isoformat(),
            "status": "creating",
            "gpu_count": request.gpu_count,
            "cpu_count": request.cpu_count,
            "memory": request.memory,
            "image": f"{request.image_repo}:{request.image_tag}",
        }

        def _deploy():
            try:
                success = deploy_vllm(args)
                active_deployments[deployment_id]["status"] = (
                    "deployed" if success else "failed"
                )
            except Exception as e:
                logger.error(f"Deployment error in background task: {str(e)}")
                active_deployments[deployment_id]["status"] = "failed"
                active_deployments[deployment_id]["error"] = str(e)

        background_tasks.add_task(_deploy)

        service_url = f"{request.release_name}.{request.release_name}.svc.cluster.local"
        print(
            DeploymentResponse(
                success=True,
                message=f"Deployment started successfully",
                service_url=service_url,
                deployment_id=deployment_id,
            )
        )
        return DeploymentResponse(
            success=True,
            message=f"Deployment started successfully",
            service_url=service_url,
            deployment_id=deployment_id,
        )

    except Exception as e:
        logger.error(f"Error creating deployment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def get_deployment_status(namespace: str, release_name: str) -> Dict[str, Any]:
    """Get detailed status of a specific vLLM deployment including all pod statuses"""
    try:
        # Get model pod (the one that actually runs the model)
        model_pod_cmd = f"kubectl get pods -n {namespace} -l model --field-selector metadata.name=~{release_name}-.* -o json"
        model_pod_result = await asyncio.to_thread(
            lambda: subprocess.run(
                model_pod_cmd, shell=True, text=True, capture_output=True
            )
        )

        # If no model pod found, try with a broader selector
        if model_pod_result.returncode != 0 or not json.loads(
            model_pod_result.stdout
        ).get("items"):
            # Try with a broader approach - get all pods with the release name
            pod_cmd = f"kubectl get pods -n {namespace} -o json"
            pod_result = await asyncio.to_thread(
                lambda: subprocess.run(
                    pod_cmd, shell=True, text=True, capture_output=True
                )
            )

            if pod_result.returncode != 0:
                return {
                    "name": release_name,
                    "namespace": namespace,
                    "status": "Error",
                    "model": "unknown",
                    "error": f"Failed to get pods: {pod_result.stderr}",
                }

            pods_data = json.loads(pod_result.stdout)

            # Filter for pods that match our deployment
            vllm_pods = []
            router_pods = []
            model_pods = []

            for pod in pods_data.get("items", []):
                pod_name = pod["metadata"]["name"]

                # Check for deployment pods by name patterns
                if pod_name.startswith(f"{release_name}-"):
                    vllm_pods.append(pod)

                    # Identify router pods
                    if "router" in pod_name:
                        router_pods.append(pod)
                    # Identify model pods (usually contain "vllm" or model name)
                    elif any(
                        marker in pod_name.lower() for marker in ["vllm", "deployment"]
                    ):
                        model_pods.append(pod)
        else:
            # Parse the model pod data
            model_pods = json.loads(model_pod_result.stdout).get("items", [])

            # Get router pods separately
            router_pod_cmd = f"kubectl get pods -n {namespace} -l app=router --field-selector metadata.name=~{release_name}-.* -o json"
            router_pod_result = await asyncio.to_thread(
                lambda: subprocess.run(
                    router_pod_cmd, shell=True, text=True, capture_output=True
                )
            )

            router_pods = []
            if router_pod_result.returncode == 0:
                router_pods = json.loads(router_pod_result.stdout).get("items", [])

            # Combine all pods for overall status
            vllm_pods = model_pods + router_pods

        # Get deployment details from Helm
        helm_cmd = f"helm get values -n {namespace} {release_name} -o json"
        helm_result = await asyncio.to_thread(
            lambda: subprocess.run(helm_cmd, shell=True, text=True, capture_output=True)
        )

        model = "unknown"
        gpu_count = 0
        cpu_count = 0
        memory = ""
        image = "unknown"
        created_at = None

        if helm_result.returncode == 0 and helm_result.stdout:
            try:
                values = json.loads(helm_result.stdout)
                # Try to get model information from different possible locations in Helm values
                if (
                    "servingEngineSpec" in values
                    and "modelSpec" in values["servingEngineSpec"]
                ):
                    model_spec = values["servingEngineSpec"]["modelSpec"][0]
                    model = model_spec.get("modelURL", "unknown")
                    gpu_count = model_spec.get("requestGPU", 0)
                    cpu_count = model_spec.get("requestCPU", 0)
                    memory = model_spec.get("requestMemory", "")
                # Check for model information in other common locations
                elif "model" in values:
                    # Direct model field
                    model = values["model"]
                    # Try to get resource information
                    gpu_count = values.get("gpu_count", values.get("gpuCount", 0))
                    cpu_count = values.get("cpu_count", values.get("cpuCount", 0))
                    memory = values.get("memory", "")
                elif "modelPath" in values:
                    # Another common field name
                    model = values["modelPath"]
                    gpu_count = values.get("gpuCount", 0)
                    cpu_count = values.get("cpuCount", 0)
                    memory = values.get("memory", "")
                # Look for model information in any field that might contain it
                else:
                    # Search for any field that might contain model information
                    for key, value in values.items():
                        if isinstance(value, str) and ("model" in key.lower() or "path" in key.lower()):
                            model = value
                            break
                        elif isinstance(value, dict):
                            # Check one level deeper
                            for subkey, subvalue in value.items():
                                if isinstance(subvalue, str) and ("model" in subkey.lower() or "path" in subkey.lower()):
                                    model = subvalue
                                    break
                            if model != "unknown":
                                break
                
                # If we still don't have model info, try to extract from image name
                if model == "unknown" and image != "unknown":
                    # Sometimes the model name is part of the image tag
                    image_parts = image.split(":")
                    if len(image_parts) > 1 and image_parts[1] != "latest":
                        model = image_parts[1]
                
                # Log the values we found for debugging
                logger.info(f"Model info for {release_name}: model={model}, gpu={gpu_count}, cpu={cpu_count}, memory={memory}")
                
            except json.JSONDecodeError:
                logger.error(f"Failed to parse Helm values JSON for {release_name}")
            except Exception as e:
                logger.error(f"Error extracting model info from Helm values: {str(e)}")

        # Determine detailed status
        pod_status = {}
        model_pod_status = "Unknown"
        router_pod_status = "Unknown"

        # Get the earliest creation timestamp
        for pod in vllm_pods:
            pod_name = pod["metadata"]["name"]
            phase = pod["status"]["phase"]
            conditions = pod["status"].get("conditions", [])

            # More detailed status
            detailed_status = phase
            for condition in conditions:
                if (
                    condition.get("type") == "Ready"
                    and not condition.get("status") == "True"
                ):
                    detailed_status = f"{phase} (Not Ready)"
                    break

            pod_status[pod_name] = detailed_status

            # Track creation time
            pod_created = pod["metadata"]["creationTimestamp"]
            if not created_at or pod_created < created_at:
                created_at = pod_created

            # Get image from model pod
            if "vllm" in pod_name.lower() or "deployment" in pod_name.lower():
                if "containers" in pod["spec"] and pod["spec"]["containers"]:
                    image = pod["spec"]["containers"][0]["image"]

        # Determine status of model pods vs router pods
        if model_pods:
            model_statuses = [pod["status"]["phase"] for pod in model_pods]
            model_pod_status = (
                "Running"
                if all(status == "Running" for status in model_statuses)
                else "Pending"
            )

        if router_pods:
            router_statuses = [pod["status"]["phase"] for pod in router_pods]
            router_pod_status = (
                "Running"
                if all(status == "Running" for status in router_statuses)
                else "Pending"
            )

        # Combined status
        if model_pod_status == "Running" and router_pod_status == "Running":
            overall_status = "Running"
        elif model_pod_status == "Running":
            overall_status = "Model Ready (Router Pending)"
        elif router_pod_status == "Running":
            overall_status = "Router Ready (Model Pending)"
        elif not vllm_pods:
            overall_status = "No Pods Found"
        else:
            overall_status = "Pending"

        service_url = f"{release_name}-router-service.{namespace}.svc.cluster.local"
        public_url = None
        external_ip = None

        # Get service info
        service_cmd = (
            f"kubectl get service {release_name}-router-service -n {namespace} -o json"
        )
        service_result = await asyncio.to_thread(
            lambda: subprocess.run(
                service_cmd, shell=True, text=True, capture_output=True
            )
        )

        if service_result.returncode == 0:
            try:
                service_data = json.loads(service_result.stdout)
                service_type = service_data.get("spec", {}).get("type", "")

                # Check if LoadBalancer has an assigned external IP
                if service_type == "LoadBalancer":
                    ingress = (
                        service_data.get("status", {})
                        .get("loadBalancer", {})
                        .get("ingress", [])
                    )
                    if ingress and "hostname" in ingress[0]:
                        external_ip = ingress[0]["hostname"]
                        public_url = f"http://{external_ip}"
                        logger.info(
                            f"Found external hostname for {release_name}: {external_ip}"
                        )
                    elif ingress and "ip" in ingress[0]:
                        external_ip = ingress[0]["ip"]
                        public_url = f"http://{external_ip}"
                        logger.info(
                            f"Found external IP for {release_name}: {external_ip}"
                        )
            except json.JSONDecodeError:
                logger.error("Failed to parse service JSON")

        return {
            "name": release_name,
            "namespace": namespace,
            "status": overall_status,
            "model_pod_status": model_pod_status,
            "router_pod_status": router_pod_status,
            "model": model,
            "created_at": created_at,
            "gpu_count": gpu_count,
            "cpu_count": cpu_count,
            "memory": memory,
            "image": image,
            "service_url": service_url,
            "public_url": public_url,
            "pod_status": pod_status,
        }

    except Exception as e:
        logger.error(f"Error getting deployment status: {str(e)}")
        logger.exception(e)
        return {
            "name": release_name,
            "namespace": namespace,
            "status": "Error",
            "model": "unknown",
            "error": str(e),
        }


async def get_enhanced_deployment_status(
    namespace: str, release_name: str
) -> Dict[str, Any]:
    """Get detailed status of a vLLM deployment including readiness for serving"""

    # First get basic deployment status
    deployment_status = await get_deployment_status(namespace, release_name)

    # Default LLM readiness
    deployment_status["llm_ready"] = False
    deployment_status["llm_status"] = "Initializing"
    deployment_status["ui_status"] = "pending"  # Options: active, pending, failed

    # Check if all pods are running and ready
    # First, get all pods for this deployment
    pods_cmd = f"kubectl get pods -n {namespace} -o json"
    pods_result = await asyncio.to_thread(
        lambda: subprocess.run(pods_cmd, shell=True, text=True, capture_output=True)
    )

    # Get the external IP from the LoadBalancer service
    external_ip = None
    try:
        # Get service details to check for LoadBalancer external IP
        cmd = (
            f"kubectl get service {release_name}-router-service -n {namespace} -o json"
        )
        logger.info(f"Running command to get service details: {cmd}")
        result = await asyncio.to_thread(
            lambda: subprocess.run(cmd, shell=True, text=True, capture_output=True)
        )

        if result.returncode != 0:
            logger.error(
                f"Command failed with return code {result.returncode}: {result.stderr}"
            )
        else:
            logger.info(f"Successfully retrieved service details for {release_name}")

        service_json = json.loads(result.stdout)

        # Log the service type
        service_type = service_json.get("spec", {}).get("type")
        logger.info(f"Service type for {release_name}: {service_type}")

        # Check if it's a LoadBalancer and has an external IP
        if service_type == "LoadBalancer":
            # Log the loadBalancer status
            load_balancer = service_json.get("status", {}).get("loadBalancer", {})
            logger.info(f"LoadBalancer status: {load_balancer}")

            ingress = load_balancer.get("ingress", [])
            logger.info(f"Ingress entries: {ingress}")

            if ingress:
                logger.info(f"First ingress entry: {ingress[0]}")

                if "hostname" in ingress[0]:
                    external_ip = ingress[0]["hostname"]
                    logger.info(
                        f"Found external hostname for {release_name}: {external_ip}"
                    )
                elif "ip" in ingress[0]:
                    external_ip = ingress[0]["ip"]
                    logger.info(f"Found external IP for {release_name}: {external_ip}")
                else:
                    logger.warning(
                        f"Ingress entry exists but contains neither hostname nor ip: {ingress[0]}"
                    )
            else:
                logger.warning(
                    f"No ingress entries found for LoadBalancer service {release_name}-router-service"
                )
        else:
            logger.warning(
                f"Service {release_name}-router-service is not of type LoadBalancer, but {service_type}"
            )

        # Add external_ip to deployment_status
        logger.info(f"Setting external_ip to: {external_ip}")
        deployment_status["external_ip"] = external_ip
    except Exception as e:
        logger.error(f"Error getting external IP: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())

    all_pods_ready = False
    if pods_result.returncode == 0 and pods_result.stdout:
        try:
            pods_data = json.loads(pods_result.stdout)
            deployment_pods = []

            # Find pods that belong to this deployment
            for pod in pods_data.get("items", []):
                pod_name = pod["metadata"]["name"]
                if release_name in pod_name:
                    deployment_pods.append(pod)

            # Check if all pods are running and ready
            if deployment_pods:
                all_running = True
                all_ready = True

                for pod in deployment_pods:
                    # Check if running
                    if pod["status"]["phase"] != "Running":
                        all_running = False
                        break

                    # Check if ready
                    if "containerStatuses" in pod["status"]:
                        for container in pod["status"]["containerStatuses"]:
                            if not container.get("ready", False):
                                all_ready = False
                                break
                    else:
                        all_ready = False

                if all_running and all_ready:
                    all_pods_ready = True
                    logger.info(f"All pods for {release_name} are running and ready")
        except Exception as e:
            logger.error(f"Error checking pod readiness: {str(e)}")

    # If all pods are ready, we can assume the LLM is ready
    if all_pods_ready:
        deployment_status["llm_ready"] = True
        deployment_status["llm_status"] = "Ready"
        deployment_status["ui_status"] = "active"
        return deployment_status

    # If deployment is not running, we already know LLM is not ready
    if deployment_status["status"] != "Running":
        if (
            "Error" in deployment_status["status"]
            or "failed" in deployment_status.get("status", "").lower()
        ):
            deployment_status["llm_status"] = "Failed"
            deployment_status["ui_status"] = "failed"
        else:
            deployment_status["llm_status"] = "Starting"
            deployment_status["ui_status"] = "pending"
        
        # Even if not running, we should still try to get model information if it's unknown
        if deployment_status["model"] == "unknown":
            # Try to get model info from the deployment name
            try:
                # Check if the release name contains model information
                release_parts = release_name.split("-")
                for part in release_parts:
                    # Common model name patterns
                    if any(model_name in part.lower() for model_name in ["llama", "gemma", "mistral", "gpt", "falcon", "phi", "bert"]):
                        deployment_status["model"] = part
                        logger.info(f"Extracted model name '{part}' from release name '{release_name}'")
                        break
            except Exception as e:
                logger.error(f"Error extracting model from release name: {str(e)}")
        
        return deployment_status

    # Check model readiness by querying the model endpoint
    service_url = deployment_status["service_url"]

    try:
        # Try to query the model health endpoint
        # First find all pods for this release
        find_pods_cmd = f"kubectl get pods -n {namespace} -l app.kubernetes.io/instance={release_name} -o json"
        if not find_pods_cmd:
            # Try alternative label selectors
            find_pods_cmd = f"kubectl get pods -n {namespace} -o json"

        pods_result = await asyncio.to_thread(
            lambda: subprocess.run(
                find_pods_cmd, shell=True, text=True, capture_output=True
            )
        )

        router_pod = None
        if pods_result.returncode == 0 and pods_result.stdout:
            try:
                pods_data = json.loads(pods_result.stdout)
                for pod in pods_data.get("items", []):
                    pod_name = pod["metadata"]["name"]
                    # Look for router pods by common naming patterns
                    if (
                        "router" in pod_name.lower()
                        and pod["status"]["phase"] == "Running"
                    ):
                        router_pod = pod_name
                        break
            except json.JSONDecodeError:
                logger.error("Failed to parse pods JSON")

        if router_pod:
            # Use the found router pod
            cmd = f"kubectl exec -n {namespace} {router_pod} -- curl -s http://localhost:8000/v1/models"
            logger.info(f"Using router pod {router_pod} for health check")
        else:
            # Fallback to deployment name if no pod found
            cmd = f"kubectl exec -n {namespace} deploy/{release_name}-deployment-router -- curl -s http://localhost:8000/v1/models"
            logger.info(f"Falling back to deployment name for health check")
        health_result = await asyncio.to_thread(
            lambda: subprocess.run(
                cmd, shell=True, text=True, capture_output=True, timeout=5
            )
        )

        if health_result.returncode == 0 and health_result.stdout:
            try:
                # Parse the models response
                models_data = json.loads(health_result.stdout)

                # Check if we have models in the response
                if "data" in models_data and len(models_data["data"]) > 0:
                    deployment_status["llm_ready"] = True
                    deployment_status["llm_status"] = "Ready"
                    deployment_status["ui_status"] = "active"
                    deployment_status["available_models"] = models_data["data"]
                else:
                    # Service is up but no models loaded yet
                    deployment_status["llm_status"] = "Loading Model"
                    deployment_status["ui_status"] = "pending"
            except json.JSONDecodeError:
                # Could connect but didn't get valid JSON
                deployment_status["llm_status"] = "API Error"
                deployment_status["ui_status"] = "pending"
        else:
            # Couldn't connect to the service
            # Check logs to see if model is still loading
            # First try to find all pods for this release
            find_pods_cmd = f"kubectl get pods -n {namespace} -o json"
            find_pod_result = await asyncio.to_thread(
                lambda: subprocess.run(
                    find_pods_cmd, shell=True, text=True, capture_output=True
                )
            )

            model_pod = None
            if find_pod_result.returncode == 0 and find_pod_result.stdout:
                try:
                    pods_data = json.loads(find_pod_result.stdout)
                    for pod in pods_data.get("items", []):
                        pod_name = pod["metadata"]["name"]
                        # Look for model pods by common naming patterns
                        if (
                            release_name in pod_name
                            and (
                                "vllm" in pod_name.lower()
                                or "engine" in pod_name.lower()
                            )
                            and not "router" in pod_name.lower()
                        ):
                            model_pod = pod_name
                            break
                except json.JSONDecodeError:
                    logger.error("Failed to parse pods JSON")

            if model_pod:
                # Use the found model pod
                logs_cmd = f"kubectl logs -n {namespace} {model_pod} --tail=50"
                logger.info(f"Checking logs from model pod {model_pod}")
            else:
                # Fallback to a more generic approach - try to find any pod with the release name
                logs_cmd = f"kubectl logs -n {namespace} -l app.kubernetes.io/instance={release_name} --tail=50"
                logger.info(f"Falling back to generic log check for {release_name}")
            logs_result = await asyncio.to_thread(
                lambda: subprocess.run(
                    logs_cmd, shell=True, text=True, capture_output=True
                )
            )

            if logs_result.returncode == 0:
                log_content = logs_result.stdout.lower()
                if "model loaded successfully" in log_content:
                    deployment_status["llm_status"] = "Model Loaded, Service Starting"
                    deployment_status["ui_status"] = "pending"
                elif "loading model" in log_content or "downloading" in log_content:
                    deployment_status["llm_status"] = "Downloading/Loading Model"
                    deployment_status["ui_status"] = "pending"
                else:
                    deployment_status["llm_status"] = "Starting"
                    deployment_status["ui_status"] = "pending"
    except Exception as e:
        logger.error(f"Error checking model readiness: {str(e)}")
        deployment_status["llm_status"] = f"Status Check Error: {str(e)}"
        deployment_status["ui_status"] = "pending"

    return deployment_status


@app.get("/deployments/", response_model=List[DeploymentListItem])
async def list_deployments_endpoint(
    namespace: Optional[str] = Query(None, description="Filter by namespace")
):
    """List all LLM deployments with basic information"""
    try:
        # Get deployments from active_deployments first
        deployments = []
        for deployment_id, deployment in active_deployments.items():
            if namespace and deployment.get("namespace") != namespace:
                continue

            # Get basic deployment information
            deployment_status = deployment.get("status", "unknown")
            model_name = deployment.get("model_path", "unknown")
            health_status = deployment.get("llm_status", "unknown")
            ready = deployment.get("llm_ready", False)
            
            # If status is Running but health_status is unknown, set it to Ready
            if deployment_status == "Running" and health_status == "unknown":
                health_status = "Ready"
                ready = True
                logger.info(f"Setting deployment {deployment.get('release_name')} as ready because it has Running status")
            
            # Check if the deployment has an external IP, which indicates it's likely ready
            external_ip = deployment.get("external_ip")
            if external_ip and health_status == "unknown":
                health_status = "Ready"
                ready = True
                logger.info(f"Setting deployment {deployment.get('release_name')} as ready because it has an external IP: {external_ip}")
            
            # Create a deployment list item with improved values
            deployment_item = DeploymentListItem(
                deployment_id=deployment_id,
                name=deployment.get("release_name"),
                namespace=deployment.get("namespace"),
                status=deployment_status,
                model=model_name,
                created_at=deployment.get("created_at", datetime.now().isoformat()),
                ready=ready,
                health_status=health_status,
            )
            deployments.append(deployment_item)

        # Also check Helm for any deployments not in our active_deployments
        helm_cmd = (
            f"helm list -n {namespace} -o json"
            if namespace
            else "helm list --all-namespaces -o json"
        )
        helm_result = await asyncio.to_thread(
            lambda: subprocess.run(helm_cmd, shell=True, text=True, capture_output=True)
        )

        if helm_result.returncode == 0:
            try:
                helm_releases = json.loads(helm_result.stdout)

                for release in helm_releases:
                    release_name = release.get("name")
                    release_namespace = release.get("namespace", namespace or "default")

                    # Skip if already in our list (by name and namespace)
                    if any(
                        d.name == release_name and d.namespace == release_namespace
                        for d in deployments
                    ):
                        continue

                    # Generate a deterministic deployment ID based on namespace and release name
                    # This ensures the same deployment gets the same ID across server restarts
                    unique_key = f"{release_namespace}:{release_name}"
                    deployment_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_key))

                    # Get enhanced status
                    status = await get_enhanced_deployment_status(
                        release_namespace, release_name
                    )

                    # Try to extract model name from release name if it's still unknown
                    model_name = status.get("model", "unknown")
                    if model_name == "unknown":
                        # Check if the release name contains model information
                        release_parts = release_name.split("-")
                        for part in release_parts:
                            # Common model name patterns
                            if any(model_name in part.lower() for model_name in ["llama", "gemma", "mistral", "gpt", "falcon", "phi", "bert"]):
                                model_name = part
                                logger.info(f"Extracted model name '{part}' from release name '{release_name}'")
                                break
                    
                    # Determine a more descriptive status if it's unknown
                    deployment_status = status.get("status", "unknown")
                    if deployment_status == "unknown":
                        deployment_status = "Deployed"  # Better default than "unknown"
                    
                    # Get health status and ready flag
                    health_status = status.get("llm_status", "unknown")
                    ready = status.get("llm_ready", False)
                    
                    # If status is Running but health_status is unknown, set it to Ready
                    if deployment_status == "Running" and health_status == "unknown":
                        health_status = "Ready"
                        ready = True
                        logger.info(f"Setting deployment {release_name} as ready because it has Running status")
                    
                    # Check if the deployment has an external IP, which indicates it's likely ready
                    external_ip = status.get("external_ip")
                    if external_ip and health_status == "unknown":
                        health_status = "Ready"
                        ready = True
                        logger.info(f"Setting deployment {release_name} as ready because it has an external IP: {external_ip}")
                    
                    # Create a deployment list item with improved values
                    deployment_item = DeploymentListItem(
                        deployment_id=deployment_id,
                        name=release_name,
                        namespace=release_namespace,
                        status=deployment_status,
                        model=model_name,
                        created_at=release.get("updated", datetime.now().isoformat()),
                        ready=ready,
                        health_status=health_status,
                    )
                    deployments.append(deployment_item)

                    # Add to active_deployments for future reference
                    active_deployments[deployment_id] = {
                        "release_name": release_name,
                        "namespace": release_namespace,
                        "status": status.get("status", "unknown"),
                        "model_path": status.get("model", "unknown"),
                        "created_at": release.get(
                            "updated", datetime.now().isoformat()
                        ),
                        "llm_ready": status.get("llm_ready", False),
                        "llm_status": status.get("llm_status", "unknown"),
                    }
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing Helm JSON: {str(e)}")
            except Exception as e:
                logger.error(f"Error listing deployments: {str(e)}")

        return deployments
    except Exception as e:
        logger.error(f"List error: {str(e)}")
        return []


@app.get("/deployments/{deployment_id}", response_model=DeploymentStatus)
async def get_deployment(deployment_id: str):
    """Get detailed information about a specific LLM deployment"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Get enhanced status with readiness information
    enhanced_status = await get_enhanced_deployment_status(namespace, release_name)

    # Directly get the external IP from kubectl
    external_ip = None
    try:
        # Use kubectl to get the external IP directly
        cmd = f"kubectl get service {release_name}-router-service -n {namespace} -o jsonpath='{{.status.loadBalancer.ingress[0].ip}}'"
        logger.info(f"Fetching external IP with command: {cmd}")
        result = await asyncio.to_thread(
            lambda: subprocess.run(cmd, shell=True, text=True, capture_output=True)
        )

        if result.returncode == 0 and result.stdout.strip():
            external_ip = result.stdout.strip()
            logger.info(f"Successfully found external IP: {external_ip}")
        else:
            # Try hostname if IP is not available
            cmd = f"kubectl get service {release_name}-router-service -n {namespace} -o jsonpath='{{.status.loadBalancer.ingress[0].hostname}}'"
            logger.info(f"Trying hostname with command: {cmd}")
            result = await asyncio.to_thread(
                lambda: subprocess.run(cmd, shell=True, text=True, capture_output=True)
            )

            if result.returncode == 0 and result.stdout.strip():
                external_ip = result.stdout.strip()
                logger.info(f"Successfully found external hostname: {external_ip}")
            else:
                # Try a more direct approach - get the external IP from kubectl get services
                cmd = f"kubectl get services -n {namespace} {release_name}-router-service -o custom-columns=EXTERNAL-IP:.status.loadBalancer.ingress[0].ip --no-headers"
                logger.info(f"Trying direct kubectl command: {cmd}")
                result = await asyncio.to_thread(
                    lambda: subprocess.run(
                        cmd, shell=True, text=True, capture_output=True
                    )
                )

                if (
                    result.returncode == 0
                    and result.stdout.strip()
                    and result.stdout.strip() != "<none>"
                ):
                    external_ip = result.stdout.strip()
                    logger.info(
                        f"Found external IP with direct kubectl command: {external_ip}"
                    )
                else:
                    logger.warning(
                        f"Could not find external IP or hostname. Command output: {result.stdout}, Error: {result.stderr}"
                    )
    except Exception as e:
        logger.error(f"Error getting external IP directly: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())

    # Set default health status and ready flag based on deployment state
    health_status = enhanced_status.get("llm_status", "unknown")
    ready = enhanced_status.get("llm_ready", False)
    
    # If we have an external IP but health status is still unknown, the deployment is likely ready
    if external_ip and health_status == "unknown":
        health_status = "Ready"
        ready = True
        logger.info(f"Setting deployment {release_name} as ready because it has an external IP: {external_ip}")
    
    # Construct the response
    response = DeploymentStatus(
        deployment_id=deployment_id,
        name=release_name,
        namespace=namespace,
        status=enhanced_status.get("status", "Unknown"),
        model=deployment.get("model_path", "Unknown"),
        created_at=deployment.get("created_at", ""),
        updated_at=deployment.get("updated_at"),
        gpu_count=deployment.get("gpu_count", 0),
        cpu_count=deployment.get("cpu_count", 0),
        memory=deployment.get("memory", ""),
        image=f"{deployment.get('image_repo', 'vllm/vllm-openai')}:{deployment.get('image_tag', 'latest')}",
        service_url=enhanced_status.get("service_url", ""),
        ready=ready,
        health_status=health_status,
        external_ip=external_ip,  # Set the external IP directly
    )

    # Add public URL if available from enhanced status or use external IP
    if enhanced_status.get("public_url"):
        response.public_url = enhanced_status.get("public_url")
    elif external_ip:  # Use external IP for public URL if available
        response.public_url = f"http://{external_ip}"

    return response


@app.delete("/deployments/{deployment_id}")
async def delete_deployment_by_id(
    deployment_id: str, background_tasks: BackgroundTasks
):
    """Delete a deployment by ID"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    args = Namespace(
        namespace=namespace,
        release_name=release_name,
        debug=False,
        command="delete",
    )

    # Delete in background
    def _delete():
        try:
            success = delete_deployment(args)

            if success:
                # First update status to deleted
                deployment["status"] = "deleted"

                # Then remove from active_deployments after a short delay
                # This allows the UI to show the deleted status briefly before removal
                def remove_after_delay():
                    import time

                    time.sleep(5)  # Wait 5 seconds before removing
                    if deployment_id in active_deployments:
                        logger.info(
                            f"Removing deployment {release_name} from active deployments"
                        )
                        active_deployments.pop(deployment_id, None)

                # Start a new thread to remove after delay
                import threading

                threading.Thread(target=remove_after_delay, daemon=True).start()
            else:
                deployment["status"] = "delete_failed"
                deployment["error"] = "Deletion failed"
        except Exception as e:
            logger.error(f"Deletion error in background task: {str(e)}")
            deployment["status"] = "delete_failed"
            deployment["error"] = str(e)

    background_tasks.add_task(_delete)

    return {
        "success": True,
        "message": f"Deletion of deployment {release_name} started",
        "deployment_id": deployment_id,
    }


@app.delete("/deployments/{namespace}/{release_name}")
async def delete_deployment_endpoint(
    namespace: str, release_name: str, background_tasks: BackgroundTasks
):
    """Delete a deployment by namespace and release name"""

    deployment_id = None
    for id, deployment in active_deployments.items():
        if (
            deployment["namespace"] == namespace
            and deployment["release_name"] == release_name
        ):
            deployment_id = id
            break

    # If not in our registry, still try to delete it
    if deployment_id is None:
        args = Namespace(
            namespace=namespace,
            release_name=release_name,
            purge=True,
            debug=False,
            command="delete",
        )

        # Delete in background
        def _delete():
            try:
                success = delete_deployment(args)
                if not success:
                    logger.error(f"Deletion failed for {namespace}/{release_name}")
            except Exception as e:
                logger.error(f"Deletion error: {str(e)}")

        background_tasks.add_task(_delete)

        return {
            "success": True,
            "message": f"Deletion of deployment {release_name} started",
        }
    else:
        # If found in registry, use the ID-based delete endpoint
        return await delete_deployment_by_id(deployment_id, background_tasks)


@app.get("/deployments/{deployment_id}/logs")
async def get_deployment_logs(
    deployment_id: str,
    tail: Optional[int] = Query(100, description="Number of lines to return"),
):
    """Get logs for a specific deployment"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Get all pods in the namespace
    pod_cmd = f"kubectl get pods -n {namespace} -o json"
    result = await asyncio.to_thread(
        lambda: subprocess.run(pod_cmd, shell=True, text=True, capture_output=True)
    )

    if result.returncode != 0:
        raise HTTPException(
            status_code=500, detail=f"Failed to get pods: {result.stderr}"
        )

    # Parse the JSON and filter for pods that belong to this deployment
    pod_names = []
    try:
        pods_data = json.loads(result.stdout)
        for pod in pods_data.get("items", []):
            pod_name = pod["metadata"]["name"]
            # Filter for pods that belong to this deployment
            if release_name in pod_name:
                pod_names.append(pod_name)
                logger.info(f"Found pod for deployment {release_name}: {pod_name}")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse pods JSON: {str(e)}")

    if not pod_names:
        raise HTTPException(status_code=404, detail="No pods found")

    # Get logs for each pod
    logs = []
    for pod_name in pod_names:
        log_cmd = f"kubectl logs -n {namespace} {pod_name} --tail={tail}"
        log_result = await asyncio.to_thread(
            lambda: subprocess.run(log_cmd, shell=True, text=True, capture_output=True)
        )

        if log_result.returncode == 0:
            for line in log_result.stdout.strip().split("\n"):
                if line:
                    logs.append(
                        DeploymentLog(
                            pod_name=pod_name,
                            container_name="vllm",
                            log=line,
                            timestamp=datetime.now().isoformat(),
                        )
                    )

    return logs


@app.post("/deployments/{deployment_id}/refresh")
async def refresh_deployment_status(deployment_id: str):
    """Manually refresh the status of a deployment"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Get enhanced deployment status to check health and readiness
    enhanced_status = await get_enhanced_deployment_status(namespace, release_name)

    # Update the deployment in active_deployments with latest status
    deployment["status"] = enhanced_status.get(
        "status", deployment.get("status", "unknown")
    )
    deployment["llm_status"] = enhanced_status.get("llm_status", "unknown")
    deployment["llm_ready"] = enhanced_status.get("llm_ready", False)

    # Return the updated status
    return {
        "success": True,
        "deployment_id": deployment_id,
        "status": deployment["status"],
        "health_status": deployment["llm_status"],
        "ready": deployment["llm_ready"],
    }


@app.get("/deployments/by-name/{namespace}/{name}", response_model=DeploymentStatus)
async def get_deployment_by_name(namespace: str, name: str):
    """Get a deployment by namespace and name"""
    # First check if it's in active_deployments
    for deployment_id, deployment in active_deployments.items():
        if (
            deployment.get("namespace") == namespace
            and deployment.get("release_name") == name
        ):
            # Return the deployment using the existing get_deployment endpoint
            return await get_deployment(deployment_id)

    # If not found, check if it exists in Kubernetes
    # Get enhanced status
    try:
        status = await get_enhanced_deployment_status(namespace, name)

        # If we get here, the deployment exists, so add it to active_deployments
        deployment_id = str(uuid.uuid4())

        active_deployments[deployment_id] = {
            "release_name": name,
            "namespace": namespace,
            "status": status.get("status", "unknown"),
            "model_path": status.get("model", "unknown"),
            "created_at": datetime.now().isoformat(),
            "llm_ready": status.get("llm_ready", False),
            "llm_status": status.get("llm_status", "unknown"),
            "gpu_count": status.get("gpu_count", 1),
            "cpu_count": status.get("cpu_count", 2),
            "memory": status.get("memory", "8Gi"),
            "image": status.get("image", "vllm/vllm-openai:latest"),
        }

        # Return the deployment using the existing get_deployment endpoint
        return await get_deployment(deployment_id)
    except Exception as e:
        logger.error(
            f"Error getting deployment {name} in namespace {namespace}: {str(e)}"
        )
        raise HTTPException(
            status_code=404,
            detail=f"Deployment {name} not found in namespace {namespace}",
        )


@app.post("/deployments/{deployment_id}/port-forward")
async def port_forward_to_deployment(
    deployment_id: str, background_tasks: BackgroundTasks
):
    """Start port forwarding to a deployment to allow direct communication with the LLM"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Check if the deployment is ready
    enhanced_status = await get_enhanced_deployment_status(namespace, release_name)
    if not enhanced_status.get("llm_ready", False):
        raise HTTPException(status_code=400, detail="Deployment is not ready yet")

    # Start port forwarding in the background
    # This will run kubectl port-forward to forward the service port to localhost
    port = 8000  # You can make this dynamic if needed

    # Kill any existing port-forward on this port
    kill_cmd = f"pkill -f 'kubectl port-forward.*{port}'"
    try:
        await asyncio.to_thread(
            lambda: subprocess.run(kill_cmd, shell=True, text=True, capture_output=True)
        )
    except Exception as e:
        logger.warning(f"Error killing existing port-forward: {str(e)}")

    # Start new port-forward
    port_forward_cmd = f"kubectl port-forward -n {namespace} svc/{release_name}-router-service {port}:80"

    # Run the port-forward command in the background
    async def _port_forward():
        try:
            process = await asyncio.create_subprocess_shell(
                port_forward_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            # Store the process information for later cleanup
            if not hasattr(app, "port_forward_processes"):
                app.port_forward_processes = {}
            app.port_forward_processes[deployment_id] = process

            # Log the output
            logger.info(
                f"Started port forwarding for {release_name} in namespace {namespace} on port {port}"
            )

            # Wait for a short time to ensure port-forward is established
            await asyncio.sleep(2)

            # Check if the port is actually open
            try:
                # Try to connect to the port
                reader, writer = await asyncio.open_connection("localhost", port)
                writer.close()
                await writer.wait_closed()
                logger.info(f"Port {port} is open and accepting connections")
            except Exception as e:
                logger.error(f"Port {port} is not accessible: {str(e)}")
                return False

            return True
        except Exception as e:
            logger.error(f"Error starting port-forward: {str(e)}")
            return False

    # Start the port forwarding
    background_tasks.add_task(_port_forward)

    # Return success immediately, the actual port-forward will happen in the background
    return {
        "success": True,
        "message": f"Port forwarding started for {release_name} on port {port}",
        "port": port,
    }


@app.post("/deployments/{deployment_id}/chat")
async def proxy_chat_to_llm(deployment_id: str, request: dict):
    """Proxy chat requests to the LLM"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Check if the deployment is ready
    enhanced_status = await get_enhanced_deployment_status(namespace, release_name)
    if not enhanced_status.get("llm_ready", False):
        raise HTTPException(status_code=400, detail="Deployment is not ready yet")

    # Get the service URL
    service_url = f"{release_name}-router-service.{namespace}.svc.cluster.local"

    # Format the URL for the chat completions endpoint
    api_url = f"http://{service_url}/v1/chat/completions"

    logger.info(f"Proxying chat request to: {api_url}")

    try:
        # Use standard requests library instead of httpx
        import requests

        # Make the request to the LLM API
        response = await asyncio.to_thread(
            lambda: requests.post(
                api_url, json=request, timeout=60.0  # Longer timeout for LLM responses
            )
        )

        # Get the response content
        if response.status_code != 200:
            logger.error(
                f"Error from LLM API: {response.status_code} - {response.text}"
            )
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Error from LLM API: {response.text}",
            )

        # Return the LLM response directly
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error connecting to LLM API: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error connecting to LLM API: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error proxying chat request: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Unexpected error proxying chat request: {str(e)}"
        )


@app.get("/deployments/{deployment_id}/pods")
async def get_deployment_pods(deployment_id: str):
    """Get pod status for a specific deployment"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    try:
        # Get all pods in the namespace
        cmd = f"kubectl get pods -n {namespace} -o json"
        result = await run_command(cmd)
        pods_json = json.loads(result.stdout)

        # Filter pods that belong to this deployment
        deployment_pods = []
        for pod in pods_json.get("items", []):
            pod_name = pod.get("metadata", {}).get("name", "")
            if release_name in pod_name:
                # Extract relevant information
                status = pod.get("status", {})
                container_statuses = status.get("containerStatuses", [])
                restarts = 0
                if container_statuses:
                    restarts = container_statuses[0].get("restartCount", 0)

                pod_status = "Unknown"
                if status.get("phase"):
                    pod_status = status.get("phase")

                # Check for container errors
                if any(
                    cs.get("state", {}).get("waiting", {}).get("reason")
                    == "CrashLoopBackOff"
                    for cs in container_statuses
                ):
                    pod_status = "CrashLoopBackOff"
                elif any(
                    cs.get("state", {}).get("waiting", {}).get("reason") == "Error"
                    for cs in container_statuses
                ):
                    pod_status = "Error"

                deployment_pods.append(
                    {
                        "name": pod_name,
                        "status": pod_status,
                        "restarts": restarts,
                        "ready": status.get("phase") == "Running"
                        and all(cs.get("ready", False) for cs in container_statuses),
                        "created": pod.get("metadata", {}).get("creationTimestamp", ""),
                    }
                )

        logger.info(f"Found {len(deployment_pods)} pods for deployment {release_name}")
        return {"pods": deployment_pods}

    except Exception as e:
        logger.error(f"Error getting pod status: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error getting pod status: {str(e)}"
        )


# ===== CLUSTER MANAGEMENT ENDPOINTS =====


class ClusterRequest(BaseModel):
    project_id: str = Field(..., description="GCP Project ID")
    zone: str = Field("us-central1-a", description="GCP zone")
    cluster_name: str = Field("vllm-cluster", description="GKE cluster name")
    network: Optional[str] = Field(None, description="VPC network name (optional)")
    subnetwork: Optional[str] = Field(
        None, description="VPC subnetwork name (optional)"
    )
    machine_type: str = Field("e2-standard-4", description="Machine type for CPU nodes")
    num_nodes: int = Field(3, description="Number of CPU nodes")
    gpu_pool_name: str = Field("gpu-pool", description="Name for the GPU node pool")
    gpu_machine_type: str = Field(
        "n1-standard-8", description="Machine type for GPU nodes"
    )
    gpu_type: str = Field("nvidia-l4", description="GPU type")
    gpu_nodes: int = Field(1, description="Number of GPU nodes")
    gpus_per_node: int = Field(1, description="Number of GPUs per node")
    min_gpu_nodes: int = Field(
        0, description="Minimum number of GPU nodes for autoscaling"
    )
    max_gpu_nodes: int = Field(
        5, description="Maximum number of GPU nodes for autoscaling"
    )
    debug: bool = Field(False, description="Enable debug output")


class ClusterDeleteRequest(BaseModel):
    project_id: str = Field(..., description="GCP Project ID")
    zone: str = Field(
        "us-central1-a", description="GCP zone where the cluster is located"
    )
    cluster_name: str = Field(..., description="Name of the GKE cluster to delete")
    force_delete: bool = Field(True, description="Delete without confirmation prompt")
    debug: bool = Field(False, description="Enable debug output")


class ClusterStatusRequest(BaseModel):
    project_id: str = Field(..., description="GCP Project ID")
    zone: str = Field(
        "us-central1-a", description="GCP zone where the cluster is located"
    )
    cluster_name: str = Field(..., description="Name of the GKE cluster to check")


class ClusterResponse(BaseModel):
    success: bool
    message: str
    cluster_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ClusterStatus(BaseModel):
    cluster_id: str
    project_id: str
    zone: str
    cluster_name: str
    status: str  # can be "CREATING", "RUNNING", "ERROR", "DELETING", "NOT_FOUND"
    created_at: Optional[str] = None
    node_count: Optional[int] = None
    gpu_node_count: Optional[int] = None
    gpu_type: Optional[str] = None
    endpoint: Optional[str] = None
    error_message: Optional[str] = None
    progress: Optional[int] = 0  # Progress percentage (0-100)


# Store cluster logs in memory
cluster_logs = {}


# Function to add a log entry to a cluster's log history
def add_cluster_log(cluster_id: str, log_entry: Dict[str, Any]):
    """Add a log entry to a cluster's log history"""
    if cluster_id not in cluster_logs:
        cluster_logs[cluster_id] = []

    # Add the log entry to the cluster's logs
    cluster_logs[cluster_id].append(log_entry)

    # Keep only the most recent 100 logs
    if len(cluster_logs[cluster_id]) > 100:
        cluster_logs[cluster_id] = cluster_logs[cluster_id][-100:]


@app.post("/clusters/create", response_model=ClusterResponse)
async def create_cluster(request: ClusterRequest):
    """Create a new GKE cluster with GPU support"""
    cluster_id = str(uuid.uuid4())

    # Store initial cluster info
    active_clusters[cluster_id] = {
        "cluster_id": cluster_id,
        "project_id": request.project_id,
        "zone": request.zone,
        "cluster_name": request.cluster_name,
        "status": "PENDING",
        "created_at": datetime.utcnow().isoformat(),
        "request": request.dict(),
        "progress": 0,  # Track progress percentage
    }

    # Run cluster creation in a separate thread
    thread = threading.Thread(
        target=_create_cluster_thread, args=(cluster_id, request), daemon=True
    )
    thread.start()

    return ClusterResponse(
        success=True,
        message=f"Cluster creation started for {request.cluster_name}",
        cluster_id=cluster_id,
    )


def _create_cluster_thread(cluster_id: str, request: ClusterRequest):
    """Non-async function to create a cluster in a separate thread"""
    # Call the async function in a new event loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_create_cluster(cluster_id, request))
    finally:
        loop.close()


async def _create_cluster(cluster_id: str, request: ClusterRequest):
    """Background task to create a GKE cluster"""
    logger.info(f"Starting cluster creation: {request.cluster_name}")

    # Initialize log storage for this cluster
    cluster_logs[cluster_id] = []
    log_queue[cluster_id] = queue.Queue()

    # Custom log handler to capture logs
    class QueueHandler(logging.Handler):
        def __init__(self, cluster_id):
            logging.Handler.__init__(self)
            self.cluster_id = cluster_id

        def emit(self, record):
            log_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "level": record.levelname,
                "message": self.format(record),
            }

            # Store log in memory
            if cluster_id in cluster_logs:
                cluster_logs[cluster_id].append(log_entry)
                # Keep only last 1000 logs
                if len(cluster_logs[cluster_id]) > 1000:
                    cluster_logs[cluster_id] = cluster_logs[cluster_id][-1000:]

            # Add to queue for WebSocket clients
            if cluster_id in log_queue:
                try:
                    log_queue[cluster_id].put_nowait(log_entry)
                except queue.Full:
                    # Remove oldest log if queue is full
                    try:
                        log_queue[cluster_id].get_nowait()
                        log_queue[cluster_id].put_nowait(log_entry)
                    except:
                        pass

    try:
        # Update status to creating
        active_clusters[cluster_id]["status"] = "CREATING"
        active_clusters[cluster_id]["progress"] = 10  # 10% progress

        # Add key step for creation start
        add_cluster_log(
            cluster_id,
            {
                "timestamp": datetime.utcnow().isoformat(),
                "level": "INFO",
                "message": f"Starting cluster creation: {request.cluster_name} in project {request.project_id}",
            },
        )

        # Convert request to argparse namespace to match gcloud main.py expectations
        args = Namespace()
        for key, value in request.dict().items():
            setattr(args, key, value)
        args.command = "create"

        # Check for gcloud auth
        if not check_gcloud_auth():
            raise Exception(
                "gcloud authentication failed. Please run 'gcloud auth login' first."
            )

        # Check if project exists
        if not check_project(request.project_id):
            raise Exception(
                f"Project {request.project_id} not found or not accessible."
            )
        active_clusters[cluster_id]["progress"] = 30  # 30% progress

        # Add key step for project verification
        add_cluster_log(
            cluster_id,
            {
                "timestamp": datetime.utcnow().isoformat(),
                "level": "INFO",
                "message": f"Project verified and APIs being enabled",
            },
        )

        # Enable required APIs
        enable_required_apis(request.project_id)
        active_clusters[cluster_id]["progress"] = 40  # 40% progress

        # Add key step for API enablement
        add_cluster_log(
            cluster_id,
            {
                "timestamp": datetime.utcnow().isoformat(),
                "level": "INFO",
                "message": f"Creating GKE cluster with standard node pool",
            },
        )

        # Create the cluster
        active_clusters[cluster_id]["progress"] = 50  # 50% progress

        # Add key step for GPU node pool creation
        add_cluster_log(
            cluster_id,
            {
                "timestamp": datetime.utcnow().isoformat(),
                "level": "INFO",
                "message": f"Adding GPU node pool with {request.gpu_type} GPUs",
            },
        )

        if create_gke_cluster(args):
            active_clusters[cluster_id]["status"] = "RUNNING"
            active_clusters[cluster_id]["progress"] = 100  # 100% progress

            # Add key step for successful completion
            add_cluster_log(
                cluster_id,
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "level": "INFO",
                    "message": f"Cluster {request.cluster_name} created successfully",
                },
            )

            # Get the cluster endpoint
            cmd = f"gcloud container clusters describe {request.cluster_name} --project={request.project_id} --zone={request.zone} --format=json"
            result = subprocess.run(
                cmd, shell=True, check=True, text=True, capture_output=True
            )
            cluster_info = json.loads(result.stdout)

            # Update cluster information
            active_clusters[cluster_id]["endpoint"] = cluster_info.get("endpoint")
            active_clusters[cluster_id]["node_count"] = request.num_nodes
            active_clusters[cluster_id]["gpu_node_count"] = request.gpu_nodes
            active_clusters[cluster_id]["gpu_type"] = request.gpu_type
        else:
            active_clusters[cluster_id]["status"] = "ERROR"
            active_clusters[cluster_id][
                "error_message"
            ] = "Failed to create GKE cluster"
            logger.error(f"Failed to create cluster {request.cluster_name}")

    except Exception as e:
        logger.error(f"Error creating cluster: {str(e)}")
        active_clusters[cluster_id]["status"] = "ERROR"
        active_clusters[cluster_id]["error_message"] = str(e)

    finally:
        # No need to remove handler as we're not using one
        pass


@app.post("/clusters/delete", response_model=ClusterResponse)
async def delete_cluster(
    request: ClusterDeleteRequest, background_tasks: BackgroundTasks
):
    """Delete a GKE cluster"""
    cluster_id = str(uuid.uuid4())

    # Find if this cluster is already in our active clusters
    existing_cluster_id = None
    for cid, cluster in active_clusters.items():
        if (
            cluster["project_id"] == request.project_id
            and cluster["zone"] == request.zone
            and cluster["cluster_name"] == request.cluster_name
        ):
            existing_cluster_id = cid
            break

    if existing_cluster_id:
        cluster_id = existing_cluster_id
        active_clusters[cluster_id]["status"] = "DELETING"
    else:
        # Store initial cluster info for a new record
        active_clusters[cluster_id] = {
            "cluster_id": cluster_id,
            "project_id": request.project_id,
            "zone": request.zone,
            "cluster_name": request.cluster_name,
            "status": "DELETING",
            "created_at": datetime.utcnow().isoformat(),
        }

    # Run cluster deletion in background
    background_tasks.add_task(_delete_cluster, cluster_id, request)

    return ClusterResponse(
        success=True,
        message=f"Cluster deletion started for {request.cluster_name}",
        cluster_id=cluster_id,
    )


async def _delete_cluster(cluster_id: str, request: ClusterDeleteRequest):
    """Background task to delete a GKE cluster"""
    logger.info(f"Starting cluster deletion: {request.cluster_name}")

    try:
        # Convert request to argparse namespace
        args = Namespace()
        for key, value in request.dict().items():
            setattr(args, key, value)
        args.command = "delete"

        # Check for gcloud auth
        if not check_gcloud_auth():
            raise Exception(
                "gcloud authentication failed. Please run 'gcloud auth login' first."
            )

        # Delete the cluster
        if delete_gke_cluster(args):
            active_clusters[cluster_id]["status"] = "NOT_FOUND"
            logger.info(f"Cluster {request.cluster_name} deleted successfully")
        else:
            active_clusters[cluster_id]["status"] = "ERROR"
            active_clusters[cluster_id][
                "error_message"
            ] = "Failed to delete GKE cluster"
            logger.error(f"Failed to delete cluster {request.cluster_name}")

    except Exception as e:
        logger.error(f"Error deleting cluster: {str(e)}")
        active_clusters[cluster_id]["status"] = "ERROR"
        active_clusters[cluster_id]["error_message"] = str(e)


@app.post("/clusters/status", response_model=ClusterStatus)
async def get_cluster_status(request: ClusterStatusRequest):
    """Get the status of a GKE cluster"""
    # Check if we have this cluster in our active clusters
    for cluster_id, cluster in active_clusters.items():
        if (
            cluster["project_id"] == request.project_id
            and cluster["zone"] == request.zone
            and cluster["cluster_name"] == request.cluster_name
        ):

            return ClusterStatus(
                cluster_id=cluster_id,
                project_id=cluster["project_id"],
                zone=cluster["zone"],
                cluster_name=cluster["cluster_name"],
                status=cluster["status"],
                created_at=cluster.get("created_at"),
                node_count=cluster.get("node_count"),
                gpu_node_count=cluster.get("gpu_node_count"),
                gpu_type=cluster.get("gpu_type"),
                endpoint=cluster.get("endpoint"),
                error_message=cluster.get("error_message"),
            )

    # If not found in our records, check directly with GCP
    try:
        cmd = f"gcloud container clusters describe {request.cluster_name} --project={request.project_id} --zone={request.zone} --format=json"
        result = subprocess.run(
            cmd, shell=True, check=True, text=True, capture_output=True
        )
        cluster_info = json.loads(result.stdout)

        # Generate a new cluster ID
        cluster_id = str(uuid.uuid4())

        # Extract node pools information
        node_pools = cluster_info.get("nodePools", [])
        gpu_node_count = 0
        gpu_type = None

        for pool in node_pools:
            if "gpu" in pool.get("name", "").lower():
                gpu_node_count = pool.get("initialNodeCount", 0)
                accelerators = pool.get("config", {}).get("accelerators", [])
                if accelerators:
                    gpu_type = accelerators[0].get("acceleratorType")

        # Add to active clusters
        active_clusters[cluster_id] = {
            "cluster_id": cluster_id,
            "project_id": request.project_id,
            "zone": request.zone,
            "cluster_name": request.cluster_name,
            "status": cluster_info.get("status"),
            "created_at": cluster_info.get("createTime"),
            "node_count": cluster_info.get("currentNodeCount"),
            "gpu_node_count": gpu_node_count,
            "gpu_type": gpu_type,
            "endpoint": cluster_info.get("endpoint"),
        }

        return ClusterStatus(
            cluster_id=cluster_id,
            project_id=request.project_id,
            zone=request.zone,
            cluster_name=request.cluster_name,
            status="RUNNING",
            created_at=cluster_info.get("createTime"),
            node_count=cluster_info.get("currentNodeCount"),
            gpu_node_count=gpu_node_count,
            gpu_type=gpu_type,
            endpoint=cluster_info.get("endpoint"),
        )

    except subprocess.CalledProcessError:
        # Cluster not found
        return ClusterStatus(
            cluster_id=str(uuid.uuid4()),
            project_id=request.project_id,
            zone=request.zone,
            cluster_name=request.cluster_name,
            status="NOT_FOUND",
        )

    except Exception as e:
        logger.error(f"Error checking cluster status: {str(e)}")
        return ClusterStatus(
            cluster_id=str(uuid.uuid4()),
            project_id=request.project_id,
            zone=request.zone,
            cluster_name=request.cluster_name,
            status="ERROR",
            error_message=str(e),
        )


@app.get("/clusters", response_model=List[ClusterStatus])
async def list_clusters(project_id: Optional[str] = Query(None)):
    """List all clusters or filter by project_id"""
    clusters = []

    # First, include clusters we're already tracking
    for cluster_id, cluster in active_clusters.items():
        if project_id is None or cluster["project_id"] == project_id:
            clusters.append(
                ClusterStatus(
                    cluster_id=cluster_id,
                    project_id=cluster["project_id"],
                    zone=cluster["zone"],
                    cluster_name=cluster["cluster_name"],
                    status=cluster["status"],
                    created_at=cluster.get("created_at"),
                    node_count=cluster.get("node_count"),
                    gpu_node_count=cluster.get("gpu_node_count"),
                    gpu_type=cluster.get("gpu_type"),
                    endpoint=cluster.get("endpoint"),
                    error_message=cluster.get("error_message"),
                )
            )

    # Always fetch clusters from GCP, with or without project_id
    try:
        # Use a simpler command that matches what the user ran manually
        if project_id:
            cmd = f"gcloud container clusters list --project={project_id} --format=json"
        else:
            # List clusters across all accessible projects
            cmd = "gcloud container clusters list --format=json"

        logger.info(f"Running command: {cmd}")

        try:
            result = subprocess.run(
                cmd, shell=True, check=True, text=True, capture_output=True
            )
            gcp_clusters = json.loads(result.stdout)

            # Process each cluster found
            for gcp_cluster in gcp_clusters:
                # Get cluster details
                cluster_name = gcp_cluster.get("name")

                # Fix: Extract project and location correctly from the gcloud output
                # The output format for location is typically in the form of "zone" OR "location"
                cluster_location = gcp_cluster.get("zone") or gcp_cluster.get(
                    "location"
                )

                # For project, we need to handle it differently as it might not be directly in the response
                # If project_id was provided in the query, use it as a fallback
                cluster_project = None

                # Try to extract project from selfLink if available
                self_link = gcp_cluster.get("selfLink", "")
                if "projects/" in self_link:
                    # Extract the project ID from the selfLink
                    # Format is typically "...projects/PROJECT_ID/..."
                    project_match = re.search(r"projects/([^/]+)", self_link)
                    if project_match:
                        cluster_project = project_match.group(1)

                # Fallback to provided project_id or try to get it from another command
                if not cluster_project:
                    if project_id:
                        cluster_project = project_id
                    else:
                        # Try to get current project
                        try:
                            proj_cmd = "gcloud config get-value project"
                            proj_result = subprocess.run(
                                proj_cmd,
                                shell=True,
                                check=True,
                                text=True,
                                capture_output=True,
                            )
                            cluster_project = proj_result.stdout.strip()
                        except Exception:
                            # If all else fails, try to extract project from cluster ID if available
                            if gcp_cluster.get("id"):
                                # Sometimes the ID contains project info
                                id_parts = gcp_cluster.get("id").split("/")
                                if len(id_parts) > 2:
                                    cluster_project = id_parts[
                                        1
                                    ]  # Often format is like "projects/PROJECT/..."

                if not cluster_name or not cluster_location or not cluster_project:
                    extra_info = {
                        "name": cluster_name,
                        "location": cluster_location,
                        "project": cluster_project,
                        "full_data": gcp_cluster,
                    }
                    logger.warning(
                        f"Missing essential info for cluster. Details: {json.dumps(extra_info)}"
                    )
                    continue

                # Check if we already have this cluster
                existing = False
                for cluster in clusters:
                    if (
                        cluster.cluster_name == cluster_name
                        and cluster.project_id == cluster_project
                        and cluster.zone == cluster_location
                    ):
                        existing = True
                        break

                if not existing:
                    # Generate a deterministic cluster ID based on name, project, and zone
                    unique_key = f"{cluster_project}:{cluster_location}:{cluster_name}"
                    cluster_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_key))

                    # Add basic info first, in case we fail to get details
                    new_cluster = ClusterStatus(
                        cluster_id=cluster_id,
                        project_id=cluster_project,
                        zone=cluster_location,
                        cluster_name=cluster_name,
                        status=gcp_cluster.get("status", "UNKNOWN"),
                        created_at=gcp_cluster.get("createTime"),
                        node_count=gcp_cluster.get("currentNodeCount", 0),
                    )

                    # Try to get more detailed information
                    try:
                        detail_cmd = f"gcloud container clusters describe {cluster_name} --project={cluster_project} --zone={cluster_location} --format=json"
                        logger.info(f"Getting cluster details: {detail_cmd}")

                        detail_result = subprocess.run(
                            detail_cmd,
                            shell=True,
                            check=True,
                            text=True,
                            capture_output=True,
                        )
                        cluster_info = json.loads(detail_result.stdout)

                        # Extract GPU info from node pools
                        node_pools = cluster_info.get("nodePools", [])
                        gpu_node_count = 0
                        gpu_type = None

                        for pool in node_pools:
                            if "gpu" in pool.get("name", "").lower():
                                gpu_node_count = pool.get("initialNodeCount", 0)
                                accelerators = pool.get("config", {}).get(
                                    "accelerators", []
                                )
                                if accelerators:
                                    gpu_type = accelerators[0].get("acceleratorType")

                        # Update with additional information
                        new_cluster.gpu_node_count = gpu_node_count
                        new_cluster.gpu_type = gpu_type
                        new_cluster.endpoint = cluster_info.get("endpoint")

                    except Exception as e:
                        logger.warning(
                            f"Error fetching cluster details for {cluster_name}: {str(e)}"
                        )
                        # Continue with basic info we already have

                    # Add to the list
                    clusters.append(new_cluster)

                    # Also store in active_clusters
                    active_clusters[cluster_id] = {
                        "cluster_id": cluster_id,
                        "project_id": cluster_project,
                        "zone": cluster_location,
                        "cluster_name": cluster_name,
                        "status": gcp_cluster.get("status", "UNKNOWN"),
                        "created_at": gcp_cluster.get("createTime"),
                        "node_count": gcp_cluster.get("currentNodeCount", 0),
                        "gpu_node_count": getattr(new_cluster, "gpu_node_count", 0),
                        "gpu_type": getattr(new_cluster, "gpu_type", None),
                        "endpoint": getattr(new_cluster, "endpoint", None),
                    }

        except Exception as e:
            logger.error(f"Error listing clusters from GCP: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())
    except Exception as e:
        logger.error(f"Error in GCP clusters section: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())

    return clusters


@app.get("/clusters/{cluster_id}", response_model=ClusterStatus)
async def get_cluster_by_id(cluster_id: str):
    """Get cluster information by cluster_id"""
    if cluster_id not in active_clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")

    cluster = active_clusters[cluster_id]
    return ClusterStatus(
        cluster_id=cluster_id,
        project_id=cluster["project_id"],
        zone=cluster["zone"],
        cluster_name=cluster["cluster_name"],
        status=cluster["status"],
        created_at=cluster.get("created_at"),
        node_count=cluster.get("node_count"),
        gpu_node_count=cluster.get("gpu_node_count"),
        gpu_type=cluster.get("gpu_type"),
        endpoint=cluster.get("endpoint"),
        error_message=cluster.get("error_message"),
    )


@app.get("/clusters/{cluster_id}/logs")
async def get_cluster_logs(
    cluster_id: str, limit: int = 100, since_timestamp: Optional[str] = None
):
    """Get logs for a cluster, optionally limited to the most recent entries or since a specific timestamp"""
    if cluster_id not in active_clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")

    # Return the logs for this cluster
    cluster_log_entries = cluster_logs.get(cluster_id, [])

    # Filter logs by timestamp if provided
    if since_timestamp:
        try:
            # Parse the timestamp
            since_dt = datetime.fromisoformat(since_timestamp.replace("Z", "+00:00"))
            # Filter logs that are newer than the provided timestamp
            filtered_logs = [
                log
                for log in cluster_log_entries
                if datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00"))
                > since_dt
            ]
        except ValueError:
            # If timestamp parsing fails, ignore the filter
            filtered_logs = cluster_log_entries
    else:
        filtered_logs = cluster_log_entries

    # Get the most recent logs up to the limit
    recent_logs = filtered_logs[-limit:] if limit > 0 else filtered_logs

    return {
        "logs": recent_logs,
        "total_logs": len(cluster_log_entries),
        "status": active_clusters[cluster_id].get("status", "UNKNOWN"),
        "progress": active_clusters[cluster_id].get("progress", 0),
        "cluster_info": {
            "project_id": active_clusters[cluster_id].get("project_id"),
            "zone": active_clusters[cluster_id].get("zone"),
            "cluster_name": active_clusters[cluster_id].get("cluster_name"),
            "created_at": active_clusters[cluster_id].get("created_at"),
            "endpoint": active_clusters[cluster_id].get("endpoint"),
        },
    }


@app.get("/gcloud/auth/check")
async def check_auth():
    """Check if gcloud is authenticated"""
    if check_gcloud_auth():
        return {"authenticated": True}
    else:
        return {"authenticated": False}


@app.get("/gcloud/project/check/{project_id}")
async def check_project_exists(project_id: str):
    """Check if a GCP project exists and is accessible"""
    if check_project(project_id):
        return {"exists": True}
    else:
        return {"exists": False}


@app.get("/gcloud/projects")
async def get_gcp_projects():
    """List all available GCP projects"""
    # This uses 'gcloud projects list' command to get real projects
    projects = list_gcp_projects()
    return projects


# === WEBSOCKET ENDPOINTS FOR LOGS ===


@app.websocket("/ws/cluster-logs/{cluster_id}")
async def websocket_cluster_logs(websocket: WebSocket, cluster_id: str):
    """WebSocket endpoint for streaming cluster creation logs"""
    await websocket.accept()

    try:
        # Check if cluster exists
        if cluster_id not in active_clusters:
            await websocket.send_json({"error": f"Cluster {cluster_id} not found"})
            await websocket.close()
            return

        # Send existing logs first
        if cluster_id in cluster_logs:
            for log in cluster_logs[cluster_id][-100:]:  # Send last 100 logs
                await websocket.send_json(log)

        # Create a queue for this connection if it doesn't exist
        if cluster_id not in log_queue:
            log_queue[cluster_id] = queue.Queue(maxsize=1000)

        # Setup a thread to read from the queue and send logs
        exit_event = threading.Event()

        async def send_logs():
            while not exit_event.is_set():
                try:
                    # Check for logs in the queue with a timeout
                    try:
                        log = log_queue[cluster_id].get(timeout=0.1)
                        await websocket.send_json(log)
                    except queue.Empty:
                        # No logs in queue, just wait a bit
                        await asyncio.sleep(0.1)
                except Exception as e:
                    logger.error(f"Error sending log via WebSocket: {str(e)}")
                    break

                # Yield control back to the event loop
                await asyncio.sleep(0)

        # Start the log sender task
        task = asyncio.create_task(send_logs())

        # Wait for disconnect
        try:
            # Keep connection open until client disconnects
            while True:
                data = await websocket.receive_text()
                # If client sends "close", break the loop
                if data.lower() == "close":
                    break
                await asyncio.sleep(0.1)
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for cluster {cluster_id}")
        finally:
            # Signal the log sender to stop and wait for it
            exit_event.set()
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    except Exception as e:
        logger.error(f"Error in WebSocket connection: {str(e)}")

    finally:
        # Close WebSocket connection
        try:
            await websocket.close()
        except:
            pass


@app.post("/api/deployments/metrics/cloud")
async def get_cloud_metrics(request: DeploymentMetricsRequest):
    """Get metrics for a deployment from Google Cloud Monitoring Service"""
    try:
        namespace = request.namespace
        release_name = request.release_name
        metric_names = request.metric_names or [
            "vllm:prompt_tokens_total",
            "vllm:generation_tokens_total",
            "nvidia_gpu_utilization_percent",  # Try standard Prometheus metric names
            "container_memory_usage_bytes",
        ]
        time_range_minutes = request.time_range_minutes
        use_range_query = request.use_range_query

        # First try to find project ID from active deployments
        project_id = None
        deployment_id = None

        # Look for the deployment in active_deployments
        for dep_id, deployment in active_deployments.items():
            if (
                deployment.get("namespace") == namespace
                and deployment.get("name") == release_name
            ):
                logger.info(f"Found matching deployment: {dep_id}")
                deployment_id = dep_id

                # Check if this deployment is linked to a cluster
                cluster_id = deployment.get("cluster_id")
                if cluster_id and cluster_id in active_clusters:
                    project_id = active_clusters[cluster_id].get("project_id")
                    logger.info(f"Found project ID from cluster: {project_id}")
                break

        # If not found in active deployments, try to get from kubectl context
        if not project_id:
            try:
                # Get current kubectl context
                result = subprocess.run(
                    ["kubectl", "config", "current-context"],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                current_context = result.stdout.strip()
                logger.info(f"Current kubectl context: {current_context}")

                # Parse GKE context which typically has format: gke_PROJECT_ZONE_CLUSTER
                if current_context.startswith("gke_"):
                    parts = current_context.split("_")
                    if len(parts) >= 2:
                        project_id = parts[1]
                        logger.info(
                            f"Extracted project ID from kubectl context: {project_id}"
                        )
            except subprocess.SubprocessError as e:
                logger.info(f"Could not get project ID from kubectl context: {str(e)}")

        # If still not found, try to get from environment or gcloud config
        if not project_id:
            project_id = os.environ.get("GCP_PROJECT_ID")
            if project_id:
                logger.info(f"Using project ID from environment variable: {project_id}")

        # Last resort: try gcloud config
        if not project_id:
            try:
                result = subprocess.run(
                    ["gcloud", "config", "get-value", "project"],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                project_id = result.stdout.strip()
                logger.info(f"Using project ID from gcloud config: {project_id}")
            except subprocess.SubprocessError as e:
                logger.error(f"Failed to get project ID from gcloud: {str(e)}")
                return MetricsResponse(
                    success=False,
                    message="Could not determine GCP project ID from any source",
                )

        # Get current time for timestamp - Prometheus requires Unix timestamp
        now_dt = datetime.now()
        now_unix = int(now_dt.timestamp())  # Convert to Unix timestamp for Prometheus
        now_iso = now_dt.isoformat()  # Keep ISO format for our response

        # Prepare results dictionary
        results = {}

        # Helper method to format metric values for better readability
        def _format_metric_value(metric_name, value):
            """Format metric values for better readability based on the metric type"""
            # Format time metrics in milliseconds
            if "time" in metric_name.lower() and "seconds" in metric_name.lower():
                return f"{value * 1000:.2f}"

            # Format percentage metrics
            elif (
                "utilization" in metric_name.lower()
                or "usage" in metric_name.lower()
                or "rate" in metric_name.lower()
            ):
                return f"{value * 100:.2f}"

            # Format throughput metrics with 2 decimal places
            elif (
                "throughput" in metric_name.lower()
                or "per_second" in metric_name.lower()
            ):
                return f"{value:.2f}"

            # Format token counts as integers
            elif "tokens" in metric_name.lower() or "count" in metric_name.lower():
                return f"{int(value)}"

            # Default formatting with 2 decimal places
            else:
                return f"{value:.2f}"

        # Helper method to determine the unit for a metric
        def _get_metric_unit(metric_name):
            """Determine the appropriate unit for a metric based on its name"""
            # Time metrics
            if (
                "time_to_first_token" in metric_name
                or "time_per_output_token" in metric_name
            ):
                return "ms"

            # Percentage metrics
            elif (
                "utilization" in metric_name
                or "usage" in metric_name
                or "rate" in metric_name
            ):
                return "%"

            # Throughput metrics
            elif "throughput" in metric_name:
                return "tokens/s"
            elif "requests_per_second" in metric_name:
                return "req/s"

            # Token metrics
            elif "tokens" in metric_name:
                return "tokens"

            # Request metrics
            elif "requests" in metric_name:
                return "requests"

            # Default - no unit
            else:
                return ""

        # Get authentication credentials
        try:
            # This uses Application Default Credentials
            # It will use credentials from:
            # 1. GOOGLE_APPLICATION_CREDENTIALS environment variable
            # 2. User credentials from gcloud auth application-default login
            # 3. GCE/GKE metadata server if running in Google Cloud
            # credentials, project = default()
            # if not credentials.valid:
            #     credentials.refresh(GoogleAuthRequest())

            # # If project_id wasn't set, use the one from credentials
            # if not project_id:
            #     project_id = project
            #     logger.info(f"Using project ID from credentials: {project_id}")

            # Enhanced token caching mechanism
            # Use function attributes for token caching instead of global variables
            # This approach is more robust and thread-safe
            current_time = time.time()

            # Check if we need to refresh the token
            if (
                not hasattr(get_cloud_metrics, "gcloud_auth_token")
                or not hasattr(get_cloud_metrics, "gcloud_token_expiry")
                or current_time >= getattr(get_cloud_metrics, "gcloud_token_expiry", 0)
            ):

                try:
                    # Run gcloud command to get fresh access token
                    logger.info("Fetching new Google Cloud authentication token")
                    result = subprocess.run(
                        ["gcloud", "auth", "print-access-token"],
                        capture_output=True,
                        text=True,
                        check=True,
                    )
                    auth_token = result.stdout.strip()

                    if not auth_token:
                        raise ValueError("Empty authentication token received")

                    # Set token expiration to 50 minutes from now (tokens typically last 60 minutes)
                    # This gives us a 10-minute buffer before the actual expiration
                    get_cloud_metrics.gcloud_auth_token = auth_token
                    get_cloud_metrics.gcloud_token_expiry = current_time + (
                        50 * 60
                    )  # 50 minutes in seconds

                    # Calculate remaining time until expiry for logging
                    expiry_minutes = int(
                        (get_cloud_metrics.gcloud_token_expiry - current_time) / 60
                    )

                    # Only log a portion of the token for security
                    token_preview = auth_token[:10] + "..." if auth_token else "<empty>"
                    logger.info(
                        f"Successfully obtained new Google Cloud authentication token: {token_preview} (expires in {expiry_minutes} minutes)"
                    )

                except subprocess.SubprocessError as e:
                    logger.error(
                        f"Failed to get authentication token from gcloud: {str(e)}"
                    )

                    # Try to get token using alternative method if subprocess fails
                    try:
                        import google.auth
                        from google.auth.transport.requests import (
                            Request as GoogleAuthRequest,
                        )

                        logger.info("Attempting to get token using google.auth library")
                        credentials, project = google.auth.default()

                        if not credentials.valid:
                            credentials.refresh(GoogleAuthRequest())

                        auth_token = credentials.token
                        get_cloud_metrics.gcloud_auth_token = auth_token
                        get_cloud_metrics.gcloud_token_expiry = current_time + (50 * 60)

                        token_preview = (
                            auth_token[:10] + "..." if auth_token else "<empty>"
                        )
                        logger.info(
                            f"Successfully obtained token using google.auth: {token_preview}"
                        )

                    except Exception as auth_e:
                        logger.error(
                            f"All authentication methods failed: {str(auth_e)}"
                        )

                        return MetricsResponse(
                            success=False,
                            message=f"Failed to get authentication token: {str(e)}. Alternative method also failed: {str(auth_e)}",
                        )
            else:
                # Use cached token and log remaining validity time
                auth_token = get_cloud_metrics.gcloud_auth_token
                remaining_time = int(
                    (get_cloud_metrics.gcloud_token_expiry - current_time) / 60
                )
                token_preview = auth_token[:10] + "..." if auth_token else "<empty>"
                logger.info(
                    f"Using cached Google Cloud authentication token: {token_preview} (valid for {remaining_time} more minutes)"
                )

            # Set auth headers with the token (cached or new)
            auth_headers = {"Authorization": f"Bearer {auth_token}"}
        except Exception as e:
            logger.error(f"Error getting Google Cloud authentication: {str(e)}")
            return MetricsResponse(
                success=False,
                message=f"Failed to authenticate with Google Cloud: {str(e)}",
            )

        # Construct the Prometheus query API endpoint - use range query if requested
        if use_range_query:
            api_endpoint = f"https://monitoring.googleapis.com/v1/projects/{project_id}/location/global/prometheus/api/v1/query_range"
        else:
            api_endpoint = f"https://monitoring.googleapis.com/v1/projects/{project_id}/location/global/prometheus/api/v1/query"

        # Define specific metrics for vLLM dashboard with enhanced queries based on actual Prometheus metrics
        # Use rate() for counters to get per-second rates over a time window
        # This provides more useful metrics for monitoring performance trends

        # Time window for rate calculations (5m = 5 minutes)
        rate_window = "5m"
        interval = "$__interval"

        # Based on the screenshots, these are the actual metric names in Prometheus
        vllm_dashboard_metrics = {
            # Token counts and throughput - using actual metric names from screenshot 1
            "prompt_tokens": f'sum(rate(vllm:prompt_tokens_total{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            "generation_tokens": f'sum(rate(vllm:generation_tokens_total{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            "tokens_total": f'sum(rate(vllm:prompt_tokens_total{{pod=~"{release_name}-.*"}}[{rate_window}])) + sum(rate(vllm:generation_tokens_total{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            "token_throughput": f'sum(rate(vllm:generation_tokens_total{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            # Timing metrics - using actual metric names from screenshot 3
            "time_to_first_token": f'histogram_quantile(0.95, increase(vllm:time_to_first_token_seconds_bucket{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            "time_per_output_token": f'histogram_quantile(0.95, increase(vllm:time_per_output_token_seconds_bucket{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            # E2E latency - using actual metric name from screenshot 2
            "e2e_latency": f'histogram_quantile(0.95, increase(vllm:e2e_request_latency_seconds_bucket{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            "e2e_latency_p50": f'histogram_quantile(0.50, increase(vllm:e2e_request_latency_seconds_bucket{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            "e2e_latency_p99": f'histogram_quantile(0.99, increase(vllm:e2e_request_latency_seconds_bucket{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            # Request metrics
            "requests_completed": f'sum(increase(vllm:request_success_total{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            "requests_per_second": f'sum(rate(vllm:request_success_total{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            "mean_tokens_per_request": f'sum(rate(vllm:request_generation_tokens_sum{{pod=~"{release_name}-.*"}}[{rate_window}])) / sum(rate(vllm:request_generation_tokens_count{{pod=~"{release_name}-.*"}}[{rate_window}]))',
            # GPU metrics
            "gpu_utilization": f'avg(vllm:gpu_utilization{{pod=~"{release_name}-.*"}})',
            "gpu_cache_usage": f'avg(vllm:gpu_cache_usage_perc{{pod=~"{release_name}-.*"}})',
        }

        # Add requested metrics to the list if they're not already in the dashboard metrics
        for metric in metric_names:
            if metric not in vllm_dashboard_metrics and metric != "tokens_total":
                if "vllm:" in metric or ":" in metric:
                    vllm_dashboard_metrics[metric] = (
                        f'sum({metric}{{pod=~"{release_name}-.*"}})'
                    )
                else:
                    vllm_dashboard_metrics[metric] = (
                        f'sum(vllm:{metric}{{pod=~"{release_name}-.*"}})'
                    )

        # Use dashboard metrics if no specific metrics were requested
        metrics_to_fetch = (
            metric_names if metric_names else list(vllm_dashboard_metrics.keys())
        )

        # Process each requested metric
        for metric_name in metrics_to_fetch:
            # Build appropriate query based on metric name
            if metric_name in vllm_dashboard_metrics:
                query = vllm_dashboard_metrics[metric_name]
            elif metric_name == "tokens_total":
                # Special case for combined tokens - use exact format that works
                query = f'sum(vllm:prompt_tokens_total{{pod=~"{release_name}-.*"}}) + sum(vllm:generation_tokens_total{{pod=~"{release_name}-.*"}})'
            elif ":" in metric_name:
                # Direct Prometheus metric name
                query = f'sum({metric_name}{{pod=~"{release_name}-.*"}})'
            else:
                # Add vllm: prefix if not specified
                query = f'sum(vllm:{metric_name}{{pod=~"{release_name}-.*"}})'

            # Query parameters - Prometheus requires Unix timestamp
            if use_range_query:
                # For range queries, we need start, end and step
                end_time = now_unix
                start_time = end_time - (
                    time_range_minutes * 60
                )  # Convert minutes to seconds
                step = "60s"  # 1 minute resolution
                params = {
                    "query": query,
                    "start": start_time,
                    "end": end_time,
                    "step": step,
                }
            else:
                # For instant queries, we just need the time
                params = {
                    "query": query,
                    "time": now_unix,
                }  # Current time as Unix timestamp

            logger.info(f"Querying Google Cloud Monitoring with: {query}")

            try:
                # Make the API request to Google Cloud Monitoring
                url = f"{api_endpoint}?{urlencode(params)}"
                response = requests.get(url, headers=auth_headers)

                if response.status_code == 200:
                    metric_data = response.json()
                    results[metric_name] = metric_data
                    # Log the full response for debugging
                    logger.info(f"Successfully retrieved metrics for {metric_name}")
                    logger.info(f"Response data: {json.dumps(metric_data)}")
                else:
                    error_msg = f"Error querying metric {metric_name}: HTTP {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    results[metric_name] = {"error": error_msg}

            except Exception as e:
                logger.error(f"Error processing metric {metric_name}: {str(e)}")
                results[metric_name] = {"error": str(e)}

        # Process results to provide a more user-friendly format with enhanced error handling and data formatting
        processed_results = {}
        for metric_name, data in results.items():
            if "error" in data:
                processed_results[metric_name] = {"error": data["error"]}
                continue

            if data.get("status") == "success" and "result" in data.get("data", {}):
                result_data = data["data"]["result"]
                if result_data:
                    # Handle different response formats based on query type
                    if use_range_query:
                        # Range query returns values array with timestamps
                        try:
                            # Get the values from the range
                            values = result_data[0].get("values", [])
                            if values:
                                # Process all values for time series data
                                processed_values = []
                                for timestamp, value_str in values:
                                    try:
                                        value = float(value_str)
                                        processed_values.append(
                                            {"timestamp": timestamp, "value": value}
                                        )
                                    except (ValueError, TypeError):
                                        # Skip invalid values but log them
                                        logger.warning(
                                            f"Invalid value format in time series: {value_str} at {timestamp}"
                                        )

                                # Get the last value (most recent) for summary
                                latest_value = values[-1]
                                if len(latest_value) >= 2:
                                    try:
                                        value = float(latest_value[1])
                                        # Format special metrics for better readability
                                        formatted_value = _format_metric_value(
                                            metric_name, value
                                        )

                                        processed_results[metric_name] = {
                                            "value": value,
                                            "formatted_value": formatted_value,
                                            "timestamp": latest_value[0],
                                            "labels": result_data[0].get("metric", {}),
                                            "values": processed_values,  # Include processed history
                                            "unit": _get_metric_unit(metric_name),
                                        }
                                    except (ValueError, TypeError) as e:
                                        processed_results[metric_name] = {
                                            "error": f"Invalid value format in range: {str(e)}",
                                            "raw_value": latest_value[1],
                                        }
                                else:
                                    processed_results[metric_name] = {
                                        "error": "Invalid value format in range"
                                    }
                            else:
                                processed_results[metric_name] = {
                                    "value": 0,
                                    "formatted_value": "0",
                                    "info": "Empty values array",
                                    "unit": _get_metric_unit(metric_name),
                                }
                        except (ValueError, TypeError, IndexError) as e:
                            processed_results[metric_name] = {
                                "error": f"Error processing range data: {str(e)}"
                            }
                    else:
                        # Instant query returns single value
                        value_data = result_data[0].get("value", [0, "0"])
                        if len(value_data) >= 2:
                            try:
                                value = float(value_data[1])
                                # Format special metrics for better readability
                                formatted_value = _format_metric_value(
                                    metric_name, value
                                )

                                processed_results[metric_name] = {
                                    "value": value,
                                    "formatted_value": formatted_value,
                                    "timestamp": value_data[0],
                                    "labels": result_data[0].get("metric", {}),
                                    "unit": _get_metric_unit(metric_name),
                                }
                            except (ValueError, TypeError) as e:
                                processed_results[metric_name] = {
                                    "error": f"Invalid value format: {str(e)}",
                                    "raw_value": value_data[1],
                                }
                        else:
                            processed_results[metric_name] = {
                                "error": "Invalid value data structure"
                            }
                else:
                    # Try to get alternative metrics if standard ones aren't available
                    if (
                        metric_name == "vllm:gpu_utilization"
                        and "nvidia_gpu_utilization_percent" not in metric_names
                    ):
                        # Add nvidia_gpu_utilization_percent to the list of metrics to try next
                        metric_names.append("nvidia_gpu_utilization_percent")
                    elif (
                        metric_name == "memory_usage"
                        and "container_memory_usage_bytes" not in metric_names
                    ):
                        # Add container_memory_usage_bytes to the list of metrics to try next
                        metric_names.append("container_memory_usage_bytes")

                    processed_results[metric_name] = {
                        "value": 0,
                        "formatted_value": "0",
                        "info": "No data available",
                        "unit": _get_metric_unit(metric_name),
                    }

        # Add some calculated metrics with proper formatting
        if (
            "vllm:prompt_tokens_total" in processed_results
            and "vllm:generation_tokens_total" in processed_results
        ):
            prompt_tokens = processed_results["vllm:prompt_tokens_total"].get(
                "value", 0
            )
            gen_tokens = processed_results["vllm:generation_tokens_total"].get(
                "value", 0
            )
            total_value = prompt_tokens + gen_tokens
            processed_results["total_tokens"] = {
                "value": total_value,
                "formatted_value": f"{int(total_value)}",
                "timestamp": int(datetime.now().timestamp()),
                "unit": "tokens",
            }

        return MetricsResponse(
            success=True,
            message="Metrics retrieved successfully",
            metrics=processed_results,
            timestamp=now_iso,
        )

    except Exception as e:
        logger.error(f"Error retrieving cloud metrics: {str(e)}")
        return MetricsResponse(
            success=False, message=f"Error retrieving cloud metrics: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """API health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
