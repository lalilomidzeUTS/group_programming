from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
from typing import List, Optional
from dotenv import load_dotenv
import os
import certifi

load_dotenv()

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = "flashcarddb"
COLLECTION_NAME = "flashcards"

client: AsyncIOMotorClient = None
db = None


async def connect_to_mongo():
    """Connect to MongoDB on app startup."""
    global client, db
    client = AsyncIOMotorClient(MONGODB_URL, tlsCAFile=certifi.where())
    db = client[DATABASE_NAME]
    # Create collection and index if they don't exist
    await db[COLLECTION_NAME].create_index([("id", ASCENDING)], unique=True)
    print(f"Connected to MongoDB: {DATABASE_NAME}")


async def close_mongo_connection():
    """Close MongoDB connection on app shutdown."""
    global client
    if client:
        client.close()
        print("Closed MongoDB connection")


# Flashcard model (Pydantic-like structure)
class Flashcard:
    def __init__(self, id: str, question: str, answer: str, isFlipped: bool = False):
        self.id = id
        self.question = question
        self.answer = answer
        self.isFlipped = isFlipped

    def to_dict(self):
        return {
            "id": self.id,
            "question": self.question,
            "answer": self.answer,
            "isFlipped": self.isFlipped
        }

    @staticmethod
    def from_dict(data):
        return Flashcard(
            id=data.get("id"),
            question=data.get("question"),
            answer=data.get("answer"),
            isFlipped=data.get("isFlipped", False)
        )


# CRUD operations

async def db_create_flashcard(flashcard: Flashcard) -> Flashcard:
    """Insert a new flashcard."""
    collection = db[COLLECTION_NAME]
    await collection.insert_one(flashcard.to_dict())
    return flashcard


async def db_get_flashcard(flashcard_id: str) -> Optional[Flashcard]:
    """Fetch a flashcard by ID."""
    collection = db[COLLECTION_NAME]
    data = await collection.find_one({"id": flashcard_id})
    if data:
        # Remove MongoDB's _id field before returning
        data.pop("_id", None)
        return Flashcard.from_dict(data)
    return None


async def db_get_flashcards(skip: int = 0, limit: int = 100) -> List[Flashcard]:
    """Fetch all flashcards with pagination."""
    collection = db[COLLECTION_NAME]
    cursor = collection.find().skip(skip).limit(limit)
    flashcards = []
    async for data in cursor:
        data.pop("_id", None)  # Remove MongoDB's _id field
        flashcards.append(Flashcard.from_dict(data))
    return flashcards


async def db_update_flashcard(flashcard_id: str, flashcard_update: Flashcard) -> Optional[Flashcard]:
    """Update an existing flashcard."""
    collection = db[COLLECTION_NAME]
    result = await collection.update_one(
        {"id": flashcard_id},
        {"$set": flashcard_update.to_dict()}
    )
    if result.matched_count == 0:
        return None
    return await db_get_flashcard(flashcard_id)


async def db_delete_flashcard(flashcard_id: str) -> bool:
    """Delete a flashcard by ID."""
    collection = db[COLLECTION_NAME]
    result = await collection.delete_one({"id": flashcard_id})
    return result.deleted_count > 0