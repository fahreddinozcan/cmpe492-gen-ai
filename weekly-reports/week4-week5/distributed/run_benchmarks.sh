#!/bin/bash
# run_benchmarks.sh

# Configuration
MODELS=(
  "mistralai/Mistral-7B-Instruct-v0.3"
  "Qwen/Qwen2.5-VL-7B-Instruct"
)

SEQ_SIZES=(1 4 16 64 128)
BATCH_SIZES=(1 4 16 32 64)
USER_COUNTS=(10 20 40 60)
PROMPT_TYPES=("mixed")

# Create a directory for results
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="benchmark_results_${TIMESTAMP}"
mkdir -p $RESULTS_DIR

for MODEL_PATH in "${MODELS[@]}"; do
  # Extract a short name from the model path
  MODEL_NAME=$(echo $MODEL_PATH | cut -d'/' -f2 | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')
  
  echo "===========================================" 
  echo "Starting benchmarks for $MODEL_PATH"
  echo "===========================================" 

  for SEQ_SIZE in "${SEQ_SIZES[@]}"; do
    for BATCH_SIZE in "${BATCH_SIZES[@]}"; do
      # Skip if batch size is larger than sequence size
      if [ $BATCH_SIZE -gt $SEQ_SIZE ]; then
        continue
      fi
      
      for USER_COUNT in "${USER_COUNTS[@]}"; do
        for PROMPT_TYPE in "${PROMPT_TYPES[@]}"; do
          # Create a unique name for this configuration
          DEPLOYMENT_NAME="${MODEL_NAME}-seq${SEQ_SIZE}-batch${BATCH_SIZE}"
          TEST_NAME="${MODEL_NAME}_seq${SEQ_SIZE}_batch${BATCH_SIZE}_users${USER_COUNT}_${PROMPT_TYPE}"
          
          echo "Running benchmark: $TEST_NAME"
          echo "------------------------"
          
          # Deploy the model
          ./deploy_model.sh $DEPLOYMENT_NAME $MODEL_PATH $SEQ_SIZE $BATCH_SIZE
          
          # Wait for model to initialize fully
          echo "Waiting 60 seconds for model to initialize..."
          sleep 60
          
          # Start port forwarding in the background
          kubectl port-forward service/$DEPLOYMENT_NAME 8000:80 &
          PF_PID=$!
          
          # Wait for port-forwarding to establish
          sleep 5
          
          # Check health
          if ! curl -s http://localhost:8000/health | grep -q "ok"; then
            echo "Health check failed for $DEPLOYMENT_NAME!"
            kill $PF_PID
            kubectl delete deployment $DEPLOYMENT_NAME
            kubectl delete service $DEPLOYMENT_NAME
            kubectl delete podmonitoring $DEPLOYMENT_NAME-monitoring
            continue
          fi
          
          # Run the benchmark
          echo "Running benchmark with $USER_COUNT users..."
          
          export BATCH_SIZE=$BATCH_SIZE
          export USER_COUNT=$USER_COUNT
          export TEST_PHASE=$TEST_NAME
          export MODEL_NAME=$MODEL_PATH
          export PROMPT_TYPE=$PROMPT_TYPE
          
          # Run locust for 2 minutes
          locust -f locustfile.py --host http://localhost:8000 --headless -u $USER_COUNT --run-time 2m
          
          # Copy results to the results directory
          find . -name "vllm_metrics_${TEST_NAME}_*.csv" -exec cp {} $RESULTS_DIR/ \;
          
          # Clean up
          kill $PF_PID
          kubectl delete deployment $DEPLOYMENT_NAME
          kubectl delete service $DEPLOYMENT_NAME
          kubectl delete podmonitoring $DEPLOYMENT_NAME-monitoring
          
          # Wait between tests
          echo "Waiting 30 seconds before next test..."
          sleep 30
        done
      done
    done
  done
done

echo "All benchmarks completed!"
echo "Results saved to $RESULTS_DIR/"