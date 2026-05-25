from datetime import datetime, timedelta, timezone  # datetime for timestamps, timedelta for token expiry durations, timezone for UTC awareness
from typing import List, Optional  # List for typed lists in response models, Optional for fields that can be None
from contextlib import asynccontextmanager  # asynccontextmanager lets us define async startup/shutdown logic for the app

from fastapi import FastAPI, HTTPException, Depends, Response, status, Request  # core FastAPI building blocks: app, errors, dependency injection, raw responses, HTTP status codes, request object
from fastapi.middleware.cors import CORSMiddleware  # middleware that adds CORS headers so the frontend (different port) can talk to the API
from fastapi.responses import JSONResponse  # lets us return a JSON response manually with a custom status code
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm  # OAuth2 helpers: bearer token extractor and login form parser
from pydantic import BaseModel, Field  # BaseModel is the base class for all request/response schemas; Field adds extra validation options
from pymongo.errors import PyMongoError  # base exception class for all MongoDB driver errors

import bcrypt  # bcrypt library for hashing and verifying passwords securely
import jwt  # PyJWT library for encoding and decoding JSON Web Tokens
from dotenv import load_dotenv  # loads environment variables from a .env file into os.environ
import os  # standard library for reading environment variables

import flashcard_crud as crud  # import the CRUD module so we can access the users_collection directly
from flashcard_crud import (  # import all individual database helper functions and the Flashcard model
    connect_to_mongo,  # async function that opens the MongoDB connection
    close_mongo_connection,  # async function that closes the MongoDB connection
    Flashcard,  # the internal Flashcard dataclass used by the CRUD layer
    db_get_flashcards,  # fetches a list of flashcards, optionally filtered by user_id
    db_get_flashcard,  # fetches a single flashcard by its ID
    db_create_flashcard,  # inserts a new flashcard document into MongoDB
    db_update_flashcard,  # updates an existing flashcard document in MongoDB
    db_delete_flashcard,  # deletes a flashcard document from MongoDB
    db_get_all_users,  # fetches all registered user documents (admin only)
    db_log_history,  # inserts a history event (create/edit/delete) into the history collection
    db_get_history,  # fetches the history log for a specific user
)

load_dotenv()  # read the .env file and populate os.environ with SECRET_KEY, DB credentials, etc.

############################################
# --- Security Configuration ---
############################################

SECRET_KEY = os.getenv("SECRET_KEY")  # secret string used to sign and verify JWT tokens; must be kept private
ALGORITHM = "HS256"  # HMAC-SHA256 signing algorithm used when encoding JWTs
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # JWT tokens become invalid 30 minutes after they are issued

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")  # tells FastAPI where clients get tokens; auto-extracts the Bearer token from the Authorization header

############################################
# --- Helper Functions (Security) ---
############################################

def get_password_hash(password: str) -> str:  # takes a plain-text password and returns a bcrypt hash string
    pwd_bytes = password.encode("utf-8")  # convert the password string to bytes, which bcrypt requires
    salt = bcrypt.gensalt(rounds=12)  # generate a random salt with cost factor 12 (controls how slow/secure the hash is)
    hashed = bcrypt.hashpw(pwd_bytes, salt)  # combine the password bytes and salt to produce the hash
    return hashed.decode("utf-8")  # decode the hash bytes back to a string so it can be stored in MongoDB


