from datetime import datetime, timedelta, timezone
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Response, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from pymongo.errors import PyMongoError

import bcrypt
import jwt
from dotenv import load_dotenv
import os

import flashcard_crud as crud
from flashcard_crud import (
    connect_to_mongo,
    close_mongo_connection,
    Flashcard,
    db_get_flashcards,
    db_get_flashcard,
    db_create_flashcard,
    db_update_flashcard,
    db_delete_flashcard,
    db_get_all_users,
    db_log_history,
    db_get_history,
)

load_dotenv()

############################################
# --- Security Configuration ---
############################################

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

############################################
# --- Helper Functions (Security) ---
############################################

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Returns {"username": str, "role": str}."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role", "user")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return {"username": username, "role": role}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def get_owner_filter(current_user: dict) -> str | None:
    """Returns None for admins (bypasses ownership check) or the username for regular users."""
    return None if current_user["role"] == "admin" else current_user["username"]

############################################
# --- User Registration ---
############################################

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = "user"


async def register_user(data: RegisterRequest):
    existing = await crud.users_collection.find_one({"username": data.username})
    if existing:
        return
    await crud.users_collection.insert_one({
        "username": data.username,
        "password": get_password_hash(data.password),
        "role": data.role,
    })

############################################
# --- App Lifespan ---
############################################

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await connect_to_mongo()
        await register_user(RegisterRequest(username=os.getenv("ADMIN_EMAIL"), password=os.getenv("ADMIN_PASSWORD"), role="admin"))
        await register_user(RegisterRequest(username=os.getenv("TEST_USER_EMAIL"), password=os.getenv("TEST_USER_PASSWORD"), role="user"))
    except PyMongoError as e:
        print(f"WARNING: Could not connect to database on startup: {e}")
        print("The server will start but all database operations will fail until the database is available.")
    yield
    await close_mongo_connection()


app = FastAPI(title="Flashcard API", lifespan=lifespan)


@app.exception_handler(PyMongoError)
async def pymongo_exception_handler(request: Request, exc: PyMongoError):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Database unavailable. Please try again later."},
    )

############################################
# --- CORS ---
############################################

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

############################################
# --- Pydantic Schema ---
############################################

class FlashcardSchema(BaseModel):
    id: str
    question: str
    answer: str
    isFlipped: bool = False
    user_id: Optional[str] = None

############################################
# --- Public Registration Endpoint ---
############################################

class PublicRegisterRequest(BaseModel):
    fullname: str
    username: str
    password: str


@app.post("/register", status_code=201)
async def public_register(data: PublicRegisterRequest):
    existing = await crud.users_collection.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    await crud.users_collection.insert_one({
        "fullname": data.fullname,
        "username": data.username,
        "password": get_password_hash(data.password),
        "role": "user",
    })
    return {"message": "Account created successfully"}

############################################
# --- Auth Endpoint ---
############################################

@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await crud.users_collection.find_one({"username": form_data.username})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not verify_password(form_data.password, user.get("password")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    role = user.get("role", "user")
    access_token = create_access_token(
        data={"sub": form_data.username, "role": role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": form_data.username,
        "role": role,
    }

############################################
# --- Flashcard Endpoints (protected) ---
############################################

@app.get("/flashcards", response_model=List[FlashcardSchema])
async def get_all_flashcards(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    # Passing None to db_get_flashcards omits the user_id filter, returning all cards (admin only)
    user_filter = get_owner_filter(current_user)
    flashcards = await db_get_flashcards(user_id=user_filter, skip=skip, limit=limit)
    return [FlashcardSchema(**fc.to_dict()) for fc in flashcards]


@app.post("/flashcards", response_model=FlashcardSchema)
async def create_flashcard(
    flashcard: FlashcardSchema,
    current_user: dict = Depends(get_current_user),
):
    fc = Flashcard(
        id=flashcard.id,
        question=flashcard.question,
        answer=flashcard.answer,
        isFlipped=flashcard.isFlipped,
        user_id=current_user["username"],
    )
    created = await db_create_flashcard(fc)
    await db_log_history({
        "type": "create",
        "user_id": current_user["username"],
        "cardId": flashcard.id,
        "date": datetime.now(timezone.utc).isoformat(),
        "q": flashcard.question,
        "a": flashcard.answer,
    })
    return FlashcardSchema(**created.to_dict())


@app.put("/flashcards/{flashcard_id}", response_model=FlashcardSchema)
async def update_flashcard(
    flashcard_id: str,
    updated_object: FlashcardSchema,
    current_user: dict = Depends(get_current_user),
):
    owner_filter = get_owner_filter(current_user)
    old_card = await db_get_flashcard(flashcard_id)
    fc = Flashcard(
        id=updated_object.id,
        question=updated_object.question,
        answer=updated_object.answer,
        isFlipped=updated_object.isFlipped,
        user_id=updated_object.user_id,
    )
    db_flashcard = await db_update_flashcard(flashcard_id, fc, user_id=owner_filter)
    if not db_flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    # Only log an edit event if the question or answer actually changed (ignore flip-only updates)
    if old_card and (old_card.question != updated_object.question or old_card.answer != updated_object.answer):
        await db_log_history({
            "type": "edit",
            "user_id": old_card.user_id,
            "cardId": flashcard_id,
            "date": datetime.now(timezone.utc).isoformat(),
            "oldQ": old_card.question,
            "oldA": old_card.answer,
            "newQ": updated_object.question,
            "newA": updated_object.answer,
        })
    return FlashcardSchema(**db_flashcard.to_dict())


@app.delete("/flashcards/{flashcard_id}")
async def delete_flashcard(
    flashcard_id: str,
    current_user: dict = Depends(get_current_user),
):
    owner_filter = get_owner_filter(current_user)
    card = await db_get_flashcard(flashcard_id)
    success = await db_delete_flashcard(flashcard_id, user_id=owner_filter)
    if not success:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    if card:
        await db_log_history({
            "type": "delete",
            "user_id": card.user_id,
            "cardId": flashcard_id,
            "date": datetime.now(timezone.utc).isoformat(),
            "q": card.question,
            "a": card.answer,
        })
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/history")
async def get_history(current_user: dict = Depends(get_current_user)):
    return await db_get_history(current_user["username"])

############################################
# --- Admin Endpoints ---
############################################

@app.get("/admin/users")
async def get_all_users(current_user: dict = Depends(require_admin)):
    return await db_get_all_users()


@app.get("/admin/users/{user_id}/history")
async def get_user_history(
    user_id: str,
    current_user: dict = Depends(require_admin),
):
    return await db_get_history(user_id)


@app.get("/admin/users/{user_id}/flashcards", response_model=List[FlashcardSchema])
async def get_user_flashcards(
    user_id: str,
    current_user: dict = Depends(require_admin),
):
    flashcards = await db_get_flashcards(user_id=user_id)
    return [FlashcardSchema(**fc.to_dict()) for fc in flashcards]
