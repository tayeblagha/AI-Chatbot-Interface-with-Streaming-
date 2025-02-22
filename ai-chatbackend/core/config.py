import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY")
    AI_DB_USERNAME: str = os.getenv("AI_DB_USERNAME")
    AI_DB_PASSWORD: str = os.getenv("AI_DB_PASSWORD")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "aichatbot")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 120))

settings = Settings()