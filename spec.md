# vDeploy Spec

## Cluster Management

### Clusters List

Users can view the list of clusters in the Clusters Tab for each project. For each cluster users can see:

- Cluster Name
- Project ID
- Zone
- Status
- GPU Type
- GPU Count
- Created (Date)

In this tab, users can also navigate to Cluster Creation page, Cluster Details page or delete their clusters.

### Cluster Details

In the Cluster Details page, users can see the following information:

**Cluster Information**
- Cluster Status
- Created (Date)
- Project ID
- Zone
- Endpoint

**Node Information**
- CPU Nodes (Count)
- GPU Nodes (Count)
- GPU Type

**Instructions**
- To connect to the cluster
- To check GPU nodes
- To deploy a VLLM Service

Users can also see Real-time logs from the cluster creation process and delete their clusters here.

### Cluster Creation

### Cluster Deletion

## Deployment Management

### Deployments List

### Deployment Creation

### Deployment Deletion

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