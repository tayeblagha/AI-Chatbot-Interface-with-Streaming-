# AI Chatbot Application

This project is a real-time AI chatbot application built with Next.js (React) for the frontend and FastAPI for the backend. The chatbot utilizes WebSockets for live conversation handling and integrates with Groq for AI-powered responses.

## Features
- Real-time AI-powered chat using WebSockets
- FastAPI backend with Groq API integration
- Next.js frontend for seamless UI/UX
- Message streaming for better user experience
- Conversation management and closing functionality

## Technologies Used
### Frontend
- Next.js (React)
- WebSockets
- Tailwind & ShadCN CSS

### Backend
```
ai-chatbot/
├── app/
│   ├── core/
│   │   ├── config.py
│   │   └── database.py
│   ├── models/
│   │   └── models.py
│   ├── schemas/
│   │   └── schemas.py
│   ├── routes/
│   │   ├── auth.py
│   │   └── chat.py
│   ├── dependencies/
│   │   └── dependencies.py
│   ├── services/
│   │   ├── security.py
│   │   └── groq_service.py
│   └── main.py
├── .env
└── requirements.txt
```

- FastAPI
- Groq API
- WebSockets
- Pydantic (for data validation)
- CORS Middleware
- Uvicorn (for running the FastAPI server)

## Setup and Installation

### Prerequisites
Ensure you have the following installed:
- Node.js and npm
- Python 3.8+
- Virtual environment tool (optional but recommended)

### Backend Setup
1. Clone the repository:
   ```sh
   git clone https://github.com/tayeblagha/AI-Chatbot-Interface-with-Streaming-.git
   cd ai-chatbackend
   ```
2. Create a virtual environment and activate it:
   ```sh
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
4. Create a `.env` file and set your Groq API key:
   ```sh
   GROQ_API_KEY=your_groq_api_key_here
   AI_DB_USERNAME=postgres  (put your username instead)
   AI_DB_PASSWORD=root  (put your passwordinstead)
   AI_DB_DATABASE=aichatbot  (put your Database name instead)

   ```
5. Run the FastAPI server:
   ```sh
   uvicorn main:app --reload
   ```
   The backend should now be running at `http://127.0.0.1:8000`

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```sh
   cd ai-chat(frontend)
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Set environment variables in `.env.local`:
   ```sh
   NEXT_PUBLIC_WSHOST=ws://localhost:8000
   NEXT_PUBLIC_HOST=http://localhost:8000
   ```
4. Start the Next.js development server:
   ```sh
   npm run dev
   ```
   The frontend should now be available at `http://localhost:3000`

## Usage
1. Open the frontend in your browser.
2. Enter a unique conversation ID and click **Connect**.
3. Type a message and send it to the AI assistant.
4. The chatbot responds in real-time.
5. Click **Close Conversation** when finished.

## API Endpoints
- `GET /conversations/{conversation_id}` - Retrieve chat history.
- `DELETE /conversations/{conversation_id}` - Close a conversation.
- `WS /ws/{conversation_id}` - Establish a WebSocket connection for chat.



## License
This project is licensed under the MIT License.

## Author
Tayeb Lagha - [GitHub Profile](https://github.com/tayeblagha)

## Acknowledgments
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs/)
- [Groq API](https://groq.com/)

