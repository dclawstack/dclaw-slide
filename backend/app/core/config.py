from functools import lru_cache

from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_name: str = "DClaw Slide"
    app_env: str = "dev"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./dclaw_slide.db"

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60

    # CORS — explicit allowed origins (env-overridable). Must not be "*" while
    # allow_credentials=True.
    cors_origins: list[str] = ["http://localhost:5173"]

    # AI provider config — see app.services.ai
    ai_provider: str = "auto"  # one of: auto, ollama, openrouter, deterministic
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.1-8b-instruct"
    ai_request_timeout: float = 30.0


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
