import os
import tempfile
import yaml


def generate_values(args):
    """Generate values.yaml file for Helm based on provided arguments"""
    values = {
        "replicaCount": 1,
        "image": {
            "repository": "vllm/vllm-openai",
            "tag": args.image_tag,
        },
        "resources": {
            "limits": {
                "cpu": args.cpu_count,
                "memory": args.memory,
                "nvidia.com/gpu": args.gpu_count,
            },
            "requests": {
                "cpu": args.cpu_count,
                "memory": args.memory,
                "nvidia.com/gpu": args.gpu_count,
            },
        },
        "extraInit": {"pvcStorage": args.storage, "awsEc2MetadataDisabled": True},
        "containerPort": 8000,
        "servicePort": 80,
        "livenessProbe": {
            "initialDelaySeconds": 180,
            "periodSeconds": 10,
            "failureThreshold": 3,
            "httpGet": {"path": "/health", "port": 8000},
        },
        "readinessProbe": {
            "initialDelaySeconds": 180,
            "periodSeconds": 5,
            "failureThreshold": 3,
            "httpGet": {"path": "/health", "port": 8000},
        },
        "labels": {"environment": args.environment, "release": args.release_name},
        "nodeSelector": {
            "cloud.google.com/gke-accelerator": args.gpu_type,
            "cloud.google.com/gke-gpu-driver-version": "latest",
        },
    }

    model_name = (
        args.model_name if args.model_name else os.path.basename(args.model_path)
    )

    if args.hf_token:
        values["secrets"] = {"hfToken": args.hf_token}

    values["image"]["command"] = [
        "/bin/sh",
        "-c",
        f"vllm serve {args.model_path} --trust-remote-code --enable-chunked-prefill --max-num-seqs 64 --served-model-name {model_name} --host 0.0.0.0 --port 8000",
    ]

    fd, path = tempfile.mkstemp(suffix=".yaml")
    with os.fdopen(fd, "w") as f:
        yaml.dump(values, f, default_flow_style=False)

    return path
