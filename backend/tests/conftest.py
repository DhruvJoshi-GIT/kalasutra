"""Test setup: a throwaway Postgres database (kalasutra_test), seeded once per session."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/kalasutra_test")
os.environ["AI_MODE"] = "fixture"
os.environ["SERVE_WEB"] = "0"
os.environ["OTP_DEV_MODE"] = "1"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.db import Base, engine  # noqa: E402
import app.models  # noqa: E402,F401
from app.main import create_app  # noqa: E402
from scripts import seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed.run()
    yield
    engine.dispose()


@pytest.fixture(scope="session")
def client():
    return TestClient(create_app())
