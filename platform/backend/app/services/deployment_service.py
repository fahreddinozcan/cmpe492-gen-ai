from app.models.deployment import DeploymentListItem, DeploymentStatus, DeploymentResponse
from fastapi import HTTPException, BackgroundTasks, Query
from typing import List, Optional
import logging
import uuid
from datetime import datetime
import asyncio
import subprocess
import json
from argparse import Namespace
import os
from app.services.deployment_init import get_enhanced_deployment_status
from app.state import active_deployments

logger = logging.getLogger("vllm-api")

async def list_deployments_endpoint(namespace: Optional[str] = None) -> List[DeploymentListItem]:
    """List all LLM deployments with basic information"""
    try:
        # Get deployments from active_deployments first
        deployments = []
        for deployment_id, deployment in active_deployments.items():
            if namespace and deployment.get("namespace") != namespace:
                continue

            # Create a deployment list item with only the necessary information for the UI
            deployment_item = DeploymentListItem(
                deployment_id=deployment_id,
                name=deployment.get("release_name"),
                namespace=deployment.get("namespace"),
                status=deployment.get("status", "unknown"),
                model=deployment.get("model_path", "unknown"),
                created_at=deployment.get("created_at", datetime.now().isoformat()),
                ready=deployment.get("llm_ready", False),
                health_status=deployment.get("llm_status", "unknown"),
            )
            deployments.append(deployment_item)

        # Also check Helm for any deployments not in our active_deployments
        helm_cmd = (
            f"helm list -n {namespace} -o json"
            if namespace
            else "helm list --all-namespaces -o json"
        )
        helm_result = await asyncio.to_thread(
            lambda: subprocess.run(helm_cmd, shell=True, text=True, capture_output=True)
        )

        if helm_result.returncode == 0:
            try:
                helm_releases = json.loads(helm_result.stdout)

                for release in helm_releases:
                    release_name = release.get("name")
                    release_namespace = release.get("namespace", namespace or "default")

                    # Skip if already in our list (by name and namespace)
                    if any(
                        d.name == release_name and d.namespace == release_namespace
                        for d in deployments
                    ):
                        continue

                    # Generate a deterministic deployment ID based on namespace and release name
                    # This ensures the same deployment gets the same ID across server restarts
                    unique_key = f"{release_namespace}:{release_name}"
                    deployment_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_key))

                    # Get enhanced status
                    status = await get_enhanced_deployment_status(
                        release_namespace, release_name
                    )

                    # Create a deployment list item
                    deployment_item = DeploymentListItem(
                        deployment_id=deployment_id,
                        name=release_name,
                        namespace=release_namespace,
                        status=status.get("status", "unknown"),
                        model=status.get("model", "unknown"),
                        created_at=release.get("updated", datetime.now().isoformat()),
                        ready=status.get("llm_ready", False),
                        health_status=status.get("llm_status", "unknown"),
                    )
                    deployments.append(deployment_item)

                    # Add to active_deployments for future reference
                    active_deployments[deployment_id] = {
                        "release_name": release_name,
                        "namespace": release_namespace,
                        "status": status.get("status", "unknown"),
                        "model_path": status.get("model", "unknown"),
                        "created_at": release.get(
                            "updated", datetime.now().isoformat()
                        ),
                        "llm_ready": status.get("llm_ready", False),
                        "llm_status": status.get("llm_status", "unknown"),
                    }
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing Helm JSON: {str(e)}")
            except Exception as e:
                logger.error(f"Error listing deployments: {str(e)}")

        return deployments
    except Exception as e:
        logger.error(f"List error: {str(e)}")
        return []

