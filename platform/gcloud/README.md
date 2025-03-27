create cluster and add gpu pool

```
python3 gcloud/main.py create \
  --project-id=cmpe492-451815 \
  --zone=us-central1-a \
  --cluster-name=vllm-cluster \
  --machine-type=e2-standard-4 \
  --num-nodes=3 \
  --gpu-machine-type=g2-standard-8 \
  --gpu-type=nvidia-l4 \
  --debug
```

## RESULTS

```
 ~/Desktop/2024-2025/cmpe492/cmpe492-gen-ai/platform │ master ?1  python3 gcloud/main.py create \                                                                                                                                                                                                                        ✔
  --project-id=omit \
  --zone=us-central1-a \
  --cluster-name=vllm-cluster \
  --machine-type=e2-standard-4 \
  --num-nodes=3 \
  --gpu-machine-type=g2-standard-8 \
  --gpu-type=nvidia-l4 \
  --debug
Namespace(command='create', project_id='omit', zone='us-central1-a', network=None, subnetwork=None, cluster_name='vllm-cluster', machine_type='e2-standard-4', num_nodes=3, gpu_pool_name='gpu-pool', gpu_machine_type='g2-standard-8', gpu_type='nvidia-l4', gpu_nodes=1, gpus_per_node=1, min_gpu_nodes=0, max_gpu_nodes=5, debug=True)
2025-03-26 22:33:51,834 - gke-cluster-creator - INFO - Checking gcloud authentication...
2025-03-26 22:33:51,834 - gke-cluster-creator - INFO - Running command: gcloud auth list --format=json
2025-03-26 22:33:52,138 - gke-cluster-creator - INFO - Command output:
[
  {
    "account": "omit",
    "status": "ACTIVE"
  }
]

2025-03-26 22:33:52,138 - gke-cluster-creator - INFO - Checking project omit...
2025-03-26 22:33:52,138 - gke-cluster-creator - INFO - Running command: gcloud projects describe omit --format=json
2025-03-26 22:33:53,631 - gke-cluster-creator - INFO - Command output:
{
  "createTime": "2025-02-23T15:57:18.075138Z",
  "lifecycleState": "ACTIVE",
  "name": "omit",
  "parent": {
    "id": "omit",
    "type": "organization"
  },
  "projectId": "omit",
  "projectNumber": "omit"
}

2025-03-26 22:33:53,631 - gke-cluster-creator - INFO - Running command: gcloud config set project omit
2025-03-26 22:33:55,063 - gke-cluster-creator - INFO - Enabling required GCP APIs...
2025-03-26 22:33:55,063 - gke-cluster-creator - INFO - Enabling container.googleapis.com...
2025-03-26 22:33:55,063 - gke-cluster-creator - INFO - Running command: gcloud services enable container.googleapis.com --project=omit
2025-03-26 22:33:56,892 - gke-cluster-creator - INFO - Enabling compute.googleapis.com...
2025-03-26 22:33:56,892 - gke-cluster-creator - INFO - Running command: gcloud services enable compute.googleapis.com --project=omit
2025-03-26 22:33:58,453 - gke-cluster-creator - INFO - Enabling iam.googleapis.com...
2025-03-26 22:33:58,453 - gke-cluster-creator - INFO - Running command: gcloud services enable iam.googleapis.com --project=omit
2025-03-26 22:34:00,100 - gke-cluster-creator - INFO - Enabling artifactregistry.googleapis.com...
2025-03-26 22:34:00,100 - gke-cluster-creator - INFO - Running command: gcloud services enable artifactregistry.googleapis.com --project=omit
2025-03-26 22:34:01,705 - gke-cluster-creator - INFO - Enabling cloudresourcemanager.googleapis.com...
2025-03-26 22:34:01,705 - gke-cluster-creator - INFO - Running command: gcloud services enable cloudresourcemanager.googleapis.com --project=omit
2025-03-26 22:34:03,230 - gke-cluster-creator - INFO - All required APIs enabled successfully.
2025-03-26 22:34:03,231 - gke-cluster-creator - INFO - Creating GKE cluster vllm-cluster in zone us-central1-a...
2025-03-26 22:34:03,231 - gke-cluster-creator - INFO - Running command: gcloud container clusters create vllm-cluster --project=omit --zone=us-central1-a --machine-type=e2-standard-4 --num-nodes=3 --enable-autoupgrade --release-channel=rapid --scopes=gke-default,storage-rw
2025-03-26 22:40:54,050 - gke-cluster-creator - INFO - Command output:
NAME          LOCATION       MASTER_VERSION      MASTER_IP     MACHINE_TYPE   NODE_VERSION        NUM_NODES  STATUS
vllm-cluster  us-central1-a  1.32.2-gke.1182001  34.121.36.84  e2-standard-4  1.32.2-gke.1182001  3          RUNNING

2025-03-26 22:40:54,051 - gke-cluster-creator - INFO - Base GKE cluster created successfully.
2025-03-26 22:40:54,051 - gke-cluster-creator - INFO - Creating GPU node pool with nvidia-l4 GPUs...
2025-03-26 22:40:54,051 - gke-cluster-creator - INFO - Running command: gcloud container node-pools create gpu-pool --project=omit --cluster=vllm-cluster --zone=us-central1-a --machine-type=g2-standard-8 --num-nodes=1 --accelerator=type=nvidia-l4,count=1,gpu-driver-version=default --enable-autoupgrade --min-nodes=0 --max-nodes=5
2025-03-26 22:41:56,301 - gke-cluster-creator - INFO - Command output:
NAME      MACHINE_TYPE   DISK_SIZE_GB  NODE_VERSION
gpu-pool  g2-standard-8  100           1.32.2-gke.1182001

2025-03-26 22:41:56,302 - gke-cluster-creator - INFO - GPU node pool created successfully.
2025-03-26 22:41:56,302 - gke-cluster-creator - INFO - Configuring kubectl to use the new cluster...
2025-03-26 22:41:56,302 - gke-cluster-creator - INFO - Running command: gcloud container clusters get-credentials vllm-cluster --zone=us-central1-a --project=omit
2025-03-26 22:41:58,004 - gke-cluster-creator - INFO - Waiting for nodes to be ready...
2025-03-26 22:42:58,009 - gke-cluster-creator - INFO - Checking GPU node status...
2025-03-26 22:42:58,009 - gke-cluster-creator - INFO - Running command: kubectl get nodes -l cloud.google.com/gke-accelerator
2025-03-26 22:43:00,022 - gke-cluster-creator - INFO - Command output:
NAME                                      STATUS   ROLES    AGE   VERSION
gke-vllm-cluster-gpu-pool-49c4fd5c-drps   Ready    <none>   68s   v1.32.2-gke.1182001

2025-03-26 22:43:00,023 - gke-cluster-creator - INFO - GKE cluster with GPU support created successfully: vllm-cluster
2025-03-26 22:43:00,023 - gke-cluster-creator - INFO - GPU node pool: gpu-pool with nvidia-l4 GPUs
2025-03-26 22:43:00,023 - gke-cluster-creator - INFO - GKE cluster setup completed successfully.
```
