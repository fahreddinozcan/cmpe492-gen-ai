from fastapi import APIRouter, BackgroundTasks, Query
from typing import List, Optional
from app.models.deployment import DeploymentListItem, DeploymentStatus, DeploymentResponse, DeploymentRequest, UpdateDeploymentRequest
from app.services.deployment_service import (
    list_deployments_endpoint,
    get_deployment,
    create_deployment,
    delete_deployment_by_id,
    delete_deployment_endpoint,
    get_deployment_pods,
    get_deployment_logs,
    refresh_deployment_status,
    get_deployment_by_name,
    port_forward_to_deployment,
    proxy_chat_to_llm
)

router = APIRouter()

@router.get("/deployments/", response_model=List[DeploymentListItem])
async def list_deployments(namespace: Optional[str] = Query(None, description="Filter by namespace")):
    return await list_deployments_endpoint(namespace)

@router.get("/deployments/{deployment_id}", response_model=DeploymentStatus)
async def get_deployment_endpoint(deployment_id: str):
    return await get_deployment(deployment_id)

@router.post("/deployments/", response_model=DeploymentResponse)
async def create_deployment_endpoint(request: DeploymentRequest, background_tasks: BackgroundTasks):
    return await create_deployment(request, background_tasks)

@router.delete("/deployments/{deployment_id}")
async def delete_deployment_by_id_endpoint(deployment_id: str, background_tasks: BackgroundTasks):
    return await delete_deployment_by_id(deployment_id, background_tasks)

@router.delete("/deployments/by-name/{namespace}/{release_name}")
async def delete_deployment_by_name_endpoint(namespace: str, release_name: str, background_tasks: BackgroundTasks):
    return await delete_deployment_endpoint(namespace, release_name, background_tasks)

@router.get("/deployments/{deployment_id}/pods")
async def get_deployment_pods_endpoint(deployment_id: str):
    return await get_deployment_pods(deployment_id)

@router.get("/deployments/{deployment_id}/logs")
async def get_deployment_logs_endpoint(deployment_id: str, tail: Optional[int] = Query(100, description="Number of lines to return")):
    return await get_deployment_logs(deployment_id, tail)

@router.post("/deployments/{deployment_id}/refresh-status")
async def refresh_deployment_status_endpoint(deployment_id: str):
    return await refresh_deployment_status(deployment_id)

@router.get("/deployments/by-name/{namespace}/{name}", response_model=DeploymentStatus)
async def get_deployment_by_name_endpoint(namespace: str, name: str):
    return await get_deployment_by_name(namespace, name)

@router.post("/deployments/{deployment_id}/port-forward")
async def port_forward_to_deployment_endpoint(deployment_id: str, background_tasks: BackgroundTasks):
    return await port_forward_to_deployment(deployment_id, background_tasks)

@router.post("/deployments/{deployment_id}/chat")
async def proxy_chat_to_llm_endpoint(deployment_id: str, request: dict):
    return await proxy_chat_to_llm(deployment_id, request)
