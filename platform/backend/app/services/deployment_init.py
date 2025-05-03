from typing import Dict, Any
import logging
import asyncio
import subprocess
import json
from app.state import active_deployments

logger = logging.getLogger("vllm-api")

async def initialize_deployments():
    """Initialize the active_deployments dictionary with existing deployments"""
    logger.info("[init] Starting initialize_deployments...")
    try:
        # Get all namespaces
        ns_cmd = "kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'"
        logger.info(f"[init] Running: {ns_cmd}")
        ns_result = await asyncio.to_thread(
            lambda: subprocess.run(ns_cmd, shell=True, text=True, capture_output=True, timeout=10)
        )
        logger.info(f"[init] kubectl get namespaces returned: {ns_result.returncode}")

        if ns_result.returncode == 0 and ns_result.stdout:
            namespaces = ns_result.stdout.split()
            logger.info(f"[init] Found namespaces: {namespaces}")
            # For each namespace, get the deployments
            for namespace in namespaces:
                helm_cmd = f"helm list -n {namespace} -o json"
                logger.info(f"[init] Running: {helm_cmd}")
                try:
                    helm_result = await asyncio.to_thread(
                        lambda: subprocess.run(
                            helm_cmd, shell=True, text=True, capture_output=True, timeout=10
                        )
                    )
                except subprocess.TimeoutExpired:
                    logger.warning(f"[init] helm list timed out for namespace {namespace}")
                    continue
                logger.info(f"[init] helm list returned: {helm_result.returncode} for {namespace}")

                if helm_result.returncode == 0 and helm_result.stdout:
                    try:
                        helm_releases = json.loads(helm_result.stdout)
                        logger.info(f"[init] Found {len(helm_releases)} releases in {namespace}")
                        for release in helm_releases:
                            release_name = release.get("name")
                            release_namespace = release.get("namespace", namespace)

                            # Check if it's a vLLM deployment
                            if release_name and (
                                "vllm" in release.get("chart", "").lower()
                                or "llm" in release_name.lower()
                            ):
                                # Generate a deterministic deployment ID based on namespace and release name
                                # This ensures the same deployment gets the same ID across server restarts
                                unique_key = f"{release_namespace}:{release_name}"
                                deployment_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_key))

                                # Get enhanced status
                                status = await get_enhanced_deployment_status(
                                    release_namespace, release_name
                                )

                                # Add to active_deployments
                                active_deployments[deployment_id] = {
                                    "release_name": release_name,
                                    "namespace": release_namespace,
                                    "status": status.get("status", "unknown"),
                                    "model": status.get("model", "unknown"),
                                    "created_at": release.get(
                                        "updated", datetime.now().isoformat()
                                    ),
                                    "llm_ready": status.get("llm_ready", False),
                                    "llm_status": status.get("llm_status", "unknown"),
                                    "gpu_count": status.get("gpu_count", 1),
                                    "cpu_count": status.get("cpu_count", 2),
                                    "memory": status.get("memory", "8Gi"),
                                    "image": status.get(
                                        "image", "vllm/vllm-openai:latest"
                                    ),
                                }

                                logger.info(
                                    f"Initialized deployment {release_name} in namespace {release_namespace} with ID {deployment_id}"
                                )
                    except Exception as e:
                        logger.error(f"[init] Error parsing Helm JSON in {namespace}: {str(e)}")
        else:
            logger.info("[init] No namespaces found or kubectl not configured. Skipping deployment discovery.")
    except subprocess.TimeoutExpired:
        logger.error("[init] kubectl get namespaces timed out. No clusters accessible?")
    except Exception as e:
        logger.error(f"[init] Error in initialize_deployments: {str(e)}")
    logger.info("[init] Finished initialize_deployments.")