async def get_deployment(deployment_id: str) -> DeploymentStatus:
    """Get detailed information about a specific LLM deployment"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Get enhanced status with readiness information
    enhanced_status = await get_enhanced_deployment_status(namespace, release_name)
    
    # Directly get the external IP from kubectl
    external_ip = None
    try:
        # Use kubectl to get the external IP directly
        cmd = f"kubectl get service {release_name}-router-service -n {namespace} -o jsonpath='{{.status.loadBalancer.ingress[0].ip}}'"
        logger.info(f"Fetching external IP with command: {cmd}")
        result = await asyncio.to_thread(
            lambda: subprocess.run(cmd, shell=True, text=True, capture_output=True)
        )
        
        if result.returncode == 0 and result.stdout.strip():
            external_ip = result.stdout.strip()
            logger.info(f"Successfully found external IP: {external_ip}")
        else:
            # Try hostname if IP is not available
            cmd = f"kubectl get service {release_name}-router-service -n {namespace} -o jsonpath='{{.status.loadBalancer.ingress[0].hostname}}'"
            logger.info(f"Trying hostname with command: {cmd}")
            result = await asyncio.to_thread(
                lambda: subprocess.run(cmd, shell=True, text=True, capture_output=True)
            )
            
            if result.returncode == 0 and result.stdout.strip():
                external_ip = result.stdout.strip()
                logger.info(f"Successfully found external hostname: {external_ip}")
            else:
                # Try a more direct approach - get the external IP from kubectl get services
                cmd = f"kubectl get services -n {namespace} {release_name}-router-service -o custom-columns=EXTERNAL-IP:.status.loadBalancer.ingress[0].ip --no-headers"
                logger.info(f"Trying direct kubectl command: {cmd}")
                result = await asyncio.to_thread(
                    lambda: subprocess.run(cmd, shell=True, text=True, capture_output=True)
                )
                
                if result.returncode == 0 and result.stdout.strip() and result.stdout.strip() != "<none>":
                    external_ip = result.stdout.strip()
                    logger.info(f"Found external IP with direct kubectl command: {external_ip}")
                else:
                    logger.warning(f"Could not find external IP or hostname. Command output: {result.stdout}, Error: {result.stderr}")
    except Exception as e:
        logger.error(f"Error getting external IP directly: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    
    # Construct the response
    response = DeploymentStatus(
        deployment_id=deployment_id,
        name=release_name,
        namespace=namespace,
        status=enhanced_status.get("status", "Unknown"),
        model=deployment.get("model_path", "Unknown"),
        created_at=deployment.get("created_at", ""),
        updated_at=deployment.get("updated_at"),
        gpu_count=deployment.get("gpu_count", 0),
        cpu_count=deployment.get("cpu_count", 0),
        memory=deployment.get("memory", ""),
        image=f"{deployment.get('image_repo', 'vllm/vllm-openai')}:{deployment.get('image_tag', 'latest')}",
        service_url=enhanced_status.get("service_url", ""),
        ready=enhanced_status.get("ready", False),
        health_status=enhanced_status.get("health_status", "unknown"),
        external_ip=external_ip,  # Set the external IP directly
    )
    
    # Add public URL if available from enhanced status or use external IP
    if enhanced_status.get("public_url"):
        response.public_url = enhanced_status.get("public_url")
    elif external_ip:  # Use external IP for public URL if available
        response.public_url = f"http://{external_ip}"
    
    return response

async def create_deployment(request, background_tasks: BackgroundTasks) -> DeploymentResponse:
    try:
        logger.info(f"Creating deployment for model {request.model_path}")

        # Generate a deterministic deployment ID based on namespace and release name
        # This ensures the same deployment gets the same ID across server restarts
        unique_key = f"{request.namespace}:{request.release_name}"
        deployment_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_key))
        logger.info(f"Deployment ID: {deployment_id}")

        args = Namespace(
            model_path=request.model_path,
            release_name=request.release_name,
            namespace=request.namespace,
            hf_token=request.hf_token,
            gpu_type=request.gpu_type,
            cpu_count=request.cpu_count,
            memory=request.memory,
            gpu_count=request.gpu_count,
            environment=request.environment,
            image_repo=request.image_repo,
            image_tag=request.image_tag,
            dtype=request.dtype,
            tensor_parallel_size=request.tensor_parallel_size,
            enable_chunked_prefill=request.enable_chunked_prefill,
            debug=request.debug,
            helm_args=request.helm_args,
            chart_path=os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "vllm-stack")
            ),
            command="deploy",
        )

        active_deployments[deployment_id] = {
            "id": deployment_id,
            "release_name": request.release_name,
            "namespace": request.namespace,
            "model_path": request.model_path,
            "created_at": datetime.now().isoformat(),
            "status": "creating",
            "gpu_count": request.gpu_count,
            "cpu_count": request.cpu_count,
            "memory": request.memory,
            "image": f"{request.image_repo}:{request.image_tag}",
        }

        def _deploy():
            try:
                success = deploy_vllm(args)
                active_deployments[deployment_id]["status"] = (
                    "deployed" if success else "failed"
                )
            except Exception as e:
                logger.error(f"Deployment error in background task: {str(e)}")
                active_deployments[deployment_id]["status"] = "failed"
                active_deployments[deployment_id]["error"] = str(e)

        background_tasks.add_task(_deploy)

        service_url = f"{request.release_name}.{request.namespace}.svc.cluster.local"
        print(
            DeploymentResponse(
                success=True,
                message=f"Deployment started successfully",
                service_url=service_url,
                deployment_id=deployment_id,
            )
        )
        return DeploymentResponse(
            success=True,
            message=f"Deployment started successfully",
            service_url=service_url,
            deployment_id=deployment_id,
        )

    except Exception as e:
        logger.error(f"Error creating deployment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def delete_deployment_by_id(deployment_id: str, background_tasks: BackgroundTasks):
    """Delete a deployment by ID"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    args = Namespace(
        namespace=namespace,
        release_name=release_name,
        debug=False,
        command="delete",
    )

    # Delete in background
    def _delete():
        try:
            success = delete_deployment(args)

            if success:
                # First update status to deleted
                deployment["status"] = "deleted"
                
                # Then remove from active_deployments after a short delay
                # This allows the UI to show the deleted status briefly before removal
                def remove_after_delay():
                    import time
                    time.sleep(5)  # Wait 5 seconds before removing
                    if deployment_id in active_deployments:
                        logger.info(f"Removing deployment {release_name} from active deployments")
                        active_deployments.pop(deployment_id, None)
                
                # Start a new thread to remove after delay
                import threading
                threading.Thread(target=remove_after_delay, daemon=True).start()
            else:
                deployment["status"] = "delete_failed"
                deployment["error"] = "Deletion failed"
        except Exception as e:
            logger.error(f"Deletion error in background task: {str(e)}")
            deployment["status"] = "delete_failed"
            deployment["error"] = str(e)

    background_tasks.add_task(_delete)

    return {
        "success": True,
        "message": f"Deletion of deployment {release_name} started",
        "deployment_id": deployment_id,
    }

