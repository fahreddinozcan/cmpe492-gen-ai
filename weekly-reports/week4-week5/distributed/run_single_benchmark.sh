#!/bin/bash
# run_single_benchmark.sh

# Check arguments
if [ "$#" -ne 6 ]; then
    echo "Usage: $0 <name> <model_path> <max_seq> <batch_size> <users> <prompt_type>"
    echo "Example: $0 mistral-seq64 mistralai/Mistral-7B-Instruct-v0.3 64 32 10 mixed"
    exit 1
fi

NAME=$1
MODEL_PATH=$2
MAX_SEQ=$3
BATCH_SIZE=$4
USERS=$5
PROMPT_TYPE=$6

echo "Deploying $NAME with $MODEL_PATH..."
./deploy_model.sh $NAME $MODEL_PATH $MAX_SEQ $BATCH_SIZE

# Wait for the model to fully initialize
echo "Waiting for 60 seconds to ensure the model is fully loaded..."
sleep 60

# Start port forwarding in the background
kubectl port-forward service/$NAME 8000:80 &
PF_PID=$!

# Wait for port-forwarding to establish
sleep 5

# Check health
HEALTH_STATUS=$(curl -s http://localhost:8000/health)
if [[ "$HEALTH_STATUS" != *"ok"* ]]; then
    echo "Health check failed: $HEALTH_STATUS"
    kill $PF_PID
    exit 1
fi

echo "Health check passed: $HEALTH_STATUS"
echo "Running benchmark..."

# Run the benchmark
export BATCH_SIZE=$BATCH_SIZE
export USER_COUNT=$USERS
export TEST_PHASE="${NAME}_users${USERS}"
export MODEL_NAME=$MODEL_PATH
export PROMPT_TYPE=$PROMPT_TYPE

# Run locust for 2 minutes
locust -f locustfile.py --host http://localhost:8000 --headless -u $USERS --run-time 2m

# Clean up
kill $PF_PID
echo "Benchmark complete! Results saved to vllm_metrics_${TEST_PHASE}_*.csv"

read -p "Do you want to delete the deployment? (y/n): " DELETE_DEPLOYMENT
if [[ "$DELETE_DEPLOYMENT" == "y" ]]; then
    kubectl delete deployment $NAME
    kubectl delete service $NAME
    kubectl delete podmonitoring $NAME-monitoring
    echo "Deployment deleted."
else
    echo "Deployment kept running."
fi