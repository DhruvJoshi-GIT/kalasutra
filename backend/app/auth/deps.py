from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.jwt import decode_token
from app.db import get_db
from app.models.artisan import ArtisanProfile
from app.models.user import Role, User

DB = Annotated[Session, Depends(get_db)]


def optional_user(db: DB, authorization: Annotated[str | None, Header()] = None) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    payload = decode_token(authorization.split(" ", 1)[1].strip())
    return db.get(User, int(payload["sub"]))


def require_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue")
    return user


def require_artisan(db: DB, user: Annotated[User, Depends(require_user)]) -> tuple[User, ArtisanProfile]:
    profile = db.query(ArtisanProfile).filter_by(user_id=user.id).one_or_none()
    if user.role not in (Role.ARTISAN, Role.ADMIN) or profile is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Seller account required")
    return user, profile


def require_admin(user: Annotated[User, Depends(require_user)]) -> User:
    if user.role != Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


CurrentUser = Annotated[User, Depends(require_user)]
MaybeUser = Annotated[User | None, Depends(optional_user)]
CurrentArtisan = Annotated[tuple[User, ArtisanProfile], Depends(require_artisan)]