async def delete_deployment_endpoint(namespace: str, release_name: str, background_tasks: BackgroundTasks):
    """Delete a deployment by namespace and release name"""

    deployment_id = None
    for id, deployment in active_deployments.items():
        if (
            deployment["namespace"] == namespace
            and deployment["release_name"] == release_name
        ):
            deployment_id = id
            break

    # If not in our registry, still try to delete it
    if deployment_id is None:
        args = Namespace(
            namespace=namespace,
            release_name=release_name,
            purge=True,
            debug=False,
            command="delete",
        )

        # Delete in background
        def _delete():
            try:
                success = delete_deployment(args)
                if not success:
                    logger.error(f"Deletion failed for {namespace}/{release_name}")
            except Exception as e:
                logger.error(f"Deletion error: {str(e)}")

        background_tasks.add_task(_delete)

        return {
            "success": True,
            "message": f"Deletion of deployment {release_name} started",
        }
    else:
        # If found in registry, use the ID-based delete endpoint
        return await delete_deployment_by_id(deployment_id, background_tasks)

async def get_deployment_pods(deployment_id: str):
    """Get pod status for a specific deployment"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    try:
        # Get all pods in the namespace
        cmd = f"kubectl get pods -n {namespace} -o json"
        result = await run_command(cmd)
        pods_json = json.loads(result.stdout)

        # Filter pods that belong to this deployment
        deployment_pods = []
        for pod in pods_json.get("items", []):
            pod_name = pod.get("metadata", {}).get("name", "")
            if release_name in pod_name:
                deployment_pods.append(pod)

        # Get pod status
        pods = []
        for pod in deployment_pods:
            pod_name = pod.get("metadata", {}).get("name", "")
            status = pod.get("status", {})
            container_statuses = status.get("containerStatuses", [])
            restarts = 0
            if container_statuses:
                restarts = container_statuses[0].get("restartCount", 0)

            pod_status = "Unknown"
            if status.get("phase"):
                pod_status = status.get("phase")
            
            # Check for container errors
            if any(cs.get("state", {}).get("waiting", {}).get("reason") == "CrashLoopBackOff" 
                   for cs in container_statuses):
                pod_status = "CrashLoopBackOff"
            elif any(cs.get("state", {}).get("waiting", {}).get("reason") == "Error" 
                     for cs in container_statuses):
                pod_status = "Error"

            pods.append({
                "name": pod_name,
                "status": pod_status,
                "restarts": restarts,
                "ready": status.get("phase") == "Running" and all(cs.get("ready", False) for cs in container_statuses),
                "created": pod.get("metadata", {}).get("creationTimestamp", ""),
            })

        logger.info(f"Found {len(pods)} pods for deployment {release_name}")
        return {"pods": pods}

    except Exception as e:
        logger.error(f"Error getting pod status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting pod status: {str(e)}")

async def get_deployment_logs(deployment_id: str, tail: Optional[int] = 100):
    """Get logs for a specific deployment"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Get all pods in the namespace
    pod_cmd = f"kubectl get pods -n {namespace} -o json"
    result = await asyncio.to_thread(
        lambda: subprocess.run(pod_cmd, shell=True, text=True, capture_output=True)
    )

    if result.returncode != 0:
        raise HTTPException(
            status_code=500, detail=f"Failed to get pods: {result.stderr}"
        )

    # Parse the JSON and filter for pods that belong to this deployment
    pod_names = []
    try:
        pods_data = json.loads(result.stdout)
        for pod in pods_data.get("items", []):
            pod_name = pod["metadata"]["name"]
            # Filter for pods that belong to this deployment
            if release_name in pod_name:
                pod_names.append(pod_name)
                logger.info(f"Found pod for deployment {release_name}: {pod_name}")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse pods JSON: {str(e)}")
    
    if not pod_names:
        raise HTTPException(status_code=404, detail="No pods found")

    # Get logs for each pod
    logs = []
    for pod_name in pod_names:
        log_cmd = f"kubectl logs -n {namespace} {pod_name} --tail={tail}"
        log_result = await asyncio.to_thread(
            lambda: subprocess.run(log_cmd, shell=True, text=True, capture_output=True)
        )

        if log_result.returncode == 0:
            for line in log_result.stdout.strip().split("\n"):
                if line:
                    logs.append(
                        DeploymentLog(
                            pod_name=pod_name,
                            container_name="vllm",
                            log=line,
                            timestamp=datetime.now().isoformat(),
                        )
                    )

    return logs

