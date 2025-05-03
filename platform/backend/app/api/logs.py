from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.connection_manager import ConnectionManager
import logging

router = APIRouter()

logger = logging.getLogger("vllm-api")
manager = ConnectionManager()

@router.websocket("/ws/logs/{deployment_id}")
async def websocket_logs(websocket: WebSocket, deployment_id: str, pod_type: str = None):
    try:
        await manager.connect(websocket, deployment_id, pod_type)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, deployment_id)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await manager.disconnect(websocket, deployment_id)
