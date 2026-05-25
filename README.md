# KL Learning App

## Group members

Kareem Al-Allem (26133734)

Lali Lomidze Konovalova (26133759)

## Problem Statement

This Flashcard Learning app allows users to memorise things more easily, especially for the users who are having difficulties in memorising or studying, which will definitely improve their learning experience more efficiently. This learning app allows users to create the flashcard questions and edit or delete the questions. But this flashcard app has the user's flashcard app, where the user can log in with his current user account or create one before they start editing, as well as the admins could view all the learner history and modify it if the admin wishes to do so.

### Users Flashcard App

The registered users can create a flashcard by filling in the question in the questions bar and listing the answer to the question within the answers bar in the My Cards section, where the users can also edit these created cards and delete them if the user wishes to do so. The users could find the card by searching the question search cards bar, where this bar helps to filter out the questions and find the question that the user is searching for.

The study section within the user's flashcard app helps the users start the studying process where the users could flip the card to view the answer by either clicking on the card or clicking on the button under the card that is displayed as flip. Users could navigate to the next created flashcard by clicking on the next button and complete studying. Once the users have finished studying, they could end the studying mode by clicking on end session where it says session completed and start studying again once the end session button was clicked.

The history section within the user's flashcard app allows the user to view their history of deleted, edited, or created flashcards, which helps them to view any changes that were made in their flashcards. The users can see the question and answer before the edit and after the edit in the edited flashcard.

### Admins Flashcard App

The logged in admins have access to all the registered user flashcards and have access to delete them if they wish to do so or edit them. The admin could view every user's flashcard edits, deletions, or created history in the history section of the selected users in the admin's dashboard. The admin could find a specific user by searching for the user's email and find him easily in case there are a lot of registered users.

## Stack Components

| Layer | Technology |
|-------|-----------|
| **Frontend** | React |
| **Styling** | CSS |
| **Routing** | RESTful API |
| **Backend** | FastAPI (Python) |
| **Database** | MongoDB |
| **Authentication** | PyJWT + bcrypt |

## Feature List

* Create, edit, and delete flashcards
* Flip cards to reveal answers 
* Simple and clean user interface
* Live search - User can search for a specific flashcard question using the search bar, which filters out the cards based on the question input.
* User registration and login - accounts protected with bcrypt password hashing and JWT tokens.
* Study mode
* Learning history - Users can view their own history detailing the created, edited, and deleted flashcards. The admins can view every registered user's flashcard history.
* Role-based access control - Only registered admins have access to the admin's dashboard, and additionally, they can edit and delete the flashcards that were created by the registered users, but only the registered users have access to their own flashcards and the history of the created flashcards.

## Folder Structure 

```
group_programming/
│
├── backend/                          # Python / FastAPI server
│   ├── flashcard_app.py              # App entry point: routes, auth, CORS, JWT, RBAC
│   ├── flashcard_crud.py             # MongoDB connection, Flashcard model, all CRUD helpers
│
├── frontend/
|   |                                 # React / Vite client
│   ├── src/
│   │   ├── components/
│   │   │   ├── FlashCardApp.jsx      # Main user page: card list, search, study mode, history
│   │   │   ├── FlashCardApp.css      # Styles for the main user dashboard
│   │   │   ├── AdminApp.jsx          # Admin dashboard: user list, per-user cards and history
│   │   │   ├── AdminApp.css          # Styles for the admin dashboard
│   │   │   ├── Login.jsx             # Login form with JWT auth
│   │   │   ├── Register.jsx          # Registration form
│   │   │   └── Login.css             # Shared styles for Login and Register pages
│   │   │
│   │   ├── App.jsx                   # Root component: route tree, ProtectedRoute, AdminRoute guards
│   │   ├── App.css                   # Vite template global styles (not used by app pages)
│   │   ├── config.js                 # API base URL constant (edit here to point at production)
│   │   ├── index.css                 # Global CSS reset and base typography
│   │   ├── main.jsx                  # React entry point: mounts <App> inside BrowserRouter
│   │   └── utils.js                  # Shared helpers: logout(), getErrorMessage(), handleError()
│   │
│   ├── index.html                    # Single HTML shell; Vite injects the JS bundle here
│   ├── vite.config.js                # Vite configuration (React plugin)
│   ├── eslint.config.js              # ESLint flat config with React rules
└── README.md                         # This file
```
    
## Dependencies


### Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/)) - for React frontend
- **Python** 3.8+ ([Download](https://www.python.org/)) - for FastAPI backend
- **MongoDB** [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database/getting-started?utm_source=google&utm_campaign=search_gs_pl_evergreen_atlas_core-high-int_retarget-brand-allvisitors_gic-null_apac-au_ps-all_desktop_eng_lead&utm_term=mongodb%20atlas&utm_medium=cpc_paid_search&utm_ad=e&utm_ad_campaign_id=23741316628&adgroup=196720305962&cq_cmp=23741316628&gad_source=1&gad_campaignid=23741316628&gbraid=0AAAAADQ1403Ygcen_NTTfs4ZrC5soyNZO&gclid=CjwKCAjw5s_QBhAdEiwADD_gBljKrN2dVty4xT4a5LXaxdBBJ0FcI8YNCMm0wunSYWjlZOXYQ6b_2xoCjOAQAvD_BwE) - for database
- **Git** ([Download](https://git-scm.com/)) - for cloning the repository

Verify installations:
```bash
node --version      # Should show v18.x.x or higher
python --version    # Should show 3.8 or higher
git --version       # Should show 2.x.x or higher
```

### Step 1: Start MongoDB

#### 1.1 Open MongoDB Compass
- Launch MongoDB Atlas
- Create a cluster
- Get a connection string and add it to .env file within Visual Studio Code

### Step 2: Enviroment Variables
Create a `.env` file inside the `backend/` folder before starting the server:


```
MONGODB_URL=mongodb://localhost:27017
SECRET_KEY=replace_this_with_a_long_random_string
DATABASE_NAME="flashcarddb"
COLLECTION_NAME="flashcards"
USERS_COLLECTION_NAME="users"
```


| Variable | Description |
|---|---|
| `MONGODB_URL` | MongoDB connection string. Use `mongodb://localhost:27017` for a local instance or a MongoDB Atlas URI for cloud. |
| `SECRET_KEY` | Random secret used to sign JWT tokens. Keep this private and never commit it to version control. |


---

### Step 3: Setup Backend (FastAPI)

#### 3.1 Navigate to Backend Folder
```bash
cd backend
```

#### 3.2 Create Python Virtual Environment
Windows:
```bash
python -m venv venv
venv\Scripts\activate
```
macOS:
```bash
python3 -m venv venv
source venv/bin/activate
```

#### 3.3 Install Python Dependencies
```bash
pip install fastapi
pip install uvicorn
pip install pymongo
pip install python-dotenv
pip install pydantic
pip install motor
pip install pyjwt
pip install bcrypt
pip install python-multipart
```

#### 3.4 Run the Backend Server
```bash
python -m uvicorn flashcard_app:app --reload
```
Press `Ctrl+C` to quit

### Step 4: Setup Frontend

#### 4.1 Open a new terminal and keep the backend running

#### 4.2 Navigate to Frontend Folder
```bash
cd frontend
```

#### 4.3 Install Node Dependencies
```bash
npm install
npm install react-router-dom
```

#### 4.4 Start the Frontend Dev Server
```bash
npm run dev
```
Press `Ctrl+C` to quit

### Step 5: Access the Web App
Open browser and go to:

http://localhost:5173
