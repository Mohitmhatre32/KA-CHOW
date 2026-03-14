import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "KA-CHOW"
    VERSION: str = "2.0.0"
    
    # AI
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    REPO_STORAGE_PATH: str = os.path.join(BASE_DIR, "storage", "repos")
    VECTOR_DB_PATH: str = os.path.join(BASE_DIR, "storage", "chromadb")

    # Librarian Pipeline Tuning
    CHUNK_TOKEN_LIMIT: int = 400
    SUPPORTED_EXTENSIONS: set = {
        ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", 
        ".rb", ".cpp", ".c", ".html", ".css", ".json", 
        ".md", ".yaml", ".yml", ".toml", ".txt"
    }
    SKIP_DIRS: set = {
        ".git", "node_modules", "venv", ".venv", "env", "__pycache__", 
        "dist", "build", ".idea", ".vscode", "target", "out", "coverage"
    }

settings = Settings()

os.makedirs(settings.REPO_STORAGE_PATH, exist_ok=True)
os.makedirs(settings.VECTOR_DB_PATH, exist_ok=True)