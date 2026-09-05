"""Application settings, read from the environment / backend/.env."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    # core
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/kalasutra"
    jwt_secret: str = "dev-only-secret-change-me-on-heroku-0123456789abcdef"
    jwt_days: int = 30
    otp_dev_mode: bool = True
    otp_dev_code: str = "123456"
    cors_origins: str = (
        "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5173,"
        "https://dhruvjoshi-git.github.io,https://kalasutra.live,https://www.kalasutra.live"
    )
    admin_key: str = ""

    # files
    storage_backend: str = "db"  # db | local | s3
    storage_dir: str = str(BACKEND_DIR / "storage")
    public_base_url: str = ""  # set on Heroku, e.g. https://api.kalasutra.live

    # static frontend for local dev (the API serves web/ at /)
    serve_web: bool = True
    web_dir: str = ""

    # AI providers: mode = fixture | record | live ("" = auto: live if key else fixture)
    ai_mode: str = "fixture"
    sarvam_api_key: str = ""
    sarvam_mode: str = ""
    anthropic_api_key: str = ""
    anthropic_mode: str = ""
    voyage_api_key: str = ""
    voyage_mode: str = ""
    fal_key: str = ""
    fal_mode: str = ""

    @property
    def sqlalchemy_url(self) -> str:
        """Heroku hands out postgres:// URLs; SQLAlchemy + psycopg 3 want postgresql+psycopg://."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def web_path(self) -> Path | None:
        """web/ once it exists, otherwise the prototype folder (handy before phase 1)."""
        if self.web_dir:
            p = Path(self.web_dir)
            return p if p.exists() else None
        for cand in (BACKEND_DIR.parent / "web", BACKEND_DIR.parent / "prototype"):
            if (cand / "index.html").exists() or (cand / "kalasutra-prototype.html").exists():
                return cand
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
