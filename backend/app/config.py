from pathlib import Path

from pydantic_settings import BaseSettings


BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    # API Configuration
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = ""
    OPENAI_MODEL: str = "gpt-3.5-turbo"  # Use gpt-3.5-turbo, gpt-4, or gpt-4o (gpt-4-turbo-preview is deprecated)
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = "deepseek-chat"
    LLM_FALLBACK_ENABLED: bool = True
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    LLM_MODEL: str = ""

    # Database
    DATABASE_URL: str = f"sqlite:///{(BACKEND_DIR / 'gh_shs.db').as_posix()}"

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
    LAZY_LOAD: bool = True  # Only load syllabi on startup, rest on-demand
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

settings.PDF_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
settings.SITE_RESOURCE_DIR.mkdir(parents=True, exist_ok=True)
