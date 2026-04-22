from pathlib import Path
from pydantic_settings import BaseSettings

BACKEND_DIR = Path(__file__).resolve().parents[1]

class Settings(BaseSettings):
    # API Configuration
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = "deepseek-chat"
    LLM_FALLBACK_ENABLED: bool = True
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    LLM_MODEL: str = ""

    # Database & Persistence
    PERSISTENCE_DIR: Path = BACKEND_DIR / "data" / "persistence"
    DATABASE_URL: str = "" # Set this in Render env for Supabase
    AUTH_DB_PATH: Path = PERSISTENCE_DIR / "auth.db"

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgres://") or self.DATABASE_URL.startswith("postgresql://")

    @property
    def db_url(self) -> str:
        # If no DATABASE_URL is provided, fallback to local SQLite
        if not self.DATABASE_URL:
            return f"sqlite:///{(self.PERSISTENCE_DIR / 'auth.db').as_posix()}"
        
        # Fix: Render and Supabase often provide postgres:// which SQLAlchemy/psycopg2 
        # sometimes needs as postgresql://. Also ensure special characters in passwords are encoded.
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
            
        # Sanitize credentials for psycopg2 (handles passwords with symbols like %)
        # and strip incompatible query parameters like pgbouncer
        if url.startswith("postgresql://"):
            from urllib.parse import urlparse, urlunparse, quote, unquote, parse_qs, urlencode
            try:
                parsed = urlparse(url)
                
                # 1. Sanitize credentials
                new_netloc = parsed.netloc
                if parsed.username or parsed.password:
                    username = quote(unquote(parsed.username)) if parsed.username else ""
                    password = quote(unquote(parsed.password)) if parsed.password else ""
                    new_netloc = f"{username}:{password}@{parsed.hostname}"
                    if parsed.port:
                        new_netloc += f":{parsed.port}"
                
                # 2. Strip incompatible query parameters (pgbouncer)
                query_params = parse_qs(parsed.query)
                if 'pgbouncer' in query_params:
                    del query_params['pgbouncer']
                
                new_query = urlencode(query_params, doseq=True)
                
                # 3. Reconstruct
                url = urlunparse(parsed._replace(netloc=new_netloc, query=new_query))
            except Exception:
                pass
                
        return url

    # Authentication
    AUTH_SECRET_KEY: str = "change-this-auth-secret"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 168
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Admin Credentials
    ADMIN_USERNAME: str = "broxstudiesadmin"
    ADMIN_PASSWORD: str = "bs-admin-2026"
    ADMIN_SECRET: str = "change-this-admin-secret"
    SUBSCRIPTION_PRICE_GHS: str = "20"
    SUBSCRIPTION_MONTHS: int = 3

    # CORS
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000"]

    # PDF Processing
    PDF_UPLOAD_DIR: Path = BACKEND_DIR / "uploads" / "pdfs"
    DATA_DIR: Path = BACKEND_DIR / "data"
    SITE_RESOURCE_DIR: Path = DATA_DIR / "site_resources"
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    # Vector Store
    VECTOR_STORE_DIR: Path = BACKEND_DIR / "vector_store"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Question Generation
    MAX_QUESTIONS: int = 10
    MIN_CONFIDENCE_SCORE: float = 0.7

    # Auto-loading
    AUTO_LOAD_ON_STARTUP: bool = True
    LAZY_LOAD: bool = True
    SELECTIVE_LOAD: bool = True
    LOAD_SYLLABI_ONLY: bool = False
    MAX_INITIAL_SUBJECTS: int = 5

    @property
    def resolved_llm_api_key(self) -> str:
        return self.LLM_API_KEY or self.OPENAI_API_KEY or self.DEEPSEEK_API_KEY

    @property
    def resolved_llm_model(self) -> str:
        if self.LLM_MODEL:
            return self.LLM_MODEL
        if self.OPENAI_API_KEY:
            return self.OPENAI_MODEL
        if self.DEEPSEEK_API_KEY:
            return self.DEEPSEEK_MODEL
        return self.OPENAI_MODEL

    @property
    def resolved_llm_base_url(self) -> str | None:
        if self.LLM_BASE_URL:
            return self.LLM_BASE_URL
        if self.OPENAI_BASE_URL:
            return self.OPENAI_BASE_URL
        if self.DEEPSEEK_API_KEY and not self.OPENAI_API_KEY:
            return "https://api.deepseek.com"
        return None

    class Config:
        env_file = BACKEND_DIR / ".env"
        case_sensitive = True

settings = Settings()

# Ensure directories exist
settings.PDF_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
settings.SITE_RESOURCE_DIR.mkdir(parents=True, exist_ok=True)
settings.PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
