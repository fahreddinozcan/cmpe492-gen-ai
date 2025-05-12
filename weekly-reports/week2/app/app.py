from fastapi import FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List
import os
from datetime import datetime

app = FastAPI()

# MongoDB connection settings from environment variables
MONGODB_URL = f"mongodb://{os.getenv('MONGODB_USERNAME')}:{os.getenv('MONGODB_PASSWORD')}@{os.getenv('MONGODB_SERVER')}:27017"


class Item(BaseModel):
    name: str
    description: str = None
    price: float


@app.on_event("startup")
async def startup_db_client():
    app.mongodb_client = AsyncIOMotorClient(MONGODB_URL)
    app.mongodb = app.mongodb_client.test_database


@app.on_event("shutdown")
async def shutdown_db_client():
    app.mongodb_client.close()


@app.get("/")
async def root():
    return {"message": "FastAPI MongoDB Service"}


@app.post("/items/", response_model=Item)
async def create_item(item: Item):
    item_dict = item.dict()
    item_dict["created_at"] = datetime.utcnow()

    result = await app.mongodb.items.insert_one(item_dict)

    if result.inserted_id:
        return item
    raise HTTPException(status_code=400, detail="Failed to create item")


@app.get("/items/", response_model=List[Item])
async def list_items():
    items = []
    cursor = app.mongodb.items.find({})
    async for document in cursor:
        items.append(Item(**document))
    return items


@app.get("/items/count")
async def get_items_count():
    count = await app.mongodb.items.count_documents({})
    return {"count": count}


@app.get("/health")
async def health_check():
    try:
        # Check MongoDB connection
        await app.mongodb_client.admin.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not connected: {str(e)}")
