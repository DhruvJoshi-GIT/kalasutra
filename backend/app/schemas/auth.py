from __future__ import annotations

from pydantic import EmailStr, Field, field_validator

from app.schemas import CamelModel


def normalise_phone(v: str) -> str:
    digits = "".join(ch for ch in v if ch.isdigit())
    if len(digits) == 10:
        digits = "91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    raise ValueError("Enter a 10-digit Indian mobile number")


class RegisterIn(CamelModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str | None = Field(default=None, max_length=120)
    phone: str | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return normalise_phone(v) if v else None


class LoginIn(CamelModel):
    email: EmailStr
    password: str


class OtpRequestIn(CamelModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalise_phone(v)


class OtpVerifyIn(OtpRequestIn):
    code: str = Field(min_length=4, max_length=8)


class UserOut(CamelModel):
    id: int
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    role: str
    preferred_language: str = "en-IN"
    artisan_slug: str | None = None


class TokenOut(CamelModel):
    token: str
    user: UserOut
    needs_profile: bool = False


class MeUpdate(CamelModel):
    name: str | None = Field(default=None, max_length=120)
    phone: str | None = None
    email: EmailStr | None = None
    preferred_language: str | None = Field(default=None, max_length=10)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return normalise_phone(v) if v else None
