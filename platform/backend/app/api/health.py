from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health_check():
    """API health check endpoint"""
    return {"status": "healthy"}
