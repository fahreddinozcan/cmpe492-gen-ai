from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.deployment_init import initialize_deployments
from app.api.deployments import router as deployments_router
from app.api.clusters import router as clusters_router
from app.api.health import router as health_router
from app.api.logs import router as logs_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vllm-api")

app = FastAPI(title="vLLM Deployment API")

app.include_router(health_router)
app.include_router(deployments_router)
app.include_router(clusters_router)
app.include_router(logs_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize the application on startup"""
    logger.info("Initializing deployments...")
    await initialize_deployments()
