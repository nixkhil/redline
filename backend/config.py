from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Redline"
    debug: bool = False

    # CORS — comma-separated origins, * for open
    cors_origins: str = "*"

    # Database
    db_path: str = "./redline.db"

    # Rate limiting (requests per minute per IP)
    rate_limit_per_minute: int = 60

    # OpenAI
    openai_api_key: str = ""

    # Ollama default
    ollama_base_url: str = "http://localhost:11434"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
