import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "KA-CHOW"
    VERSION: str = "2.0.0"
    
    # AI
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY")
    
    # SonarQube / SonarCloud (Defaults to localhost for demo)
    SONAR_URL: str = os.getenv("SONAR_URL", "http://localhost:9000")
    SONAR_TOKEN: str = os.getenv("SONAR_TOKEN", "")
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    REPO_STORAGE_PATH: str = os.path.join(BASE_DIR, "storage", "repos")
    VECTOR_DB_PATH: str = os.path.join(BASE_DIR, "storage", "chromadb")

settings = Settings()

# Ensure storage exists
os.makedirs(settings.REPO_STORAGE_PATH, exist_ok=True)
os.makedirs(settings.VECTOR_DB_PATH, exist_ok=True)