from groq import Groq
from core.config import settings
from sqlalchemy.orm import Session
from datetime import datetime
from models.models import Message, Session as DBSession

client = Groq(api_key=settings.GROQ_API_KEY)

async def generate_response(messages_history):
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
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            response_content += delta
            yield delta
    # Remove the return statement from here

async def generate_session_title(session_id: int, user_id: int, db: Session):
    session = db.query(DBSession).filter(
        DBSession.id == session_id,
        DBSession.user_id == user_id
    ).first()
    
    if not session:
        return
    
    messages = db.query(Message).filter(
        Message.session_id == session_id,
        Message.user_id == user_id
    ).order_by(Message.timestamp).all()
    
    if not messages:
        return
    
    conversation = "\n".join([msg.content for msg in messages[-5:]])
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
    session.title = title
    db.commit()