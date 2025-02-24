from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from core.config import settings

DATABASE_URL = f"postgresql://{settings.AI_DB_USERNAME}:{settings.AI_DB_PASSWORD}@localhost/{settings.AI_DB_DATABASE}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()