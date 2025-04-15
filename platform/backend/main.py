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


class DeploymentResponse(BaseModel):
    success: bool
    message: str
    service_url: Optional[str] = None


class DeploymentStatus(BaseModel):
    name: str
    namespace: str
    status: str
    model: str
    created_at: str


class DeploymentStatus(BaseModel):
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
    pod_status: Dict[str, str] = {}


class DeploymentLog(BaseModel):
    pod_name: str
    container_name: str
    log: str
    timestamp: str


active_deployments = {}


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.log_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket, deployment_id: str):
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

    async def stream_logs(self, deployment_id: str, namespace: str, release_name: str):
        try:
            pod_cmd = f"kubectl get pods -n {namespace} -l app={release_name} -o jsonpath='{{.items[*].metadata.name}}'"
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

            pod_names = result.stdout.split()
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
async def websocket_logs(websocket: WebSocket, deployment_id: str):
    try:
        await manager.connect(websocket, deployment_id)
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

        deployment_id = str(uuid.uuid4())
        print(f"Deployment ID: {deployment_id}")

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

        service_url = f"{release_name}.{namespace}.svc.cluster.local"

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
        # Kubernetes service connectivity check
        cmd = f"kubectl exec -n {namespace} deploy/{release_name}-deployment-router -- curl -s http://localhost:8000/v1/models"
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
            logs_cmd = f"kubectl logs -n {namespace} -l app={release_name}-gemma-1.1-2b-it-deployment-vllm --tail=50"
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


