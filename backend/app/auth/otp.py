"""Phone OTP challenges. Dev mode uses a fixed code; production plugs an SMS provider in here."""
from __future__ import annotations

import datetime as dt
import hashlib
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.artisan import OtpChallenge

TTL = dt.timedelta(minutes=5)
MAX_ATTEMPTS = 5


def _hash(code: str, phone: str) -> str:
    return hashlib.sha256(f"{code}:{phone}:{settings.jwt_secret}".encode()).hexdigest()


def create_challenge(db: Session, phone: str) -> str | None:
    """Returns the code only in dev mode (so the UI can show it); otherwise it is sent by SMS."""
    code = settings.otp_dev_code if settings.otp_dev_mode else f"{secrets.randbelow(10**6):06d}"
    db.add(OtpChallenge(phone=phone, code_hash=_hash(code, phone), expires_at=dt.datetime.now(dt.timezone.utc) + TTL))
    db.commit()
    if not settings.otp_dev_mode:
        send_sms(phone, f"Your KalaSutra code is {code}. Valid for 5 minutes.")
        return None
    return code


def verify_challenge(db: Session, phone: str, code: str) -> bool:
    now = dt.datetime.now(dt.timezone.utc)
    ch = db.scalar(
        select(OtpChallenge)
        .where(OtpChallenge.phone == phone, OtpChallenge.consumed.is_(False))
        .order_by(OtpChallenge.created_at.desc())
        .limit(1)
    )
    if not ch or ch.expires_at < now or ch.attempts >= MAX_ATTEMPTS:
        return False
    ch.attempts += 1
    ok = secrets.compare_digest(ch.code_hash, _hash(code, phone))
    if ok:
        ch.consumed = True
    db.commit()
    return ok


def send_sms(phone: str, text: str) -> None:  # pragma: no cover - provider stub
    """Hook for MSG91 / Twilio. Not wired in the hackathon build."""
    print(f"[sms] to {phone}: {text}")
