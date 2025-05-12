# vDeploy Spec

## Cluster Management

### Clusters List

Users can view the list of clusters in the Clusters Tab for each project. For each cluster users can see:

- Cluster Name
- Project ID
- Zone [(for more information)](https://cloud.google.com/compute/docs/regions-zones#available)
- Status
- GPU Type [(for more information)](https://cloud.google.com/compute/docs/gpus)
- GPU Count
- Created (Date)

In this tab, users can also navigate to Cluster Creation page, Cluster Details page or delete their clusters.

### Cluster Details

In the Cluster Details page, users can see the following information:

**Cluster Information**

- Cluster Status
- Created (Date)
- Project ID
- Zone [(for more information)](https://cloud.google.com/compute/docs/regions-zones#available)
- Endpoint

**Node Information**

- CPU Nodes (Count)
- GPU Nodes (Count)
- GPU Type [(for more information)](https://cloud.google.com/compute/docs/gpus)

**Instructions**

- To connect to the cluster
- To check GPU nodes
- To deploy a VLLM Service

Users can also see Real-time logs from the cluster creation process and delete their clusters here.

### Cluster Creation

Users can create clusters with the following configuration options:

**Project Information**

- Project ID (dropdown of available projects or custom entry)
- Zone (e.g., us-central1-a)
- Cluster Name (auto-generated with timestamp)

**Networking (Optional)**

- VPC Network
- Subnetwork

**CPU Node Configuration**

- Machine Type (e2-standard-4, e2-standard-8, e2-standard-16) [(for more information)](https://cloud.google.com/compute/docs/general-purpose-machines)
- Number of Nodes (1-10)

**GPU Node Configuration**

- GPU Pool Name
- GPU Machine Type (g2-standard-8, g2-standard-16, g2-standard-32) [(for more information)](https://cloud.google.com/compute/docs/general-purpose-machines)
- GPU Type (NVIDIA L4, T4, A100, V100)
- GPU Nodes (1-10)
- GPUs per Node (1-8)
- Min/Max GPU Nodes for autoscaling (0-10)

**Advanced Options**

- Debug output toggle

Authentication check ensures user is logged in with gcloud before cluster creation.

## Deployment Management

### Deployments List

Users can view the list of deployments with the following information:

- Deployment Name
- Model (e.g., google/gemma-1.1-2b-it)
- Namespace
- Status (Deployed/Running, Pending, Failed) with colored badges
- Health Status (Healthy, Unhealthy, Warning) with colored indicators
- Created Date
- Deployment ID
- Refresh button for individual deployments
- Click to view deployment details

Empty state shows when no deployments exist with option to create first deployment.

### Deployment Creation

Users can create deployments with the following configuration:

**Basic Settings**

- Target Cluster (dropdown of available clusters)
- Model Path (HuggingFace model path)
- Deployment Name (auto-generated based on model)
- Hugging Face Token (for private models)

**Advanced Settings** (in collapsible section)

- CPU Count
- Memory (4GB, 8GB, 16GB, 32GB)
- GPU Count
- GPU Type (NVIDIA L4, T4, A100, V100)
- Image Repository
- Image Tag
- Data Type (bfloat16, float16, float32)
- Tensor Parallel Size
- Environment (Development, Staging, Production)
- Enable Chunked Prefill toggle

Browse models button redirects to models page for model selection.

### Deployment Details

**Hero Section**

- Deployment name with server icon
- Namespace and creation date
- Status badge with icon
- Deployment ID
- Refresh and delete buttons

**Status Cards**

- Deployment Status card showing model, health, and ready status
- Configuration card showing name and namespace

**Actions**

- "Chat with this model" button navigating to completions
- API usage examples with copy-to-clipboard functionality
- Real-time log streaming with start/stop controls

## Models

vDeploy is suitable to support all models that are compatible with vLLM, however it has been tested with Text Generation models. For more information, please refer to the [vLLM Supported Models](https://docs.vllm.ai/en/latest/models/supported_models.html).

## Metrics

We are currently exposing the following metrics in the Analytics Tab:

**Token Metrics**

- Prompt Tokens
- Generation Tokens
- Total Tokens
- Token Throughput

**Timing Metrics**

- Time to First Token (P95)
- Time per Output Token (P95)

**End-to-End (E2E) Latency**

- E2E Latency (P95)
- E2E Latency (P50)
- E2E Latency (P99)

**Request Metrics**

- Requests Completed
- Requests per Second
- Mean Tokens per Request

**GPU Metrics**

- GPU Utilization
- GPU Cache Usage

Exposing the remaining metrics are also trivial, for more information, please refer to the [vLLM Production Metrics](https://docs.vllm.ai/en/latest/serving/metrics.html).

## Logs

In the logs tab, we are exposing the logs of the vLLM pod. These logs can include:

- **Server Configuration & Startup** (Model: Google Gemma 1.1 2B, GPU memory: 90%, Max tokens: 8192)
- **API Endpoints Available** (/health, /v1/models, /v1/completions, /v1/chat/completions, /metrics)
- **Request Activity** (Chat completion attempts, Request IDs like cmpl-xxx)
- **Performance Metrics** (~1-11 tokens/sec prompt processing, ~2-30 tokens/sec generation, Prefix cache hit rates 0-65%)
- **Errors & Issues** (Context length exceeded 8192 limit, Chat role alternation errors, 404 errors from scanning attempts)
- **Client Activity Patterns** (Regular health checks every 10 seconds, Metrics collection, Model availability queries)
- **Notable Behaviors** (Prefix caching improves efficiency over time, Automated security scanning attempts)

## Completions

Completions Tab enables users to generate completions from the deployed model. We currently provide the following parameters in the UI:

- Deployment
- Temperature
- Max Tokens

vLLM API is OpenAI compatible, so adding other parameters would be trivial, for more information, please refer to the [OpenAI Chat Completions API Reference](https://platform.openai.com/docs/api-reference/chat).
