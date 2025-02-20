import os
import asyncio
from typing import List, Dict
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, HTTPException
from pydantic import BaseModel
from groq import Groq
from fastapi.middleware.cors import CORSMiddleware
# run server:  uvicorn app:app --reload
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=GROQ_API_KEY)

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

            #token by token handaling
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