import os
import asyncio
import jwt
from datetime import datetime, timedelta
from typing import List, Dict
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from groq import Groq

# Load environment variables
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing")

ai_db_username = os.getenv("AI_DB_USERNAME")
ai_db_password = os.getenv("AI_DB_PASSWORD")
ai_db_name = os.getenv("AI_DB_DATABASE")

# Database configuration
DATABASE_URL = f"postgresql://{ai_db_username}:{ai_db_password}@localhost/{ai_db_name}"
engine = create_engine(DATABASE_URL)

# Check database connection
try:
    with engine.connect() as connection:
        print("✅ Database connection successful!")
except Exception as e:
    print(f"❌ Database connection failed: {e}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = "aichatbot"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# FastAPI App
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=GROQ_API_KEY)

# User Model
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)

Base.metadata.create_all(bind=engine)

# Dependency for database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Schema for User Input
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

# Function to create JWT access token
def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# User Registration Route
@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    hashed_password = pwd_context.hash(user.password)
    new_user = User(username=user.username, email=user.email, password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

# User Login Route
@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not pwd_context.verify(user.password, db_user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    access_token = create_access_token({"sub": db_user.username}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}

# WebSocket Conversation Management
class Conversation:
    def __init__(self):
        self.messages: List[Dict[str, str]] = [
            {"role": "system", "content": "You are a useful AI assistant."}
        ]
        self.active: bool = True
        self.websockets: List[WebSocket] = []
        self.lock = asyncio.Lock()

    async def add_websocket(self, websocket: WebSocket):
        async with self.lock:
            self.websockets.append(websocket)

    async def remove_websocket(self, websocket: WebSocket):
        async with self.lock:
            if websocket in self.websockets:
                self.websockets.remove(websocket)

conversations: Dict[str, Conversation] = {}

def get_or_create_conversation(conversation_id: str) -> Conversation:
    if conversation_id not in conversations:
        conversations[conversation_id] = Conversation()
    return conversations[conversation_id]

@app.websocket("/ws/{conversation_id}")
async def websocket_chat(websocket: WebSocket, conversation_id: str):
    await websocket.accept()
    conversation = get_or_create_conversation(conversation_id)
    
    if not conversation.active:
        await websocket.close(code=4000)
        return
    
    await conversation.add_websocket(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            user_message = data.get("message")
            
            if not user_message:
                await websocket.send_json({"error": "Message is required"})
                continue
            
            conversation.messages.append({"role": "user", "content": user_message})
            
            stream = client.chat.completions.create(
                model="mixtral-8x7b-32768",
                messages=conversation.messages,
                temperature=1,
                max_tokens=1024,
                top_p=1,
                stream=True,
                stop=None,
            )
            
            response_content = ""
            
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    response_content += delta
                    await websocket.send_text(delta)
            
            conversation.messages.append({"role": "assistant", "content": response_content})
            
    except Exception as e:
        await websocket.send_json({"error": str(e)})
    finally:
        await conversation.remove_websocket(websocket)
        await websocket.close()

@app.get("/conversations/{conversation_id}", response_model=List[Dict[str, str]])
async def get_conversation(conversation_id: str):
    conversation = conversations.get(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation.messages

@app.delete("/conversations/{conversation_id}")
async def close_conversation(conversation_id: str):
    conversation = conversations.get(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation.active = False
    
    async with conversation.lock:
        for ws in conversation.websockets:
            await ws.close(code=4000)
        conversation.websockets.clear()
    
    return {"message": "Conversation closed successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
