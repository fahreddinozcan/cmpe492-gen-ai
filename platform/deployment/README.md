To download chart

```shell
mkdir -p vllm-chart
curl -L https://github.com/vllm-project/vllm/archive/refs/heads/main.zip -o vllm-main.zip
unzip vllm-main.zip
cp -r vllm-main/examples/online_serving/chart-helm/* vllm-chart/
rm -rf vllm-main vllm-main.zip
```

To run basic

```shell
python main.py deploy \
  --model-path=google/gemma-1.1-2b-it \
  --release-name=vllm-gemma \
  --namespace=vllm \
  --hf-token=YOUR_HUGGING_FACE_TOKEN \
  --debug
```

To run with custom config

```shell
python main.py deploy \
  --model-path=google/gemma-1.1-2b-it \
  --release-name=vllm-gemma \
  --namespace=vllm \
  --gpu-count=1 \
  --cpu-count=6 \
  --memory=24Gi \
  --storage=20Gi \
  --hf-token=YOUR_HUGGING_FACE_TOKEN \
  --stream-output
```

### Listing Deployments

```bash
# List all vLLM deployments
python main.py list

# List deployments in a specific namespace
python main.py list --namespace=vllm
```

### Deleting a Deployment

```bash
# Delete a deployment
python main.py delete --release-name=vllm-gemma --namespace=vllm

# Delete with purge option (complete removal)
python main.py delete --release-name=vllm-gemma --namespace=vllm --purge
```

## Command Reference

### Common Options

- `--debug`: Enable debug output
- `--stream-output`: Stream command output in
