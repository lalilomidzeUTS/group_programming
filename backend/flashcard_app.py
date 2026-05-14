from datetime import datetime, timedelta, timezone
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

import bcrypt
import jwt
from dotenv import load_dotenv
import os

from flashcard_crud import (
    connect_to_mongo,
    close_mongo_connection,
    users_collection,
    Flashcard,
    db_get_flashcards,
    db_get_flashcard,
    db_create_flashcard,
    db_update_flashcard,
    db_delete_flashcard,
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


async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

############################################
# --- User Registration ---
############################################

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = "user"


async def register_user(data: RegisterRequest):
    # Import here to get the module-level variable after connect_to_mongo() has set it
    import flashcard_crud as crud
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
    await connect_to_mongo()
    # Pre-populate test users
    await register_user(RegisterRequest(username="admin@example.com", password="admin", role="admin"))
    await register_user(RegisterRequest(username="testuser@example.com", password="testuser", role="user"))
    yield
    await close_mongo_connection()


app = FastAPI(title="Flashcard API", lifespan=lifespan)

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

############################################
# --- Auth Endpoint ---
############################################

@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    import flashcard_crud as crud
    user = await crud.users_collection.find_one({"username": form_data.username})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not verify_password(form_data.password, user.get("password")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": form_data.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": form_data.username,
        "role": user.get("role"),
    }

############################################
# --- Flashcard Endpoints (protected) ---
############################################

@app.get("/flashcards", response_model=List[FlashcardSchema])
async def get_all_flashcards(
    skip: int = 0,
    limit: int = 100,
    current_user: str = Depends(get_current_user),
):
    try:
        flashcards = await db_get_flashcards(skip=skip, limit=limit)
        return [FlashcardSchema(**fc.to_dict()) for fc in flashcards]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/flashcards", response_model=FlashcardSchema)
async def create_flashcard(
    flashcard: FlashcardSchema,
    current_user: str = Depends(get_current_user),
):
    try:
        fc = Flashcard(
            id=flashcard.id,
            question=flashcard.question,
            answer=flashcard.answer,
            isFlipped=flashcard.isFlipped,
        )
        created = await db_create_flashcard(fc)
        return FlashcardSchema(**created.to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/flashcards/{flashcard_id}", response_model=FlashcardSchema)
async def update_flashcard(
    flashcard_id: str,
    updated_object: FlashcardSchema,
    current_user: str = Depends(get_current_user),
):
    try:
        fc = Flashcard(
            id=updated_object.id,
            question=updated_object.question,
            answer=updated_object.answer,
            isFlipped=updated_object.isFlipped,
        )
        db_flashcard = await db_update_flashcard(flashcard_id, fc)
        if not db_flashcard:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        return FlashcardSchema(**db_flashcard.to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/flashcards/{flashcard_id}/flip", response_model=FlashcardSchema)
async def flip_flashcard(
    flashcard_id: str,
    current_user: str = Depends(get_current_user),
):
    try:
        flashcard = await db_get_flashcard(flashcard_id)
        if not flashcard:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        flashcard.isFlipped = not flashcard.isFlipped
        updated = await db_update_flashcard(flashcard_id, flashcard)
        return FlashcardSchema(**updated.to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/flashcards/{flashcard_id}")
async def delete_flashcard(
    flashcard_id: str,
    current_user: str = Depends(get_current_user),
):
    try:
        success = await db_delete_flashcard(flashcard_id)
        if not success:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
