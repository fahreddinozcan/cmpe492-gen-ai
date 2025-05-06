from fastapi import APIRouter, BackgroundTasks
from typing import List
from fastapi.responses import JSONResponse
import asyncio
import subprocess
import json
from app.models.cluster import ClusterListItem, ClusterResponse, ClusterCreateRequest
from app.services.cluster_service import (
    list_clusters,
    get_cluster,
    create_cluster,
    delete_cluster,
    get_cluster_progress,
    refresh_deployments_for_cluster
)

router = APIRouter()

@router.get("/clusters", response_model=List[ClusterListItem])
async def list_clusters_endpoint():
    return await list_clusters()

@router.get("/clusters/{cluster_id}", response_model=ClusterListItem)
async def get_cluster_endpoint(cluster_id: str):
    return await get_cluster(cluster_id)

@router.post("/clusters", response_model=ClusterResponse)
async def create_cluster_endpoint(request: ClusterCreateRequest, background_tasks: BackgroundTasks):
    return await create_cluster(request, background_tasks)

@router.delete("/clusters/{cluster_id}", response_model=ClusterResponse)
async def delete_cluster_endpoint(cluster_id: str):
    return await delete_cluster(cluster_id)

@router.get("/clusters/{cluster_id}/progress")
async def get_cluster_progress_endpoint(cluster_id: str):
    return await get_cluster_progress(cluster_id)

@router.post("/clusters/{cluster_id}/refresh-deployments")
async def refresh_deployments_endpoint(cluster_id: str):
    return await refresh_deployments_for_cluster(cluster_id)

@router.get("/gcloud/projects")
async def list_gcloud_projects():
    """List all available GCP projects using gcloud CLI."""
    cmd = ["gcloud", "projects", "list", "--format=json"]
    try:
        proc = await asyncio.to_thread(
            lambda: subprocess.run(cmd, capture_output=True, text=True, check=True)
        )
        projects = json.loads(proc.stdout)
        # Return only relevant fields
        return JSONResponse(
            [
                {
                    "project_id": p.get("projectId"),
                    "name": p.get("name"),
                    "project_number": p.get("projectNumber"),
                }
                for p in projects
            ]
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
