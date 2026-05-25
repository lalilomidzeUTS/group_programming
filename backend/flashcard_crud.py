from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
from typing import List, Optional
from dotenv import load_dotenv
import os
import certifi

load_dotenv()

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")
COLLECTION_NAME = os.getenv("COLLECTION_NAME")
USERS_COLLECTION_NAME = os.getenv("USERS_COLLECTION_NAME")
HISTORY_COLLECTION_NAME = os.getenv("HISTORY_COLLECTION_NAME", "history")

client: AsyncIOMotorClient = None
db = None
users_collection = None
history_collection = None


async def connect_to_mongo():
    global client, db, users_collection, history_collection
    client = AsyncIOMotorClient(MONGODB_URL, tlsCAFile=certifi.where())
    db = client[DATABASE_NAME]
    await db[COLLECTION_NAME].create_index([("id", ASCENDING)], unique=True)
    users_collection = db[USERS_COLLECTION_NAME]
    history_collection = db[HISTORY_COLLECTION_NAME]
    print(f"Connected to MongoDB: {DATABASE_NAME}")


async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("Closed MongoDB connection")


class Flashcard:
    def __init__(self, id: str, question: str, answer: str, isFlipped: bool = False, user_id: str = None):
        self.id = id
        self.question = question
        self.answer = answer
        self.isFlipped = isFlipped
        self.user_id = user_id

    def to_dict(self):
        return {
            "id": self.id,
            "question": self.question,
            "answer": self.answer,
            "isFlipped": self.isFlipped,
            "user_id": self.user_id,
        }

    @staticmethod
    def from_dict(data):
        return Flashcard(
            id=data.get("id"),
            question=data.get("question"),
            answer=data.get("answer"),
            isFlipped=data.get("isFlipped", False),
            user_id=data.get("user_id"),
        )


# CRUD operations

async def db_create_flashcard(flashcard: "Flashcard") -> "Flashcard":
    collection = db[COLLECTION_NAME]
    await collection.insert_one(flashcard.to_dict())
    return flashcard


async def db_get_flashcard(flashcard_id: str) -> Optional["Flashcard"]:
    collection = db[COLLECTION_NAME]
    data = await collection.find_one({"id": flashcard_id})
    if data:
        data.pop("_id", None)
        return Flashcard.from_dict(data)
    return None


async def db_get_flashcards(user_id: str = None, skip: int = 0, limit: int = 100) -> List["Flashcard"]:
    """Fetch flashcards. Pass user_id to filter by owner; omit for all cards (admin)."""
    collection = db[COLLECTION_NAME]
    query = {"user_id": user_id} if user_id else {}
    cursor = collection.find(query).skip(skip).limit(limit)
    flashcards = []
    async for data in cursor:
        data.pop("_id", None)
        flashcards.append(Flashcard.from_dict(data))
    return flashcards


async def db_update_flashcard(flashcard_id: str, flashcard_update: "Flashcard", user_id: str = None) -> Optional["Flashcard"]:
    """Update a flashcard. Pass user_id to enforce ownership; omit for admin updates."""
    collection = db[COLLECTION_NAME]
    query = {"id": flashcard_id}
    if user_id:
        query["user_id"] = user_id
    result = await collection.update_one(query, {"$set": flashcard_update.to_dict()})
    if result.matched_count == 0:
        return None
    return await db_get_flashcard(flashcard_id)


async def db_delete_flashcard(flashcard_id: str, user_id: str = None) -> bool:
    """Delete a flashcard. Pass user_id to enforce ownership; omit for admin deletes."""
    collection = db[COLLECTION_NAME]
    query = {"id": flashcard_id}
    if user_id:
        query["user_id"] = user_id
    result = await collection.delete_one(query)
    return result.deleted_count > 0


async def db_log_history(event: dict) -> None:
    await history_collection.insert_one(event)


async def db_get_history(user_id: str) -> List[dict]:
    events = []
    async for doc in history_collection.find({"user_id": user_id}, {"_id": 0}).sort("date", -1):
        events.append(doc)
    return events


async def db_get_all_users() -> List[str]:
    """Return a list of all usernames."""
    usernames = []
    async for user in users_collection.find({}, {"_id": 0, "username": 1}):
        usernames.append(user["username"])
    return usernames
