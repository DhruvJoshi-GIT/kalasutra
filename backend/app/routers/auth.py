from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.auth import otp
from app.auth.deps import DB, CurrentUser
from app.auth.jwt import create_token
from app.auth.passwords import hash_password, verify_password
from app.config import settings
from app.models.artisan import ArtisanProfile
from app.models.user import Role, User
from app.schemas.auth import LoginIn, MeUpdate, OtpRequestIn, OtpVerifyIn, RegisterIn, TokenOut, UserOut

router = APIRouter(tags=["auth"])


def user_out(db, u: User) -> UserOut:
    prof = db.scalar(select(ArtisanProfile.slug).where(ArtisanProfile.user_id == u.id))
    return UserOut(id=u.id, name=u.name, email=u.email, phone=u.phone, role=u.role.value,
                   preferred_language=u.preferred_language, artisan_slug=prof)


def token_for(db, u: User, needs_profile: bool = False) -> TokenOut:
    return TokenOut(token=create_token(u.id, u.role.value), user=user_out(db, u), needs_profile=needs_profile)


@router.post("/auth/register", status_code=201)
def register(db: DB, body: RegisterIn):
    if db.scalar(select(User).where(User.email == body.email.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    if body.phone and db.scalar(select(User).where(User.phone == body.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "This phone number is already registered")
    u = User(email=body.email.lower(), name=body.name, phone=body.phone,
             password_hash=hash_password(body.password), role=Role.USER)
    db.add(u); db.commit(); db.refresh(u)
    return {"data": token_for(db, u)}


@router.post("/auth/login")
def login(db: DB, body: LoginIn):
    u = db.scalar(select(User).where(User.email == body.email.lower()))
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    return {"data": token_for(db, u)}


@router.post("/auth/otp/request")
def otp_request(db: DB, body: OtpRequestIn):
    code = otp.create_challenge(db, body.phone)
    out = {"sent": True, "expiresIn": 300}
    if code and settings.otp_dev_mode:
        out["devCode"] = code
    return {"data": out}


@router.post("/auth/otp/verify")
def otp_verify(db: DB, body: OtpVerifyIn):
    if not otp.verify_challenge(db, body.phone, body.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong or expired code")
    u = db.scalar(select(User).where(User.phone == body.phone))
    if not u:
        u = User(phone=body.phone, role=Role.USER)
        db.add(u); db.commit(); db.refresh(u)
    has_profile = db.scalar(select(ArtisanProfile.id).where(ArtisanProfile.user_id == u.id)) is not None
    return {"data": token_for(db, u, needs_profile=not has_profile)}


@router.get("/me")
def me(db: DB, user: CurrentUser):
    return {"data": user_out(db, user)}


@router.patch("/me")
def update_me(db: DB, user: CurrentUser, body: MeUpdate):
    if body.email and body.email.lower() != user.email:
        if db.scalar(select(User).where(User.email == body.email.lower(), User.id != user.id)):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")
        user.email = body.email.lower()
    if body.phone and body.phone != user.phone:
        if db.scalar(select(User).where(User.phone == body.phone, User.id != user.id)):
            raise HTTPException(status.HTTP_409_CONFLICT, "Phone already in use")
        user.phone = body.phone
    if body.name is not None:
        user.name = body.name
    if body.preferred_language:
        user.preferred_language = body.preferred_language
    db.commit(); db.refresh(user)
    return {"data": user_out(db, user)}
