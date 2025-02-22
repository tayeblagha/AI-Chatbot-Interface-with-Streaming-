import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv


from core.config import settings
load_dotenv()
DATABASE_URL = f"postgresql://{settings.AI_DB_USERNAME}:{settings.AI_DB_PASSWORD}@localhost/{os.getenv('AI_DB_DATABASE')}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()