# vLLM Deployment Platform

To check gcloud and create cluster with GPU support

```shell
python deployment/gcloud/main.py \
  --project-id=cmpe492-451815 \
  --zone=us-central1-a \
  --cluster-name=vllm-cluster \
  --machine-type=e2-standard-4 \
  --num-nodes=3 \
  --gpu-machine-type=g2-standard-8 \
  --gpu-type=nvidia-l4 \
  --debug
```

---

## Delete Cluster

```shell
python deployment/gcloud/main.py delete \
  --project-id=cmpe492-451815 \
  --zone=us-central1-a \
  --cluster-name=vllm-cluster
  --force-delete
```
