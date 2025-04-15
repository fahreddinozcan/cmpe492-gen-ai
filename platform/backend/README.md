to start the server

```
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

create deployment

```bash
curl -X POST http://localhost:8000/deployments/ \
  -H "Content-Type: application/json" \
  -d '{
    "model_path": "google/gemma-1.1-2b-it",
    "release_name": "gemma-new",
    "namespace": "vllm",
    "hf_token": "TOKEN",
    "gpu_type": "nvidia-l4",
    "cpu_count": 2,
    "memory": "8Gi",
    "gpu_count": 1,
    "environment": "dev",
    "image_repo": "vllm/vllm-openai",
    "image_tag": "latest",
    "dtype": "bfloat16",
    "tensor_parallel_size": 1,
    "enable_chunked_prefill": false
  }'
```

list deployments

```bash
curl -X GET http://localhost:8000/deployments/
```

get deployment by ID

```bash
curl -X GET http://localhost:8000/deployments/{deployment_id}
```

get deployment by name and namespace

```bash
curl -X GET http://localhost:8000/deployments/by-name/{namespace}/{name}
```

refresh deployment status

```bash
curl -X POST http://localhost:8000/deployments/{deployment_id}/refresh
```

delete deployment by ID

```bash
curl -X DELETE http://localhost:8000/deployments/{deployment_id}
```

delete deployment by name and namespace

```bash
curl -X DELETE http://localhost:8000/deployments/{namespace}/{name}
```

get deployment logs

```bash
curl -X GET "http://localhost:8000/deployments/{deployment_id}/logs?tail=100"
```

stream logs (WebSocket)

```javascript
// JavaScript example
const deploymentId = "your-deployment-id";
const socket = new WebSocket(`ws://localhost:8000/ws/logs/${deploymentId}`);

socket.onmessage = function(event) {
  const logData = JSON.parse(event.data);
  console.log(`${logData.pod_name}: ${logData.log}`);
};
```
