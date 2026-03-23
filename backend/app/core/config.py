import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "KA-CHOW"
    VERSION: str = "2.0.0"

    # AI
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")

    # Jira Integration
    JIRA_URL: str = os.getenv("JIRA_URL", "")
    JIRA_EMAIL: str = os.getenv("JIRA_EMAIL", "")
    JIRA_API_TOKEN: str = os.getenv("JIRA_API_TOKEN", "")
 
    # SonarQube Integration
    SONAR_URL: str = os.getenv("SONAR_URL", "http://localhost:9000")
    SONAR_TOKEN: str = os.getenv("SONAR_TOKEN", "")

    # Server
    APP_HOST: str = os.getenv("APP_HOST", "127.0.0.1")
    APP_PORT: int = int(os.getenv("APP_PORT", 8000))
    APP_ENV: str = os.getenv("APP_ENV", "development")

    # Paths — derived from the rebackend/ directory, no Docker paths needed
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