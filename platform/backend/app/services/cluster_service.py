from app.models.cluster import ClusterListItem, ClusterResponse, ClusterCreateRequest
from fastapi import HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict
import subprocess
import asyncio
import json
import logging
import uuid
import re
from app.state import active_deployments, active_clusters

async def discover_deployments_for_cluster(project_id: str, zone: str, cluster_name: str):
    get_creds_cmd = f"gcloud container clusters get-credentials {cluster_name} --zone {zone} --project {project_id}"
    proc = await asyncio.to_thread(lambda: subprocess.run(get_creds_cmd, shell=True, text=True, capture_output=True))
    if proc.returncode != 0:
        logging.error(f"Failed to update kubeconfig for cluster {cluster_name}: {proc.stderr}")
        return []
    logging.info(f"Updated kubeconfig for cluster {cluster_name}")
    ns_cmd = "kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'"
    ns_result = await asyncio.to_thread(lambda: subprocess.run(ns_cmd, shell=True, text=True, capture_output=True))
    deployments_found = []
    if ns_result.returncode == 0 and ns_result.stdout:
        namespaces = ns_result.stdout.split()
        for namespace in namespaces:
            helm_cmd = f"helm list -n {namespace} -o json"
            helm_result = await asyncio.to_thread(lambda: subprocess.run(helm_cmd, shell=True, text=True, capture_output=True))
            if helm_result.returncode == 0 and helm_result.stdout:
                try:
                    helm_releases = json.loads(helm_result.stdout)
                    logging.info(f"Found {len(helm_releases)} releases in {namespace}")
                    for release in helm_releases:
                        release_name = release.get("name")
                        release_namespace = release.get("namespace", namespace)
                        unique_key = f"{release_namespace}:{release_name}"
                        deployment_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_key))
                        active_deployments[deployment_id] = {
                            "namespace": release_namespace,
                            "release_name": release_name,
                            "project_id": project_id,
                            "zone": zone,
                            "cluster_name": cluster_name,
                            "status": release.get("status"),
                            "chart": release.get("chart"),
                            "updated": release.get("updated"),
                        }
                        deployments_found.append(deployment_id)
                except Exception as e:
                    logging.error(f"Error parsing Helm releases in {namespace}: {str(e)}")
    return deployments_found

async def list_clusters() -> List[ClusterListItem]:
    logger = logging.getLogger("uvicorn.error")
    clusters = []
    try:
        proc = await asyncio.to_thread(lambda: subprocess.run([
            "gcloud", "container", "clusters", "list", "--format=json"
        ], capture_output=True, text=True, check=True))
        gcp_clusters = json.loads(proc.stdout)
        logger.info(f"[list_clusters] gcp_clusters type: {type(gcp_clusters)}, len: {len(gcp_clusters) if isinstance(gcp_clusters, list) else 'N/A'}")
        for c in gcp_clusters:
            logger.info(f"[list_clusters] parsing cluster: {c}")
            project_id = c.get('projectId')
            if not project_id:
                self_link = c.get('selfLink', '')
                match = re.search(r'/projects/([^/]+)/', self_link)
                if match:
                    project_id = match.group(1)
                else:
                    project_id = 'unknown'
            cluster_id = f"{project_id}:{c.get('zone')}:{c.get('name')}"
            clusters.append(ClusterListItem(
                cluster_id=cluster_id,
                name=c.get('name'),
                status=c.get('status', 'unknown'),
                zone=c.get('zone'),
                project_id=project_id,
                created_at=c.get('createTime', None)
            ))
        logger.info(f"[list_clusters] clusters after GCP: {clusters}")
    except Exception as e:
        logger.error(f"[list_clusters] gcloud error: {e}")
    gcp_ids = {c.cluster_id for c in clusters}
    logger.info(f"[list_clusters] active_clusters: {active_clusters}")
    for cid, c in active_clusters.items():
        if cid not in gcp_ids:
            clusters.append(c)
    logger.info(f"[list_clusters] Final clusters to return: {clusters}")
    return clusters

async def get_cluster(cluster_id: str) -> ClusterListItem:
    logger = logging.getLogger("uvicorn.error")
    logger.info(f"[get_cluster] Received cluster_id: {cluster_id}")
    cluster = active_clusters.get(cluster_id)
    if cluster:
        logger.info(f"[get_cluster] Found in active_clusters: {cluster}")
        return cluster
    parts = cluster_id.split(":")
    if len(parts) != 3:
        logger.error(f"[get_cluster] Invalid cluster_id format: {cluster_id}")
        raise HTTPException(status_code=404, detail="Cluster not found")
    project_id, zone, cluster_name = parts
    logger.info(f"[get_cluster] Parsed project_id={project_id}, zone={zone}, cluster_name={cluster_name}")
    cmd = [
        "gcloud", "container", "clusters", "describe", cluster_name,
        f"--zone={zone}", f"--project={project_id}", "--format=json"
    ]
    try:
        proc = await asyncio.to_thread(lambda: subprocess.run(cmd, capture_output=True, text=True, check=True))
        data = json.loads(proc.stdout)
        logger.info(f"[get_cluster] gcloud describe result: {data}")
        return ClusterListItem(
            cluster_id=cluster_id,
            name=data.get("name", cluster_name),
            status=data.get("status", "UNKNOWN"),
            zone=data.get("location", zone),
            project_id=project_id,
            created_at=data.get("createTime")
        )
    except Exception as e:
        logger.error(f"[get_cluster] Exception: {e}")
        raise HTTPException(status_code=404, detail="Cluster not found")