def verify_password(plain_password: str, hashed_password: str) -> bool:  # checks whether a plain-text password matches a stored bcrypt hash
    pwd_bytes = plain_password.encode("utf-8")  # encode the submitted password to bytes
    hashed_bytes = hashed_password.encode("utf-8")  # encode the stored hash string back to bytes for comparison
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)  # returns True if the password matches the hash, False otherwise


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):  # builds and returns a signed JWT containing the given data payload
    payload = data.copy()  # copy the data dict so we don't mutate the original
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))  # set expiry to now + provided delta, or default to 15 minutes
    payload.update({"exp": expire})  # add the expiry claim to the payload so PyJWT enforces it on decode
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)  # sign the payload with the secret key and return the JWT string


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:  # FastAPI dependency that validates the JWT and returns the logged-in user's info
    """Returns {"username": str, "role": str}."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])  # decode and verify the token signature and expiry
        username: str = payload.get("sub")  # extract the "sub" (subject) claim which holds the username
        role: str = payload.get("role", "user")  # extract the "role" claim; default to "user" if missing
        if username is None:  # a valid token must always contain a subject claim
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")  # reject the request with 401 if no username found
        return {"username": username, "role": role}  # return the user's identity so route handlers can use it
    except jwt.ExpiredSignatureError:  # token's "exp" claim is in the past
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")  # tell the client their token is stale
    except jwt.PyJWTError:  # covers all other JWT errors (bad signature, malformed token, etc.)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")  # generic auth failure response


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:  # dependency that blocks access unless the current user has the "admin" role
    if current_user["role"] != "admin":  # check the role extracted from the JWT
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")  # return 403 Forbidden for non-admin users
    return current_user  # pass the user dict through to the route handler


def get_owner_filter(current_user: dict) -> str | None:  # returns None for admins (see all cards) or the username for regular users (see only their cards)
    """Returns None for admins (bypasses ownership check) or the username for regular users."""
    return None if current_user["role"] == "admin" else current_user["username"]  # None means no filter; username means filter by owner

############################################
# --- User Registration ---
############################################

class RegisterRequest(BaseModel):  # internal schema used during app startup to seed the default admin and test users
    username: str  # the user's email/username
    password: str  # the user's plain-text password (will be hashed before storing)
    role: Optional[str] = "user"  # the user's role; defaults to "user" if not specified


async def register_user(data: RegisterRequest):  # inserts a user into the database; silently skips if the username already exists
    existing = await crud.users_collection.find_one({"username": data.username})  # query MongoDB to see if this username is taken
    if existing:  # if a document was found, the user already exists
        return  # do nothing — avoids duplicate seed users on every server restart
    await crud.users_collection.insert_one({  # insert a new user document into the users collection
        "username": data.username,  # store the username as provided
        "password": get_password_hash(data.password),  # store the bcrypt hash, never the plain-text password
        "role": data.role,  # store the role ("admin" or "user")
    })

############################################
# --- App Lifespan ---
############################################

@asynccontextmanager  # decorator that marks this function as an async context manager for FastAPI's lifespan
async def lifespan(app: FastAPI):  # runs startup code before "yield" and shutdown code after "yield"
    try:
        await connect_to_mongo()  # open the MongoDB connection pool before the server starts accepting requests
        await register_user(RegisterRequest(username=os.getenv("ADMIN_EMAIL"), password=os.getenv("ADMIN_PASSWORD"), role="admin"))  # seed the default admin account from environment variables
        await register_user(RegisterRequest(username=os.getenv("TEST_USER_EMAIL"), password=os.getenv("TEST_USER_PASSWORD"), role="user"))  # seed a default test user account from environment variables
    except PyMongoError as e:  # catch any MongoDB connection failure at startup
        print(f"WARNING: Could not connect to database on startup: {e}")  # log the error so the developer knows the DB is unavailable
        print("The server will start but all database operations will fail until the database is available.")  # warn that the server is running in a degraded state
    yield  # server is now running and handling requests; everything after yield runs on shutdown
    await close_mongo_connection()  # cleanly close the MongoDB connection pool when the server shuts down


app = FastAPI(title="Flashcard API", lifespan=lifespan)  # create the FastAPI application instance with a display title and the lifespan handler


@app.exception_handler(PyMongoError)  # register a global handler that catches any unhandled PyMongoError across all routes
async def pymongo_exception_handler(request: Request, exc: PyMongoError):  # called automatically whenever a route raises a PyMongoError
    return JSONResponse(  # return a structured JSON error response instead of a raw 500
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,  # 503 signals that the server is temporarily unable to handle the request
        content={"detail": "Database unavailable. Please try again later."},  # human-readable message for the client
    )

############################################
# --- CORS ---
############################################

origins = [  # list of frontend origins that are allowed to make cross-origin requests to this API
    "http://localhost:3000",  # React dev server (Create React App default port)
    "http://127.0.0.1:3000",  # same as above but using IP instead of hostname
    "http://localhost:5173",  # Vite dev server default port
    "http://127.0.0.1:5173",  # same as above but using IP instead of hostname
]

app.add_middleware(  # attach the CORS middleware to the app so it processes every incoming request
    CORSMiddleware,  # the middleware class that adds the Access-Control-* response headers
    allow_origins=origins,  # only allow requests from the listed frontend origins
    allow_credentials=True,  # allow the browser to send cookies and Authorization headers cross-origin
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # explicitly permit only these HTTP methods
    allow_headers=["*"],  # allow any request headers (e.g., Authorization, Content-Type)
)

############################################
# --- Pydantic Schema ---
############################################

class FlashcardSchema(BaseModel):  # Pydantic model used to validate and serialize flashcard data in API requests and responses
    id: str  # unique identifier for the flashcard (generated on the frontend)
    question: str  # the question text shown on the front of the card
    answer: str  # the answer text shown on the back of the card
    isFlipped: bool = False  # tracks whether the card is currently showing its answer side; defaults to False
    user_id: Optional[str] = None  # the username of the card's owner; None when the client doesn't send it

############################################
# --- Public Registration Endpoint ---
############################################

class PublicRegisterRequest(BaseModel):  # schema for the public sign-up endpoint; requires full name, username, and password
    fullname: str  # the user's display name
    username: str  # the user's email address used as login identifier
    password: str  # the user's chosen password in plain text (hashed before storage)


@app.post("/register", status_code=201)  # POST /register creates a new account; returns 201 Created on success
async def public_register(data: PublicRegisterRequest):  # handles public self-registration requests
    existing = await crud.users_collection.find_one({"username": data.username})  # check if this email is already registered
    if existing:  # if a user with this username already exists
        raise HTTPException(status_code=400, detail="Email already registered")  # return 400 Bad Request to prevent duplicate accounts
    await crud.users_collection.insert_one({  # insert the new user document into MongoDB
        "fullname": data.fullname,  # store the display name
        "username": data.username,  # store the email/username
        "password": get_password_hash(data.password),  # hash the password before storing it
        "role": "user",  # all self-registered users get the "user" role, never "admin"
    })
    return {"message": "Account created successfully"}  # confirm successful registration to the client

############################################
# --- Auth Endpoint ---
############################################

@app.post("/token")  # POST /token is the OAuth2 login endpoint; clients submit credentials here to receive a JWT
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):  # FastAPI parses the form-encoded username and password automatically
    user = await crud.users_collection.find_one({"username": form_data.username})  # look up the user by their submitted username
    if not user:  # if no matching user document was found in the database
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")  # return 401 so the client knows the username is wrong
    if not verify_password(form_data.password, user.get("password")):  # compare the submitted password against the stored bcrypt hash
        raise HTTPException(  # password did not match — raise an authentication error
            status_code=status.HTTP_401_UNAUTHORIZED,  # 401 Unauthorized
            detail="Incorrect username or password",  # intentionally vague to not reveal which field was wrong
            headers={"WWW-Authenticate": "Bearer"},  # standard header telling the client to use Bearer token auth
        )
    role = user.get("role", "user")  # read the user's role from the database; default to "user" if the field is missing
    access_token = create_access_token(  # build the signed JWT for this user
        data={"sub": form_data.username, "role": role},  # embed the username as "sub" and the role in the token payload
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),  # token expires after 30 minutes
    )
    return {  # return the token and user metadata so the frontend can store them
        "access_token": access_token,  # the signed JWT string the client must include in future requests
        "token_type": "bearer",  # tells the client this is a Bearer token
        "username": form_data.username,  # echo the username so the frontend can display it
        "role": role,  # echo the role so the frontend can show/hide admin features
    }

############################################
# --- Flashcard Endpoints (protected) ---
############################################

@app.get("/flashcards", response_model=List[FlashcardSchema])  # GET /flashcards returns all flashcards the current user is allowed to see
async def get_all_flashcards(  # route handler for listing flashcards
    skip: int = 0,  # number of records to skip; used for pagination (default 0 = start from the beginning)
    limit: int = 100,  # maximum number of records to return (default 100)
    current_user: dict = Depends(get_current_user),  # inject the authenticated user from the JWT
):
    # Passing None to db_get_flashcards omits the user_id filter, returning all cards (admin only)
    user_filter = get_owner_filter(current_user)  # None for admins (all cards), username for regular users (their cards only)
    flashcards = await db_get_flashcards(user_id=user_filter, skip=skip, limit=limit)  # query MongoDB with the appropriate filter and pagination
    return [FlashcardSchema(**fc.to_dict()) for fc in flashcards]  # convert each Flashcard object to a validated FlashcardSchema for the response


@app.post("/flashcards", response_model=FlashcardSchema)  # POST /flashcards creates a new flashcard for the authenticated user
async def create_flashcard(  # route handler for creating a flashcard
    flashcard: FlashcardSchema,  # the new card's data, validated by Pydantic
    current_user: dict = Depends(get_current_user),  # inject the authenticated user so we can assign ownership
):
    fc = Flashcard(  # build the internal Flashcard object that the CRUD layer expects
        id=flashcard.id,  # use the ID provided by the frontend
        question=flashcard.question,  # copy the question text
        answer=flashcard.answer,  # copy the answer text
        isFlipped=flashcard.isFlipped,  # copy the flip state
        user_id=current_user["username"],  # assign the card to the authenticated user, ignoring any user_id sent by the client
    )
    created = await db_create_flashcard(fc)  # insert the flashcard into MongoDB and get back the saved document
    await db_log_history({  # record a "create" event in the history collection
        "type": "create",  # event type label
        "user_id": current_user["username"],  # who created the card
        "cardId": flashcard.id,  # which card was created
        "date": datetime.now(timezone.utc).isoformat(),  # UTC timestamp in ISO 8601 format
        "q": flashcard.question,  # snapshot of the question at creation time
        "a": flashcard.answer,  # snapshot of the answer at creation time
    })
    return FlashcardSchema(**created.to_dict())  # return the newly created card as a validated schema object


@app.put("/flashcards/{flashcard_id}", response_model=FlashcardSchema)  # PUT /flashcards/{id} replaces an existing flashcard's data
async def update_flashcard(  # route handler for updating a flashcard
    flashcard_id: str,  # the ID of the flashcard to update, taken from the URL path
    updated_object: FlashcardSchema,  # the new data for the flashcard, validated by Pydantic
    current_user: dict = Depends(get_current_user),  # inject the authenticated user for ownership checks
):
    owner_filter = get_owner_filter(current_user)  # None for admins, username for regular users (prevents editing other users' cards)
    old_card = await db_get_flashcard(flashcard_id)  # fetch the current card before updating so we can compare old vs new values for history
    fc = Flashcard(  # build the updated Flashcard object for the CRUD layer
        id=updated_object.id,  # use the ID from the request body
        question=updated_object.question,  # new question text
        answer=updated_object.answer,  # new answer text
        isFlipped=updated_object.isFlipped,  # new flip state
        user_id=updated_object.user_id,  # preserve the user_id as sent (the CRUD layer enforces ownership separately)
    )
    db_flashcard = await db_update_flashcard(flashcard_id, fc, user_id=owner_filter)  # perform the update in MongoDB; returns None if not found or not owned
    if not db_flashcard:  # None means the card doesn't exist or the user doesn't own it
        raise HTTPException(status_code=404, detail="Flashcard not found")  # return 404 so the client knows the update failed
    # Only log an edit event if the question or answer actually changed (ignore flip-only updates)
    if old_card and (old_card.question != updated_object.question or old_card.answer != updated_object.answer):  # compare old and new content to detect a real edit
        await db_log_history({  # record an "edit" event only when meaningful content changed
            "type": "edit",  # event type label
            "user_id": old_card.user_id,  # owner of the card
            "cardId": flashcard_id,  # which card was edited
            "date": datetime.now(timezone.utc).isoformat(),  # UTC timestamp of the edit
            "oldQ": old_card.question,  # the question text before the edit
            "oldA": old_card.answer,  # the answer text before the edit
            "newQ": updated_object.question,  # the question text after the edit
            "newA": updated_object.answer,  # the answer text after the edit
        })
    return FlashcardSchema(**db_flashcard.to_dict())  # return the updated card as a validated schema object


@app.delete("/flashcards/{flashcard_id}")  # DELETE /flashcards/{id} removes a flashcard permanently
async def delete_flashcard(  # route handler for deleting a flashcard
    flashcard_id: str,  # the ID of the flashcard to delete, taken from the URL path
    current_user: dict = Depends(get_current_user),  # inject the authenticated user for ownership checks
):
    owner_filter = get_owner_filter(current_user)  # None for admins, username for regular users
    card = await db_get_flashcard(flashcard_id)  # fetch the card before deleting so we can log its question/answer in the history
    success = await db_delete_flashcard(flashcard_id, user_id=owner_filter)  # attempt to delete from MongoDB; returns False if not found or not owned
    if not success:  # False means the card didn't exist or the user doesn't own it
        raise HTTPException(status_code=404, detail="Flashcard not found")  # return 404 to inform the client
    if card:  # only log history if we successfully retrieved the card details before deletion
        await db_log_history({  # record a "delete" event for the audit trail
            "type": "delete",  # event type label
            "user_id": card.user_id,  # owner of the deleted card
            "cardId": flashcard_id,  # which card was deleted
            "date": datetime.now(timezone.utc).isoformat(),  # UTC timestamp of the deletion
            "q": card.question,  # snapshot of the question that was deleted
            "a": card.answer,  # snapshot of the answer that was deleted
        })
    return Response(status_code=status.HTTP_204_NO_CONTENT)  # 204 No Content is the standard response for a successful DELETE with no body


@app.get("/history")  # GET /history returns the action history (creates, edits, deletes) for the current user
async def get_history(current_user: dict = Depends(get_current_user)):  # route handler for fetching history; requires authentication
    return await db_get_history(current_user["username"])  # query the history collection filtered to this user's events

############################################
# --- Admin Endpoints ---
############################################

@app.get("/admin/users")  # GET /admin/users lists all registered users; restricted to admins
async def get_all_users(current_user: dict = Depends(require_admin)):  # require_admin dependency blocks non-admin access with 403
    return await db_get_all_users()  # fetch and return every user document from the database


@app.get("/admin/users/{user_id}/history")  # GET /admin/users/{user_id}/history returns the action history for a specific user; admin only
async def get_user_history(  # route handler for admin viewing any user's history
    user_id: str,  # the username whose history we want to retrieve, from the URL path
    current_user: dict = Depends(require_admin),  # block non-admins
):
    return await db_get_history(user_id)  # fetch and return all history events belonging to this user


@app.get("/admin/users/{user_id}/flashcards", response_model=List[FlashcardSchema])  # GET /admin/users/{user_id}/flashcards lists all flashcards for a specific user; admin only
async def get_user_flashcards(  # route handler for admin viewing any user's flashcards
    user_id: str,  # the username whose flashcards we want, from the URL path
    current_user: dict = Depends(require_admin),  # block non-admins
):
    flashcards = await db_get_flashcards(user_id=user_id)  # fetch flashcards from MongoDB filtered to this specific user
    return [FlashcardSchema(**fc.to_dict()) for fc in flashcards]  # convert each Flashcard object to a validated FlashcardSchema for the response
