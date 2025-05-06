from pydantic import BaseModel, Field
from typing import Optional

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