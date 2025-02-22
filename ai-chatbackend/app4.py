import os
import asyncio
import jwt
from datetime import datetime, timedelta
from typing import List, Dict
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from groq import Groq
from sqlalchemy import desc  # Import desc from sqlalchemy


# Load environment variables
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing")

ai_db_username = os.getenv("AI_DB_USERNAME")
ai_db_password = os.getenv("AI_DB_PASSWORD")
#ai_db_name = os.getenv("testdb1")

# Database configuration
DATABASE_URL = f"postgresql://{ai_db_username}:{ai_db_password}@localhost/testdb1"
engine = create_engine(DATABASE_URL)

# Check database connection
try:
    with engine.connect() as connection:
        print("✅ Database connection successful!")
except Exception as e:
    print(f"❌ Database connection failed: {e}")

# Dependency to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = "aichatbot"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

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

# Database Models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    sessions = relationship("Session", back_populates="user")

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_number = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session")
    title = Column(String, nullable=True)  # Add title column


    __table_args__ = (
        UniqueConstraint('user_id', 'session_number', name='uix_user_session'),
    )

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))  # Added user_id

    role = Column(String)
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    session = relationship("Session", back_populates="messages")
    user = relationship("User")  # Establish relationship with User model


Base.metadata.create_all(bind=engine)

# Pydantic Models
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

# Utility Functions
def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Query(...), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# Routes
@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    hashed_password = pwd_context.hash(user.password)
    new_user = User(username=user.username, email=user.email, password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not pwd_context.verify(user.password, db_user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    access_token = create_access_token(
        {"sub": db_user.username},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/create-session")
def create_new_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    max_session = db.query(func.max(Session.session_number))\
                   .filter(Session.user_id == current_user.id)\
                   .scalar()
    new_session_number = (max_session or 0) + 1
    
    new_session = Session(
        user_id=current_user.id,
        session_number=new_session_number
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return {
        "session_id": f"{current_user.id}_session_{new_session_number}",
        "session_number": new_session_number
    }

@app.websocket("/ws/{session_number}")
async def websocket_chat(
    websocket: WebSocket,
    session_number: int,
    token: str = Query(...),
):
    await websocket.accept()
    db = SessionLocal()
    
    try:
        # Authenticate user
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        user = db.query(User).filter(User.username == username).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Get or create session
        session = db.query(Session).filter(
            Session.user_id == user.id,
            Session.session_number == session_number
        ).first()
        
        if not session:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Get existing messages
        messages = db.query(Message).filter(
            Message.session_id == session.id,
            Message.user_id == user.id  # Ensure messages belong to the current user
        ).order_by(Message.timestamp).all()
        
        messages_history = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        if not any(msg['role'] == 'system' for msg in messages_history):
            messages_history.insert(0, {"role": "system", "content": "You are a useful AI assistant."})

        while True:
            data = await websocket.receive_json()
            user_message = data.get("message")
            
            if not user_message:
                await websocket.send_json({"error": "Message is required"})
                continue

            # Save user message
            new_message = Message(
                session_id=session.id,
                role="user",
                content=user_message
            )
            db.add(new_message)
            db.commit()
            db.refresh(new_message)
            
            messages_history.append({"role": "user", "content": user_message})

            # Generate response
            stream = client.chat.completions.create(
                model="mixtral-8x7b-32768",
                messages=messages_history,
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

            # Save assistant message
            assistant_message = Message(
                session_id=session.id,
                role="assistant",
                content=response_content,
                user_id=user.id

            )
            db.add(assistant_message)
            # After saving the assistant message
            await generate_session_title(session.id,user.id, db)

            db.commit()
            messages_history.append({"role": "assistant", "content": response_content})

    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.send_json({"error": str(e)})
    finally:
        db.close()
        await websocket.close()

@app.get("/sessions/{session_number}/messages")
def get_session_messages(
    session_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(Session).filter(
        Session.user_id == current_user.id,
        Session.session_number == session_number
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    messages = db.query(Message).filter(
        Message.session_id == session.id
    ).order_by(Message.timestamp).all()
    
    return [
        {
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.timestamp
        }
        for msg in messages
    ]


@app.get("/sessions/messages")
def get_latest_sessions_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(Session).filter(Session.user_id == current_user.id).order_by(desc(Session.created_at)).limit(20).all()
    session_messages = []
    print(current_user.username)
    print(current_user.id)

    
    for session in sessions:
        messages = db.query(Message).filter(Message.session_id == session.id).order_by(Message.timestamp).all()
        session_messages.append({
            "session_number": session.session_number,
            "messages": [{
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp
            } for msg in messages],
            "title":session.title
        })
    
    return session_messages

async def generate_session_title(session_id: int, user_id: int, db: Session):
    session = db.query(Session).filter(
        Session.id == session_id,
        Session.user_id == user_id  # Ensure the session belongs to the correct user
    ).first()
    
    if not session:
        print("no seession found")
        return  # If the session doesn't exist, return early

    messages = db.query(Message).filter(
        Message.session_id == session_id
    ).order_by(Message.timestamp).all()
    
    if not messages:
        return  # If there are no messages, do not generate a title

    conversation = "\n".join([msg.content for msg in messages[-5:]])  # Use last 5 messages
    prompt = f"Create a short title (max 5 words) for this conversation. Return only the title. Conversation:\n{conversation}"
    
    response = client.chat.completions.create(
        model="mixtral-8x7b-32768",
        messages=[{"role": "system", "content": prompt}],
        temperature=0.7,
        max_tokens=10,
        top_p=1,
        stop=None,
    )
    
    title = response.choices[0].message.content.strip()
    print(f"Generated title: {title}")
    
    session.title = title  # Update session title
    db.commit()



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)