async def get_deployment_status(namespace: str, release_name: str) -> Dict[str, Any]:
    """Get detailed status of a specific vLLM deployment including all pod statuses"""
    try:
        # Get model pod (the one that actually runs the model)
        model_pod_cmd = f"kubectl get pods -n {namespace} -l model --field-selector metadata.name=~{release_name}-.* -o json"
        model_pod_result = await asyncio.to_thread(
            lambda: subprocess.run(
                model_pod_cmd, shell=True, text=True, capture_output=True
            )
        )

        # If no model pod found, try with a broader selector
        if model_pod_result.returncode != 0 or not json.loads(
            model_pod_result.stdout
        ).get("items"):
            # Try with a broader approach - get all pods with the release name
            pod_cmd = f"kubectl get pods -n {namespace} -o json"
            pod_result = await asyncio.to_thread(
                lambda: subprocess.run(
                    pod_cmd, shell=True, text=True, capture_output=True
                )
            )

            if pod_result.returncode != 0:
                return {
                    "name": release_name,
                    "namespace": namespace,
                    "status": "Error",
                    "model": "unknown",
                    "error": f"Failed to get pods: {pod_result.stderr}",
                }

            pods_data = json.loads(pod_result.stdout)

            # Filter for pods that match our deployment
            vllm_pods = []
            router_pods = []
            model_pods = []

            for pod in pods_data.get("items", []):
                pod_name = pod["metadata"]["name"]
                # Check for deployment pods by name patterns
                if pod_name.startswith(f"{release_name}-"):
                    vllm_pods.append(pod)

                    # Identify router pods
                    if "router" in pod_name.lower():
                        router_pods.append(pod)
                    # Identify model pods (usually contain "vllm" or model name)
                    elif any(
                        marker in pod_name.lower() for marker in ["vllm", "deployment"]
                    ):
                        model_pods.append(pod)
        else:
            # Parse the model pod data
            model_pods = json.loads(model_pod_result.stdout).get("items", [])

            # Get router pods separately
            router_pod_cmd = f"kubectl get pods -n {namespace} -l app=router --field-selector metadata.name=~{release_name}-.* -o json"
            router_pod_result = await asyncio.to_thread(
                lambda: subprocess.run(
                    router_pod_cmd, shell=True, text=True, capture_output=True
                )
            )

            router_pods = []
            if router_pod_result.returncode == 0:
                router_pods = json.loads(router_pod_result.stdout).get("items", [])

            # Combine all pods for overall status
            vllm_pods = model_pods + router_pods

        # Get deployment details from Helm
        helm_cmd = f"helm get values -n {namespace} {release_name} -o json"
        helm_result = await asyncio.to_thread(
            lambda: subprocess.run(helm_cmd, shell=True, text=True, capture_output=True)
        )

        model = "unknown"
        gpu_count = 0
        cpu_count = 0
        memory = ""
        image = "unknown"
        created_at = None

        if helm_result.returncode == 0 and helm_result.stdout:
            try:
                values = json.loads(helm_result.stdout)
                if (
                    "servingEngineSpec" in values
                    and "modelSpec" in values["servingEngineSpec"]
                ):
                    model_spec = values["servingEngineSpec"]["modelSpec"][0]
                    model = model_spec.get("modelURL", "unknown")
                    gpu_count = model_spec.get("requestGPU", 0)
                    cpu_count = model_spec.get("requestCPU", 0)
                    memory = model_spec.get("requestMemory", "")
            except json.JSONDecodeError:
                pass

        # Determine detailed status
        pod_status = {}
        model_pod_status = "Unknown"
        router_pod_status = "Unknown"

        # Get the earliest creation timestamp
        for pod in vllm_pods:
            pod_name = pod["metadata"]["name"]
            phase = pod["status"]["phase"]
            conditions = pod["status"].get("conditions", [])

            # More detailed status
            detailed_status = phase
            for condition in conditions:
                if (
                    condition.get("type") == "Ready"
                    and not condition.get("status") == "True"
                ):
                    detailed_status = f"{phase} (Not Ready)"
                    break

            pod_status[pod_name] = detailed_status

            # Track creation time
            pod_created = pod["metadata"]["creationTimestamp"]
            if not created_at or pod_created < created_at:
                created_at = pod_created

            # Get image from model pod
            if "vllm" in pod_name.lower() or "deployment" in pod_name.lower():
                if "containers" in pod["spec"] and pod["spec"]["containers"]:
                    image = pod["spec"]["containers"][0]["image"]

        # Determine status of model pods vs router pods
        if model_pods:
            model_statuses = [pod["status"]["phase"] for pod in model_pods]
            model_pod_status = (
                "Running"
                if all(status == "Running" for status in model_statuses)
                else "Pending"
            )

        if router_pods:
            router_statuses = [pod["status"]["phase"] for pod in router_pods]
            router_pod_status = (
                "Running"
                if all(status == "Running" for status in router_statuses)
                else "Pending"
            )

        # Combined status
        if model_pod_status == "Running" and router_pod_status == "Running":
            overall_status = "Running"
        elif model_pod_status == "Running":
            overall_status = "Model Ready (Router Pending)"
        elif router_pod_status == "Running":
            overall_status = "Router Ready (Model Pending)"
        elif not vllm_pods:
            overall_status = "No Pods Found"
        else:
            overall_status = "Pending"

        service_url = f"{release_name}-router-service.{namespace}.svc.cluster.local"
        public_url = None
        external_ip = None

        # Get service info
        service_cmd = f"kubectl get service {release_name}-router-service -n {namespace} -o json"
        service_result = await asyncio.to_thread(
            lambda: subprocess.run(
                service_cmd, shell=True, text=True, capture_output=True
            )
        )

        if service_result.returncode == 0:
            try:
                service_data = json.loads(service_result.stdout)
                service_type = service_data.get("spec", {}).get("type", "")

                # Check if LoadBalancer has an assigned external IP
                if service_type == "LoadBalancer":
                    ingress = service_data.get("status", {}).get("loadBalancer", {}).get(
                        "ingress", []
                    )
                    if ingress and "hostname" in ingress[0]:
                        external_ip = ingress[0]['hostname']
                        public_url = f"http://{external_ip}"
                        logger.info(f"Found external hostname for {release_name}: {external_ip}")
                    elif ingress and "ip" in ingress[0]:
                        external_ip = ingress[0]['ip']
                        public_url = f"http://{external_ip}"
                        logger.info(f"Found external IP for {release_name}: {external_ip}")
            except json.JSONDecodeError:
                logger.error("Failed to parse service JSON")

        return {
            "name": release_name,
            "namespace": namespace,
            "status": overall_status,
            "model_pod_status": model_pod_status,
            "router_pod_status": router_pod_status,
            "model": model,
            "created_at": created_at,
            "gpu_count": gpu_count,
            "cpu_count": cpu_count,
            "memory": memory,
            "image": image,
            "service_url": service_url,
            "public_url": public_url,
            "pod_status": pod_status,
        }

    except Exception as e:
        logger.error(f"Error getting deployment status: {str(e)}")
        logger.exception(e)
        return {
            "name": release_name,
            "namespace": namespace,
            "status": "Error",
            "model": "unknown",
            "error": str(e),
        }