@app.get("/deployments/", response_model=List[DeploymentStatus])
async def list_deployments_endpoint(
    namespace: Optional[str] = Query(None, description="Filter by namespace")
):
    try:
        helm_cmd = (
            f"helm list -n {namespace} -o json"
            if namespace
            else "helm list --all-namespaces -o json"
        )
        helm_result = await asyncio.to_thread(
            lambda: subprocess.run(helm_cmd, shell=True, text=True, capture_output=True)
        )

        if helm_result.returncode != 0:
            logger.error(f"Failed to get Helm releases: {helm_result.stderr}")
            return []

        deployments = []
        try:
            helm_releases = json.loads(helm_result.stdout)

            for release in helm_releases:
                release_name = release.get("name")
                release_namespace = release.get("namespace", namespace or "default")

                if not release_name:
                    continue

                deployment_status = await get_enhanced_deployment_status(
                    release_namespace, release_name
                )
                deployments.append(deployment_status)

        except json.JSONDecodeError as e:
            logger.error(f"Error parsing Helm JSON: {str(e)}")
            logger.error(f"Helm output: {helm_result.stdout}")

        return deployments
    except Exception as e:
        logger.error(f"List error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# @app.get("/deployments/", response_model=List[DeploymentStatus])
# async def list_deployments_endpoint(
#     namespace: Optional[str] = Query(None, description="Filter by namespace")
# ):
#     """List all vLLM deployments"""
#     try:
#         args = Namespace(
#             namespace=namespace, stream_output=False, debug=False, command="list"
#         )

#         cmd = (
#             f"kubectl get pods --all-namespaces -o json"
#             if not namespace
#             else f"kubectl get pods -n {namespace} -o json"
#         )
#         result = await asyncio.to_thread(
#             lambda: subprocess.run(cmd, shell=True, text=True, capture_output=True)
#         )

#         deployments = []

#         if result.returncode == 0 and result.stdout:
#             try:
#                 pods_data = json.loads(result.stdout)

#                 deployment_pods = {}
#                 for pod in pods_data.get("items", []):
#                     name = pod["metadata"]["labels"].get("app.kubernetes.io/instance")
#                     if name:
#                         if name not in deployment_pods:
#                             deployment_pods[name] = []
#                         deployment_pods[name].append(pod)

#                 for name, pods in deployment_pods.items():
#                     if pods:
#                         pod = pods[0]
#                         labels = pod["metadata"]["labels"]
#                         namespace = pod["metadata"]["namespace"]

#                         helm_cmd = f"helm get values -n {namespace} {name} -o json"
#                         helm_result = await asyncio.to_thread(
#                             lambda: subprocess.run(
#                                 helm_cmd, shell=True, text=True, capture_output=True
#                             )
#                         )

#                         model = "unknown"
#                         gpu_count = 0
#                         cpu_count = 0
#                         memory = ""

#                         if helm_result.returncode == 0 and helm_result.stdout:
#                             try:
#                                 values = json.loads(helm_result.stdout)
#                                 if (
#                                     "servingEngineSpec" in values
#                                     and "modelSpec" in values["servingEngineSpec"]
#                                 ):
#                                     model_spec = values["servingEngineSpec"][
#                                         "modelSpec"
#                                     ][0]
#                                     model = model_spec.get("modelURL", "unknown")
#                                     gpu_count = model_spec.get("requestGPU", 0)
#                                     cpu_count = model_spec.get("requestCPU", 0)
#                                     memory = model_spec.get("requestMemory", "")
#                             except json.JSONDecodeError:
#                                 pass

#                         pod_status = {}
#                         for pod in pods:
#                             pod_name = pod["metadata"]["name"]
#                             phase = pod["status"]["phase"]
#                             pod_status[pod_name] = phase

#                         service_url = f"{name}.{namespace}.svc.cluster.local"

#                         deployment_status = DeploymentStatus(
#                             name=name,
#                             namespace=namespace,
#                             status=(
#                                 "Running"
#                                 if all(
#                                     status == "Running"
#                                     for status in pod_status.values()
#                                 )
#                                 else "Pending"
#                             ),
#                             model=model,
#                             created_at=pod["metadata"]["creationTimestamp"],
#                             gpu_count=gpu_count,
#                             cpu_count=cpu_count,
#                             memory=memory,
#                             image=pod["spec"]["containers"][0]["image"],
#                             service_url=service_url,
#                             pod_status=pod_status,
#                         )
#                         deployments.append(deployment_status)
#             except Exception as e:
#                 logger.error(f"Error parsing JSON: {str(e)}")
#         return deployments
#     except Exception as e:
#         logger.error(f"List error: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


@app.get("/deployments/{deployment_id}", response_model=DeploymentStatus)
async def get_deployment(deployment_id: str):
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]

    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    cmd = f"kubectl get pods -n {namespace} -l app={release_name} -o json"
    result = await asyncio.to_thread(
        lambda: subprocess.run(cmd, shell=True, text=True, capture_output=True)
    )

    pod_status = {}
    status = deployment["status"]

    if result.returncode == 0 and result.stdout:
        try:
            pods_data = json.loads(result.stdout)

            running_pods = 0
            total_pods = len(pods_data.get("items", []))

            for pod in pods_data.get("items", []):
                pod_name = pod["metadata"]["name"]
                phase = pod["status"]["phase"]
                pod_status[pod_name] = phase

                if phase == "Running":
                    running_pods += 1

            if total_pods > 0:
                if running_pods == total_pods:
                    status = "Running"
                elif running_pods > 0:
                    status = "Partially Running"
                else:
                    status = "Pending"
        except Exception as e:
            logger.error(f"Error parsing JSON: {str(e)}")

    deployment_status = DeploymentStatus(
        name=deployment["release_name"],
        namespace=deployment["namespace"],
        status=status,
        model=deployment["model_path"],
        created_at=deployment["created_at"],
        updated_at=deployment.get("updated_at"),
        gpu_count=deployment["gpu_count"],
        cpu_count=deployment["cpu_count"],
        memory=deployment["memory"],
        image=deployment["image"],
        service_url=f"{deployment['release_name']}.{deployment['namespace']}.svc.cluster.local",
        pod_status=pod_status,
    )

    return deployment_status


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
        purge=True,
        stream_output=False,
        debug=False,
        command="delete",
    )

    # Delete in background
    def _delete():
        try:
            success = delete_deployment(args)

            if success:
                deployment["status"] = "deleted"
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
            stream_output=False,
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
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    pod_cmd = f"kubectl get pods -n {namespace} -l app={release_name} -o jsonpath='{{.items[*].metadata.name}}'"
    result = await asyncio.to_thread(
        lambda: subprocess.run(pod_cmd, shell=True, text=True, capture_output=True)
    )

    if result.returncode != 0:
        raise HTTPException(
            status_code=500, detail=f"Failed to get pods: {result.stderr}"
        )

    pod_names = result.stdout.split()
    if not pod_names:
        raise HTTPException(status_code=404, detail="No pods found")

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


@app.get("/health")
async def health_check():
    """API health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
