# Shared state for the FastAPI backend
# All modules should import and use these to ensure a single source of truth

active_deployments = {}
active_clusters = {}
