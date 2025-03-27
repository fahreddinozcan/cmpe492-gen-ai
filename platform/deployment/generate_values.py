import os
import tempfile
import yaml
import logging

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("vllm-deploy")

DEFAULT_PATH = "../vllm-stack/values.yaml"


# def generate_values(args):
#     """
#     Generate values.yaml file for Helm based on provided arguments

#     Args:
#         args: Command line arguments with deployment options

#     Returns:
#         path: Path to the generated values file
#     """
#     logger.info("Generating values.yaml file")

#     values_file = (
#         args.get("values_file") if isinstance(args, dict) else args.values_file
#     )

#     if values_file and os.path.exists(values_file):
#         logger.info(f"Using custom values file as base: {values_file}")
#         with open(values_file, "r") as f:
#             values = yaml.safe_load(f)
#     else:
#         values = {}

#     values["replicaCount"] = 1

#     if "image" not in values:
#         values["image"] = {}

#     values["image"]["repository"] = args.image_repo
#     values["image"]["tag"] = args.image_tag

#     values["containerPort"] = "8000"
#     values["servicePort"] = 80

#     if "resources" not in values:
#         values["resources"] = {"requests": {}, "limits": {}}

#     for resource_type in ["requests", "limits"]:
#         values["resources"][resource_type]["cpu"] = args.cpu_count
#         values["resources"][resource_type]["memory"] = args.memory
#         values["resources"][resource_type]["nvidia.com/gpu"] = args.gpu_count

#     values["nodeSelector"] = {
#         "cloud.google.com/gke-accelerator": args.gpu_type,
#         "cloud.google.com/gke-gpu-driver-version": "latest",
#     }

#     values["gpuModels"] = [args.gpu_type]

#     values["readinessProbe"] = {
#         "initialDelaySeconds": 180,
#         "periodSeconds": 5,
#         "failureThreshold": 3,
#         "httpGet": {"path": "/health", "port": 8000},
#     }

#     values["livenessProbe"] = {
#         "initialDelaySeconds": 180,
#         "periodSeconds": 10,
#         "failureThreshold": 3,
#         "httpGet": {"path": "/health", "port": 8000},
#     }

#     values["labels"] = {"environment": args.environment, "release": args.release_name}

#     if args.use_s3:
#         if not all(
#             [args.s3_endpoint, args.s3_bucket, args.s3_access_key, args.s3_secret_key]
#         ):
#             raise ValueError(
#                 "S3 endpoint, bucket, access key, and secret key are required when using S3"
#             )

#         values["extraInit"] = {
#             "s3modelpath": args.model_path,
#             "pvcStorage": args.storage,
#             "awsEc2MetadataDisabled": True,
#         }

#         # Configure S3 secrets
#         values["secrets"] = {
#             "s3endpoint": args.s3_endpoint,
#             "s3bucketname": args.s3_bucket,
#             "s3accesskeyid": args.s3_access_key,
#             "s3accesskey": args.s3_secret_key,
#         }

#     else:
#         model_name = (
#             args.model_name if args.model_name else os.path.basename(args.model_path)
#         )

#         cmd = [
#             "/bin/sh",
#             "-c",
#             f"vllm serve {args.model_path} "
#             f"--dtype {args.dtype} "
#             f"--tensor-parallel-size {args.tensor_parallel_size} "
#             f"--max-num-seqs {args.max_num_seqs} ",
#         ]

#         if args.enable_chunked_prefill:
#             cmd[-1] += "--enable-chunked-prefill "

#         if "/" in args.model_path:
#             cmd[-1] += "--trust-remote-code "

#         cmd[-1] += f"--served-model-name {model_name} --host 0.0.0.0 --port 8000"

#         values["image"]["command"] = " ".join(cmd)
#         # print("Command: ", values["image"]["command"])

#         if args.hf_token:
#             values["secrets"] = {"hfToken": args.hf_token}

#     fd, path = tempfile.mkstemp(suffix=".yaml")
#     with os.fdopen(fd, "w") as tmp:
#         yaml.dump(values, tmp)
#     logger.info(f"Generated values.yaml file: {path}")

#     # print(values)
#     return path


def generate_values(args):
    """Generate values.yaml file for Helm based on provided arguments"""
    logger.info("Generating values.yaml file")

    values = {
        "servingEngineSpec": {
            "labels": {"environment": args.environment, "release": args.release_name},
            "containerPort": "8000",
            "servicePort": 80,
            "modelSpec": [
                {
                    "name": os.path.basename(args.model_path),
                    "repository": args.image_repo,
                    "tag": args.image_tag,
                    "modelURL": args.model_path,
                    "replicaCount": 1,
                    "requestCPU": args.cpu_count,
                    "requestMemory": args.memory,
                    "requestGPU": args.gpu_count,
                    "vllmConfig": {
                        "dtype": args.dtype,
                        "tensorParallelSize": args.tensor_parallel_size,
                        "enableChunkedPrefill": args.enable_chunked_prefill,
                    },
                    "nodeSelectorTerms": [
                        {
                            "matchExpressions": [
                                {
                                    "key": "cloud.google.com/gke-accelerator",
                                    "operator": "In",
                                    "values": [args.gpu_type],
                                }
                            ]
                        }
                    ],
                }
            ],
        },
        "routerSpec": {
            "repository": "lmcache/lmstack-router",
            "tag": "latest",
            "enableRouter": True,
            "replicaCount": 1,
            "containerPort": 8000,
            "servicePort": 80,
            "serviceDiscovery": "k8s",
            "routingLogic": "roundrobin",
            "engineScrapeInterval": 15,
            "requestStatsWindow": 60,
            "resources": {
                "requests": {"cpu": "2", "memory": "8G"},
                "limits": {"cpu": "4", "memory": "16G"},
            },
            "labels": {"environment": args.environment, "release": args.release_name},
        },
    }

    if args.hf_token:
        values["servingEngineSpec"]["modelSpec"][0]["hf_token"] = args.hf_token

    fd, path = tempfile.mkstemp(suffix=".yaml")
    with os.fdopen(fd, "w") as tmp:
        yaml.dump(values, tmp)
    logger.info(f"Generated values.yaml file: {path}")

    return path


if __name__ == "__main__":
    # Provide the correct path to your values.yaml file
    generate_values(args={"values_file": DEFAULT_PATH})
