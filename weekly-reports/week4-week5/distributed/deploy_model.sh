#!/bin/bash
# deploy_model.sh

# Check arguments
if [ "$#" -ne 4 ]; then
    echo "Usage: $0 <name> <model_path> <max_seq> <batch_size>"
    echo "Example: $0 mistral-seq64 mistralai/Mistral-7B-Instruct-v0.3 64 32"
    exit 1
fi

NAME=$1
MODEL_PATH=$2
MAX_SEQ=$3
BATCH_SIZE=$4

# Create a temporary file with the replacements
cat model-deployment.yaml | \
  sed "s|MODEL_NAME_PLACEHOLDER|$NAME|g" | \
  sed "s|HF_MODEL_PATH|$MODEL_PATH|g" | \
  sed "s|MAX_SEQ_PLACEHOLDER|$MAX_SEQ|g" | \
  sed "s|BATCH_SIZE_PLACEHOLDER|$BATCH_SIZE|g" > /tmp/current-deployment.yaml

# Apply the modified configuration
kubectl apply -f /tmp/current-deployment.yaml

echo "Waiting for deployment to be ready..."
kubectl rollout status deployment/$NAME

echo "Deployment $NAME is ready!"
echo "Access it using: kubectl port-forward service/$NAME 8000:80"