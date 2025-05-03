from pydantic import BaseModel
from typing import Optional, Any

class ClusterCreateRequest(BaseModel):
    project_id: str
    zone: str
    cluster_name: str
    machine_type: str
    num_nodes: int
    gpu_machine_type: str
    gpu_type: str
    gpu_nodes: int = 1
    gpus_per_node: int = 1
    min_gpu_nodes: int = 0
    max_gpu_nodes: int = 5
    debug: bool = False

class ClusterResponse(BaseModel):
    success: bool
    message: str
    cluster_id: Optional[str] = None
    detail: Optional[Any] = None

class ClusterListItem(BaseModel):
    cluster_id: str
    name: str
    status: str
    zone: str
    project_id: str
    created_at: Optional[str] = None