async def refresh_deployment_status(deployment_id: str):
    """Manually refresh the status of a deployment"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Get enhanced deployment status to check health and readiness
    enhanced_status = await get_enhanced_deployment_status(namespace, release_name)

    # Update the deployment in active_deployments with latest status
    deployment["status"] = enhanced_status.get(
        "status", deployment.get("status", "unknown")
    )
    deployment["llm_status"] = enhanced_status.get("llm_status", "unknown")
    deployment["llm_ready"] = enhanced_status.get("llm_ready", False)

    # Return the updated status
    return {
        "success": True,
        "deployment_id": deployment_id,
        "status": deployment["status"],
        "health_status": deployment["llm_status"],
        "ready": deployment["llm_ready"],
    }

async def get_deployment_by_name(namespace: str, name: str) -> DeploymentStatus:
    """Get a deployment by namespace and name"""
    # First check if it's in active_deployments
    for deployment_id, deployment in active_deployments.items():
        if (
            deployment.get("namespace") == namespace
            and deployment.get("release_name") == name
        ):
            # Return the deployment using the existing get_deployment endpoint
            return await get_deployment(deployment_id)

    # If not found, check if it exists in Kubernetes
    # Get enhanced status
    try:
        status = await get_enhanced_deployment_status(namespace, name)

        # If we get here, the deployment exists, so add it to active_deployments
        deployment_id = str(uuid.uuid4())

        active_deployments[deployment_id] = {
            "release_name": name,
            "namespace": namespace,
            "status": status.get("status", "unknown"),
            "model_path": status.get("model", "unknown"),
            "created_at": datetime.now().isoformat(),
            "llm_ready": status.get("llm_ready", False),
            "llm_status": status.get("llm_status", "unknown"),
            "gpu_count": status.get("gpu_count", 1),
            "cpu_count": status.get("cpu_count", 2),
            "memory": status.get("memory", "8Gi"),
            "image": status.get("image", "vllm/vllm-openai:latest"),
        }

        # Return the deployment using the existing get_deployment endpoint
        return await get_deployment(deployment_id)
    except Exception as e:
        logger.error(
            f"Error getting deployment {name} in namespace {namespace}: {str(e)}"
        )
        raise HTTPException(
            status_code=404,
            detail=f"Deployment {name} not found in namespace {namespace}",
        )

async def port_forward_to_deployment(deployment_id: str, background_tasks: BackgroundTasks):
    """Start port forwarding to a deployment to allow direct communication with the LLM"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Check if the deployment is ready
    enhanced_status = await get_enhanced_deployment_status(namespace, release_name)
    if not enhanced_status.get("llm_ready", False):
        raise HTTPException(status_code=400, detail="Deployment is not ready yet")

    # Start port forwarding in the background
    # This will run kubectl port-forward to forward the service port to localhost
    port = 8000  # You can make this dynamic if needed
    
    # Kill any existing port-forward on this port
    kill_cmd = f"pkill -f 'kubectl port-forward.*{port}'"
    try:
        await asyncio.to_thread(
            lambda: subprocess.run(kill_cmd, shell=True, text=True, capture_output=True)
        )
    except Exception as e:
        logger.warning(f"Error killing existing port-forward: {str(e)}")

    # Start new port-forward
    port_forward_cmd = f"kubectl port-forward -n {namespace} svc/{release_name}-router-service {port}:80"
    
    # Run the port-forward command in the background
    async def _port_forward():
        try:
            process = await asyncio.create_subprocess_shell(
                port_forward_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            # Store the process information for later cleanup
            if not hasattr(app, "port_forward_processes"):
                app.port_forward_processes = {}
            app.port_forward_processes[deployment_id] = process
            
            # Log the output
            logger.info(f"Started port forwarding for {release_name} in namespace {namespace} on port {port}")
            
            # Wait for a short time to ensure port-forward is established
            await asyncio.sleep(2)
            
            # Check if the port is actually open
            try:
                # Try to connect to the port
                reader, writer = await asyncio.open_connection('localhost', port)
                writer.close()
                await writer.wait_closed()
                logger.info(f"Port {port} is open and accepting connections")
            except Exception as e:
                logger.error(f"Port {port} is not accessible: {str(e)}")
                return False
                
            return True
        except Exception as e:
            logger.error(f"Error starting port-forward: {str(e)}")
            return False
    
    # Start the port forwarding
    background_tasks.add_task(_port_forward)
    
    # Return success immediately, the actual port-forward will happen in the background
    return {"success": True, "message": f"Port forwarding started for {release_name} on port {port}", "port": port}

async def proxy_chat_to_llm(deployment_id: str, request: dict):
    """Proxy chat requests to the LLM"""
    if deployment_id not in active_deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")

    deployment = active_deployments[deployment_id]
    namespace = deployment["namespace"]
    release_name = deployment["release_name"]

    # Check if the deployment is ready
    enhanced_status = await get_enhanced_deployment_status(namespace, release_name)
    if not enhanced_status.get("llm_ready", False):
        raise HTTPException(status_code=400, detail="Deployment is not ready yet")

    # Get the service URL
    service_url = f"{release_name}-router-service.{namespace}.svc.cluster.local"
    
    # Format the URL for the chat completions endpoint
    api_url = f"http://{service_url}/v1/chat/completions"
    
    logger.info(f"Proxying chat request to: {api_url}")
    
    try:
        # Use standard requests library instead of httpx
        import requests
        
        # Make the request to the LLM API
        response = await asyncio.to_thread(
            lambda: requests.post(
                api_url,
                json=request,
                timeout=60.0  # Longer timeout for LLM responses
            )
        )
        
        # Get the response content
        if response.status_code != 200:
            logger.error(f"Error from LLM API: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Error from LLM API: {response.text}"
            )
            
        # Return the LLM response directly
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Error connecting to LLM API: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to LLM API: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error proxying chat request: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error proxying chat request: {str(e)}"
        )
