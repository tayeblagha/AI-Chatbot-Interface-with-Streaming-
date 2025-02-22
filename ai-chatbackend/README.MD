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


#Run Application   uvicorn main:app --reload 