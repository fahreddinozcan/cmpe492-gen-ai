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

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from deployment.deploy_vllm import deploy_vllm, delete_deployment, list_deployments
from deployment.utils.command import run_command


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
    hf_token: Optional[str] = Field(None, description="Hugging Face token")
    gpu_type: str = Field("nvidia-l4", description="GPU type")
    cpu_count: int = Field(2, description="CPU count")
    memory: str = Field("8Gi", description="Memory allocation")
    gpu_count: int = Field(1, description="GPU count")
    environment: str = Field("prod", description="Environment name")
    image_repo: str = Field("vllm/vllm-openai", description="Image repository")
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


active_deployments = {}


async def initialize_deployments():
    """Initialize the active_deployments dictionary with existing deployments"""
    try:
        # Get all namespaces
        ns_cmd = "kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'"
        ns_result = await asyncio.to_thread(
            lambda: subprocess.run(ns_cmd, shell=True, text=True, capture_output=True)
        )

        if ns_result.returncode == 0 and ns_result.stdout:
            namespaces = ns_result.stdout.split()

            # For each namespace, get the deployments
            for namespace in namespaces:
                helm_cmd = f"helm list -n {namespace} -o json"
                helm_result = await asyncio.to_thread(
                    lambda: subprocess.run(
                        helm_cmd, shell=True, text=True, capture_output=True
                    )
                )

                if helm_result.returncode == 0 and helm_result.stdout:
                    try:
                        helm_releases = json.loads(helm_result.stdout)

                        for release in helm_releases:
                            release_name = release.get("name")
                            release_namespace = release.get("namespace", namespace)

                            # Check if it's a vLLM deployment
                            if release_name and (
                                "vllm" in release.get("chart", "").lower()
                                or "llm" in release_name.lower()
                            ):
                                # Generate a deterministic deployment ID based on namespace and release name
                                # This ensures the same deployment gets the same ID across server restarts
                                unique_key = f"{release_namespace}:{release_name}"
                                deployment_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_key))

                                # Get enhanced status
                                status = await get_enhanced_deployment_status(
                                    release_namespace, release_name
                                )

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
                                    "llm_status": status.get("llm_status", "unknown"),
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

        logger.info(f"Initialized {len(active_deployments)} deployments")
    except Exception as e:
        logger.error(f"Error initializing deployments: {str(e)}")


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.log_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket, deployment_id: str, pod_type: str = None):
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
                        pod_type
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

    async def stream_logs(self, deployment_id: str, namespace: str, release_name: str, pod_type: str = None):
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
                        if pod_type == "vllm" and "-vllm-" in pod_name and "-router-" not in pod_name:
                            pod_names.append(pod_name)
                            logger.info(f"Found vLLM pod for streaming logs from deployment {release_name}: {pod_name}")
                        elif pod_type == "router" and "-router-" in pod_name:
                            pod_names.append(pod_name)
                            logger.info(f"Found router pod for streaming logs from deployment {release_name}: {pod_name}")
                        elif pod_type is None:
                            # If no pod_type specified, include all pods
                            pod_names.append(pod_name)
                            logger.info(f"Found pod for streaming logs from deployment {release_name}: {pod_name}")
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
async def websocket_logs(websocket: WebSocket, deployment_id: str, pod_type: str = None):
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

        # Generate a deterministic deployment ID based on namespace and release name
        # This ensures the same deployment gets the same ID across server restarts
        unique_key = f"{request.namespace}:{request.release_name}"
        deployment_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_key))
        logger.info(f"Deployment ID: {deployment_id}")

        args = Namespace(
            model_path=request.model_path,
            release_name=request.release_name,
            namespace=request.namespace,
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
            "namespace": request.namespace,
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

        service_url = f"{request.release_name}.{request.namespace}.svc.cluster.local"
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
                if (
                    "servingEngineSpec" in values
                    and "modelSpec" in values["servingEngineSpec"]
                ):
                    model_spec = values["servingEngineSpec"]["modelSpec"][0]
                    model = model_spec.get("modelURL", "unknown")
                    gpu_count = model_spec.get("requestGPU", 0)
                    cpu_count = model_spec.get("requestCPU", 0)
                    memory = model_spec.get("requestMemory", "")
            except json.JSONDecodeError:
                pass

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
        service_cmd = f"kubectl get service {release_name}-router-service -n {namespace} -o json"
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
                    ingress = service_data.get("status", {}).get("loadBalancer", {}).get(
                        "ingress", []
                    )
                    if ingress and "hostname" in ingress[0]:
                        external_ip = ingress[0]['hostname']
                        public_url = f"http://{external_ip}"
                        logger.info(f"Found external hostname for {release_name}: {external_ip}")
                    elif ingress and "ip" in ingress[0]:
                        external_ip = ingress[0]['ip']
                        public_url = f"http://{external_ip}"
                        logger.info(f"Found external IP for {release_name}: {external_ip}")
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
        cmd = f"kubectl get service {release_name}-router-service -n {namespace} -o json"
        logger.info(f"Running command to get service details: {cmd}")
        result = await asyncio.to_thread(
            lambda: subprocess.run(
                cmd, shell=True, text=True, capture_output=True
            )
        )
        
        if result.returncode != 0:
            logger.error(f"Command failed with return code {result.returncode}: {result.stderr}")
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
                    external_ip = ingress[0]['hostname']
                    logger.info(f"Found external hostname for {release_name}: {external_ip}")
                elif "ip" in ingress[0]:
                    external_ip = ingress[0]['ip']
                    logger.info(f"Found external IP for {release_name}: {external_ip}")
                else:
                    logger.warning(f"Ingress entry exists but contains neither hostname nor ip: {ingress[0]}")
            else:
                logger.warning(f"No ingress entries found for LoadBalancer service {release_name}-router-service")
        else:
            logger.warning(f"Service {release_name}-router-service is not of type LoadBalancer, but {service_type}")
        
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

            # Create a deployment list item with only the necessary information for the UI
            deployment_item = DeploymentListItem(
                deployment_id=deployment_id,
                name=deployment.get("release_name"),
                namespace=deployment.get("namespace"),
                status=deployment.get("status", "unknown"),
                model=deployment.get("model_path", "unknown"),
                created_at=deployment.get("created_at", datetime.now().isoformat()),
                ready=deployment.get("llm_ready", False),
                health_status=deployment.get("llm_status", "unknown"),
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

                    # Create a deployment list item
                    deployment_item = DeploymentListItem(
                        deployment_id=deployment_id,
                        name=release_name,
                        namespace=release_namespace,
                        status=status.get("status", "unknown"),
                        model=status.get("model", "unknown"),
                        created_at=release.get("updated", datetime.now().isoformat()),
                        ready=status.get("llm_ready", False),
                        health_status=status.get("llm_status", "unknown"),
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
                    lambda: subprocess.run(cmd, shell=True, text=True, capture_output=True)
                )
                
                if result.returncode == 0 and result.stdout.strip() and result.stdout.strip() != "<none>":
                    external_ip = result.stdout.strip()
                    logger.info(f"Found external IP with direct kubectl command: {external_ip}")
                else:
                    logger.warning(f"Could not find external IP or hostname. Command output: {result.stdout}, Error: {result.stderr}")
    except Exception as e:
        logger.error(f"Error getting external IP directly: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    
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
        ready=enhanced_status.get("ready", False),
        health_status=enhanced_status.get("health_status", "unknown"),
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
                        logger.info(f"Removing deployment {release_name} from active deployments")
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
async def port_forward_to_deployment(deployment_id: str, background_tasks: BackgroundTasks):
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
                stderr=asyncio.subprocess.PIPE
            )
            # Store the process information for later cleanup
            if not hasattr(app, "port_forward_processes"):
                app.port_forward_processes = {}
            app.port_forward_processes[deployment_id] = process
            
            # Log the output
            logger.info(f"Started port forwarding for {release_name} in namespace {namespace} on port {port}")
            
            # Wait for a short time to ensure port-forward is established
            await asyncio.sleep(2)
            
            # Check if the port is actually open
            try:
                # Try to connect to the port
                reader, writer = await asyncio.open_connection('localhost', port)
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
    return {"success": True, "message": f"Port forwarding started for {release_name} on port {port}", "port": port}

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
                api_url,
                json=request,
                timeout=60.0  # Longer timeout for LLM responses
            )
        )
        
        # Get the response content
        if response.status_code != 200:
            logger.error(f"Error from LLM API: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Error from LLM API: {response.text}"
            )
            
        # Return the LLM response directly
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error connecting to LLM API: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to LLM API: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error proxying chat request: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error proxying chat request: {str(e)}"
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
                if any(cs.get("state", {}).get("waiting", {}).get("reason") == "CrashLoopBackOff" 
                       for cs in container_statuses):
                    pod_status = "CrashLoopBackOff"
                elif any(cs.get("state", {}).get("waiting", {}).get("reason") == "Error" 
                         for cs in container_statuses):
                    pod_status = "Error"

                deployment_pods.append({
                    "name": pod_name,
                    "status": pod_status,
                    "restarts": restarts,
                    "ready": status.get("phase") == "Running" and all(cs.get("ready", False) for cs in container_statuses),
                    "created": pod.get("metadata", {}).get("creationTimestamp", ""),
                })

        logger.info(f"Found {len(deployment_pods)} pods for deployment {release_name}")
        return {"pods": deployment_pods}

    except Exception as e:
        logger.error(f"Error getting pod status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting pod status: {str(e)}")

@app.get("/health")
async def health_check():
    """API health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