async def get_enhanced_deployment_status(
    namespace: str, release_name: str
) -> Dict[str, Any]:
    """Get detailed status of a vLLM deployment including readiness for serving"""

    # First get basic deployment status
    deployment_status = await get_deployment_status(namespace, release_name)

    # Default LLM readiness
    deployment_status["llm_ready"] = False
    deployment_status["llm_status"] = "Initializing"
    deployment_status["ui_status"] = "pending"  # Options: active, pending, failed

    # Check if all pods are running and ready
    # First, get all pods for this deployment
    pods_cmd = f"kubectl get pods -n {namespace} -o json"
    pods_result = await asyncio.to_thread(
        lambda: subprocess.run(pods_cmd, shell=True, text=True, capture_output=True)
    )
    
    # Get the external IP from the LoadBalancer service
    external_ip = None
    try:
        # Get service details to check for LoadBalancer external IP
        cmd = f"kubectl get service {release_name}-router-service -n {namespace} -o json"
        logger.info(f"Running command to get service details: {cmd}")
        result = await asyncio.to_thread(
            lambda: subprocess.run(
                cmd, shell=True, text=True, capture_output=True
            )
        )
        
        if result.returncode != 0:
            logger.error(f"Command failed with return code {result.returncode}: {result.stderr}")
        else:
            logger.info(f"Successfully retrieved service details for {release_name}")
            
        service_json = json.loads(result.stdout)
        
        # Log the service type
        service_type = service_json.get("spec", {}).get("type")
        logger.info(f"Service type for {release_name}: {service_type}")
        
        # Check if it's a LoadBalancer and has an external IP
        if service_type == "LoadBalancer":
            # Log the loadBalancer status
            load_balancer = service_json.get("status", {}).get("loadBalancer", {})
            logger.info(f"LoadBalancer status: {load_balancer}")
            
            ingress = load_balancer.get("ingress", [])
            logger.info(f"Ingress entries: {ingress}")
            
            if ingress:
                logger.info(f"First ingress entry: {ingress[0]}")
                
                if "hostname" in ingress[0]:
                    external_ip = ingress[0]['hostname']
                    logger.info(f"Found external hostname for {release_name}: {external_ip}")
                elif "ip" in ingress[0]:
                    external_ip = ingress[0]['ip']
                    logger.info(f"Found external IP for {release_name}: {external_ip}")
                else:
                    logger.warning(f"Ingress entry exists but contains neither hostname nor ip: {ingress[0]}")
            else:
                logger.warning(f"No ingress entries found for LoadBalancer service {release_name}-router-service")
        else:
            logger.warning(f"Service {release_name}-router-service is not of type LoadBalancer, but {service_type}")
        
        # Add external_ip to deployment_status
        logger.info(f"Setting external_ip to: {external_ip}")
        deployment_status["external_ip"] = external_ip
    except Exception as e:
        logger.error(f"Error getting external IP: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

    all_pods_ready = False
    if pods_result.returncode == 0 and pods_result.stdout:
        try:
            pods_data = json.loads(pods_result.stdout)
            deployment_pods = []

            # Find pods that belong to this deployment
            for pod in pods_data.get("items", []):
                pod_name = pod["metadata"]["name"]
                if release_name in pod_name:
                    deployment_pods.append(pod)

            # Check if all pods are running and ready
            if deployment_pods:
                all_running = True
                all_ready = True

                for pod in deployment_pods:
                    # Check if running
                    if pod["status"]["phase"] != "Running":
                        all_running = False
                        break

                    # Check if ready
                    if "containerStatuses" in pod["status"]:
                        for container in pod["status"]["containerStatuses"]:
                            if not container.get("ready", False):
                                all_ready = False
                                break
                    else:
                        all_ready = False

                if all_running and all_ready:
                    all_pods_ready = True
                    logger.info(f"All pods for {release_name} are running and ready")
        except Exception as e:
            logger.error(f"Error checking pod readiness: {str(e)}")

    # If all pods are ready, we can assume the LLM is ready
    if all_pods_ready:
        deployment_status["llm_ready"] = True
        deployment_status["llm_status"] = "Ready"
        deployment_status["ui_status"] = "active"
        return deployment_status

    # If deployment is not running, we already know LLM is not ready
    if deployment_status["status"] != "Running":
        if (
            "Error" in deployment_status["status"]
            or "failed" in deployment_status.get("status", "").lower()
        ):
            deployment_status["llm_status"] = "Failed"
            deployment_status["ui_status"] = "failed"
        else:
            deployment_status["llm_status"] = "Starting"
            deployment_status["ui_status"] = "pending"
        return deployment_status

    # Check model readiness by querying the model endpoint
    service_url = deployment_status["service_url"]

    try:
        # Try to query the model health endpoint
        # First find all pods for this release
        find_pods_cmd = f"kubectl get pods -n {namespace} -l app.kubernetes.io/instance={release_name} -o json"
        if not find_pods_cmd:
            # Try alternative label selectors
            find_pods_cmd = f"kubectl get pods -n {namespace} -o json"

        pods_result = await asyncio.to_thread(
            lambda: subprocess.run(
                find_pods_cmd, shell=True, text=True, capture_output=True
            )
        )

        router_pod = None
        if pods_result.returncode == 0 and pods_result.stdout:
            try:
                pods_data = json.loads(pods_result.stdout)
                for pod in pods_data.get("items", []):
                    pod_name = pod["metadata"]["name"]
                    # Look for router pods by common naming patterns
                    if (
                        "router" in pod_name.lower()
                        and pod["status"]["phase"] == "Running"
                    ):
                        router_pod = pod_name
                        break
            except json.JSONDecodeError:
                logger.error("Failed to parse pods JSON")

        if router_pod:
            # Use the found router pod
            cmd = f"kubectl exec -n {namespace} {router_pod} -- curl -s http://localhost:8000/v1/models"
            logger.info(f"Using router pod {router_pod} for health check")
        else:
            # Fallback to deployment name if no pod found
            cmd = f"kubectl exec -n {namespace} deploy/{release_name}-deployment-router -- curl -s http://localhost:8000/v1/models"
            logger.info(f"Falling back to deployment name for health check")
        health_result = await asyncio.to_thread(
            lambda: subprocess.run(
                cmd, shell=True, text=True, capture_output=True, timeout=5
            )
        )

        if health_result.returncode == 0 and health_result.stdout:
            try:
                # Parse the models response
                models_data = json.loads(health_result.stdout)

                # Check if we have models in the response
                if "data" in models_data and len(models_data["data"]) > 0:
                    deployment_status["llm_ready"] = True
                    deployment_status["llm_status"] = "Ready"
                    deployment_status["ui_status"] = "active"
                    deployment_status["available_models"] = models_data["data"]
                else:
                    # Service is up but no models loaded yet
                    deployment_status["llm_status"] = "Loading Model"
                    deployment_status["ui_status"] = "pending"
            except json.JSONDecodeError:
                # Could connect but didn't get valid JSON
                deployment_status["llm_status"] = "API Error"
                deployment_status["ui_status"] = "pending"
        else:
            # Couldn't connect to the service
            # Check logs to see if model is still loading
            # First try to find all pods for this release
            find_pods_cmd = f"kubectl get pods -n {namespace} -o json"
            find_pod_result = await asyncio.to_thread(
                lambda: subprocess.run(
                    find_pods_cmd, shell=True, text=True, capture_output=True
                )
            )

            model_pod = None
            if find_pod_result.returncode == 0 and find_pod_result.stdout:
                try:
                    pods_data = json.loads(find_pod_result.stdout)
                    for pod in pods_data.get("items", []):
                        pod_name = pod["metadata"]["name"]
                        # Look for model pods by common naming patterns
                        if (
                            release_name in pod_name
                            and (
                                "vllm" in pod_name.lower()
                                or "engine" in pod_name.lower()
                            )
                            and not "router" in pod_name.lower()
                        ):
                            model_pod = pod_name
                            break
                except json.JSONDecodeError:
                    logger.error("Failed to parse pods JSON")

            if model_pod:
                # Use the found model pod
                logs_cmd = f"kubectl logs -n {namespace} {model_pod} --tail=50"
                logger.info(f"Checking logs from model pod {model_pod}")
            else:
                # Fallback to a more generic approach - try to find any pod with the release name
                logs_cmd = f"kubectl logs -n {namespace} -l app.kubernetes.io/instance={release_name} --tail=50"
                logger.info(f"Falling back to generic log check for {release_name}")
            logs_result = await asyncio.to_thread(
                lambda: subprocess.run(
                    logs_cmd, shell=True, text=True, capture_output=True
                )
            )

            if logs_result.returncode == 0:
                log_content = logs_result.stdout.lower()
                if "model loaded successfully" in log_content:
                    deployment_status["llm_status"] = "Model Loaded, Service Starting"
                    deployment_status["ui_status"] = "pending"
                elif "loading model" in log_content or "downloading" in log_content:
                    deployment_status["llm_status"] = "Downloading/Loading Model"
                    deployment_status["ui_status"] = "pending"
                else:
                    deployment_status["llm_status"] = "Starting"
                    deployment_status["ui_status"] = "pending"
    except Exception as e:
        logger.error(f"Error checking model readiness: {str(e)}")
        deployment_status["llm_status"] = f"Status Check Error: {str(e)}"
        deployment_status["ui_status"] = "pending"

    return deployment_status
