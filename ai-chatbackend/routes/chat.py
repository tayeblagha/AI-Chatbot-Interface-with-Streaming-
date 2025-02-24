from fastapi import APIRouter, FastAPI, WebSocket, HTTPException, Depends, status, Query
from groq import Groq
import jwt
from sqlalchemy import desc, func
from core.config import settings
from core.database import SessionLocal
from models.models import Session , Message, User
from sqlalchemy.orm import Session as SqlalchemySession

from dependencies.dependencies import get_db, get_current_user,get_current_websocket_user
from services.groq_service import generate_response, generate_session_title
from core.config import settings


router = APIRouter()
client = Groq(api_key=settings.GROQ_API_KEY)
@router.post("/create-session")
def create_new_session(
    db: SqlalchemySession = Depends(get_db),
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


@router.websocket("/ws/{session_number}")
async def websocket_chat(
    websocket: WebSocket,
    session_number: int,
    user: User = Depends(get_current_websocket_user)
):
    await websocket.accept()
    db = SessionLocal()
    
    try:

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

        # Get existing messages (already includes user_id filter)
        messages = db.query(Message).filter(
            Message.session_id == session.id,
            Message.user_id == user.id
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

            # Save user message (fixed to include user_id)
            new_message = Message(
                session_id=session.id,
                role="user",
                content=user_message,
                user_id=user.id  # Added user_id
            )
            db.add(new_message)
            db.commit()
            db.refresh(new_message)
            
            messages_history.append({"role": "user", "content": user_message})

            # Generate response (unchanged)
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

            # Save assistant message (already includes user_id)
            assistant_message = Message(
                session_id=session.id,
                role="assistant",
                content=response_content,
                user_id=user.id
            )
            db.add(assistant_message)
            await generate_session_title(session.id, user.id, db)
            db.commit()
            messages_history.append({"role": "assistant", "content": response_content})

    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.send_json({"error": str(e)})
    finally:
        db.close()
        await websocket.close()

@router.get("/sessions/{session_number}/messages")
def get_session_messages(
    session_number: int,
    db: SqlalchemySession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(Session).filter(
        Session.user_id == current_user.id,
        Session.session_number == session_number
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Added user_id filter to messages query
    messages = db.query(Message).filter(
        Message.session_id == session.id,
        Message.user_id == current_user.id
    ).order_by(Message.timestamp).all()
    
    return [
        {
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.timestamp
        }
        for msg in messages
    ]

@router.get("/sessions/messages")
def get_latest_sessions_messages(
    db: SqlalchemySession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(Session).filter(Session.user_id == current_user.id).order_by(desc(Session.created_at)).limit(20).all()
    session_messages = []
    
    for session in sessions:
        # Added user_id filter to messages query
        messages = db.query(Message).filter(
            Message.session_id == session.id,
            Message.user_id == current_user.id
        ).order_by(Message.timestamp).all()
        session_messages.append({
            "session_number": session.session_number,
            "messages": [{
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp
            } for msg in messages],
            "title": session.title
        })
    
    return session_messages