async def create_cluster(request: ClusterCreateRequest, background_tasks: BackgroundTasks) -> ClusterResponse:
    logger = logging.getLogger("uvicorn.error")
    cluster_id = f"{request.project_id}:{request.zone}:{request.cluster_name}"
    def create_cluster_bg():
        logger.info(f"[create_cluster_bg] Starting cluster creation for {cluster_id}")
        cmd = [
            "python3", "-u", "../gcloud/main.py", "create",
            f"--project-id={request.project_id}",
            f"--zone={request.zone}",
            f"--cluster-name={request.cluster_name}",
            f"--machine-type={request.machine_type}",
            f"--num-nodes={request.num_nodes}",
            f"--gpu-machine-type={request.gpu_machine_type}",
            f"--gpu-type={request.gpu_type}",
            f"--gpu-nodes={request.gpu_nodes}",
            f"--gpus-per-node={request.gpus_per_node}",
            f"--min-gpu-nodes={request.min_gpu_nodes}",
            f"--max-gpu-nodes={request.max_gpu_nodes}",
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
            logger.info(f"[create_cluster_bg] Cluster creation finished for {cluster_id}")
            active_clusters[cluster_id] = ClusterListItem(
                cluster_id=cluster_id,
                name=request.cluster_name,
                status="provisioning",
                zone=request.zone,
                project_id=request.project_id
            )
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(discover_deployments_for_cluster(request.project_id, request.zone, request.cluster_name))
            loop.close()
        except Exception as e:
            logger.error(f"[create_cluster_bg] Exception: {e}")
    active_clusters[cluster_id] = ClusterListItem(
        cluster_id=cluster_id,
        name=request.cluster_name,
        status="provisioning",
        zone=request.zone,
        project_id=request.project_id
    )
    background_tasks.add_task(create_cluster_bg)
    logger.info(f"[create_cluster] Scheduled background task for {cluster_id}")
    return ClusterResponse(success=True, message="Cluster creation started", cluster_id=cluster_id)

async def delete_cluster(cluster_id: str) -> ClusterResponse:
    cluster = active_clusters.get(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cmd = [
        "python3", "-u", "../gcloud/main.py", "delete",
        f"--project-id={cluster.project_id}",
        f"--zone={cluster.zone}",
        f"--cluster-name={cluster.name}"
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        del active_clusters[cluster_id]
        return ClusterResponse(success=True, message="Cluster deletion started", cluster_id=cluster_id, detail=proc.stdout)
    except subprocess.CalledProcessError as e:
        return ClusterResponse(success=False, message="Cluster deletion failed", detail=e.stderr)

async def get_cluster_progress(cluster_id: str):
    logger = logging.getLogger("uvicorn.error")
    logger.info(f"[get_cluster_progress] Received cluster_id: {cluster_id}")
    cluster = active_clusters.get(cluster_id)
    if not cluster:
        parts = cluster_id.split(":")
        if len(parts) != 3:
            logger.error(f"[get_cluster_progress] Invalid cluster_id format: {cluster_id}")
            return JSONResponse({"error": "Cluster not found and invalid cluster_id format"}, status_code=404)
        project_id, zone, cluster_name = parts
        logger.info(f"[get_cluster_progress] Parsed project_id={project_id}, zone={zone}, cluster_name={cluster_name}")
    else:
        cluster_name = getattr(cluster, "name", None) or getattr(cluster, "cluster_name", None)
        zone = getattr(cluster, "zone", None)
        project_id = getattr(cluster, "project_id", None)
    if not (cluster_name and zone and project_id):
        logger.error(f"[get_cluster_progress] Missing cluster info for {cluster_id}")
        return JSONResponse({"error": "Missing cluster info"}, status_code=400)
    cmd = [
        "gcloud", "container", "clusters", "describe", cluster_name,
        f"--zone={zone}", f"--project={project_id}", "--format=json"
    ]
    try:
        proc = await asyncio.to_thread(lambda: subprocess.run(cmd, capture_output=True, text=True, check=True))
        data = json.loads(proc.stdout)
        status = data.get("status")
        node_pools = data.get("nodePools", [])
        node_pool_statuses = [
            {"name": np.get("name"), "status": np.get("status"), "currentNodeCount": np.get("currentNodeCount")}
            for np in node_pools
        ]
        resp = {
            "status": status,
            "nodePools": node_pool_statuses,
            "endpoint": data.get("endpoint"),
            "createTime": data.get("createTime"),
        }
        logger.info(f"[get_cluster_progress] Returning progress: {resp}")
        return JSONResponse(resp)
    except subprocess.CalledProcessError as e:
        logger.error(f"[get_cluster_progress] gcloud error: {e.stderr}")
        return JSONResponse({"error": e.stderr}, status_code=500)
    except Exception as e:
        logger.error(f"[get_cluster_progress] Exception: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

async def refresh_deployments_for_cluster(cluster_id: str):
    logger = logging.getLogger("uvicorn.error")
    logger.info(f"[refresh_deployments_for_cluster] Received cluster_id: {cluster_id}")
    cluster = active_clusters.get(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    deployments = await discover_deployments_for_cluster(cluster.project_id, cluster.zone, cluster.name)
    return {"success": True, "found": deployments}
