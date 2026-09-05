from __future__ import annotations

import datetime as dt

import jwt
from fastapi import HTTPException, status

from app.config import settings

ALG = "HS256"


def create_token(user_id: int, role: str) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(days=settings.jwt_days)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALG)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALG])
    except jwt.PyJWTError as exc:  # expired, malformed, bad signature
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in again") from exc
