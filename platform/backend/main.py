from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import logging
from ..deployment import deploy_vllm, delete_deployment, list_deployments
from argparse import Namespace
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vllm-api")

app = FastAPI(title="vLLM Deployment API")


class DeploymentRequest(BaseModel):
    model_path: str
    release_name: str
    namespace: str = "vllm"
    hf_token: Optional[str] = None
    gpu_type: str = "nvidia-l4"
    cpu_count: int = 2
    memory: str = "8Gi"
    gpu_count: int = 1
    environment: str = "prod"
    image_repo: str = "vllm/vllm-openai"
    image_tag: str = "latest"
    dtype: str = "bfloat16"
    tensor_parallel_size: int = 1
    enable_chunked_prefill: bool = False
    debug: bool = False
    helm_args: Optional[str] = None


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


@app.post("/deployments/", response_model=DeploymentResponse)
async def create_deployment(
    request: DeploymentRequest, background_tasks: BackgroundTasks
):
    try:

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
            chart_path="./vllm-stack",  # Set default chart path
            command="deploy",
        )

        # Start deployment in background
        success = deploy_vllm(args)

        if success:
            service_url = (
                f"{request.release_name}.{request.namespace}.svc.cluster.local"
            )
            return DeploymentResponse(
                success=True,
                message=f"Deployment started successfully",
                service_url=service_url,
            )
        else:
            raise HTTPException(status_code=500, detail="Deployment failed")

    except Exception as e:
        logger.error(f"Deployment error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/deployments/{namespace}/{release_name}")
async def delete_deployment_endpoint(namespace: str, release_name: str):
    try:
        args = Namespace(
            namespace=namespace,
            release_name=release_name,
            purge=True,
            stream_output=False,
            debug=False,
            command="delete",
        )

        success = delete_deployment(args)

        if success:
            return {
                "success": True,
                "message": f"Deployment {release_name} deleted successfully",
            }
        else:
            raise HTTPException(status_code=500, detail="Deletion failed")

    except Exception as e:
        logger.error(f"Deletion error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deployments/", response_model=List[DeploymentStatus])
async def list_deployments_endpoint(namespace: Optional[str] = None):
    try:
        args = Namespace(
            namespace=namespace, stream_output=False, debug=False, command="list"
        )

        success = list_deployments(args)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to list deployments")

        # This is a placeholder - you'll need to implement actual status retrieval
        # from your Kubernetes cluster
        return []

    except Exception as e:
        logger.error(f"List error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
