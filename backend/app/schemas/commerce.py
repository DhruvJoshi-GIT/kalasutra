from __future__ import annotations

import re

from pydantic import Field, field_validator, model_validator

from app.schemas import CamelModel


# ── cart / wishlist ──────────────────────────────────────────────────
class CartLine(CamelModel):
    id: int
    qty: int = Field(ge=1, le=50)


class CartPut(CamelModel):
    items: list[CartLine] = Field(default_factory=list)


class WishlistMerge(CamelModel):
    product_ids: list[int] = Field(default_factory=list)


# ── addresses (accepts the prototype's form field names) ─────────────
class AddressIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    line: str = Field(min_length=1, max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    pin: str = Field(pattern=r"^\d{6}$")
    is_default: bool = False


class AddressOut(CamelModel):
    id: int
    name: str
    phone: str
    line: str
    line2: str | None = None
    city: str
    state: str
    pin: str
    is_default: bool = False


# ── payment methods (label only is stored) ───────────────────────────
class PaymentIn(CamelModel):
    type: str = Field(pattern=r"^(upi|card)$")
    upi: str | None = None
    card: str | None = None
    cname: str | None = None

    @model_validator(mode="after")
    def _check(self):
        if self.type == "upi":
            if not self.upi or not re.fullmatch(r"[\w.\-]+@\w+", self.upi.strip()):
                raise ValueError("Enter a valid UPI id like name@upi")
        else:
            digits = re.sub(r"\D", "", self.card or "")
            if not 12 <= len(digits) <= 19:
                raise ValueError("Enter a valid card number")
        return self

    def label(self) -> str:
        if self.type == "upi":
            return self.upi.strip()
        digits = re.sub(r"\D", "", self.card or "")
        return f"•••• {digits[-4:]}" + (f" · {self.cname.strip()}" if self.cname else "")


class PaymentOut(CamelModel):
    id: int
    type: str  # 'upi' | 'card' (lowercase, as the prototype expects)
    label: str
    is_default: bool = False


# ── orders ───────────────────────────────────────────────────────────
class OrderCreate(CamelModel):
    address_id: int
    payment_method_id: int
    items: list[CartLine] = Field(min_length=1)


class OrderLineOut(CamelModel):
    id: int | None  # product id
    n: str
    qty: int
    price: float
    total: float


class OrderAddrOut(CamelModel):
    name: str
    phone: str
    line: str
    city: str
    state: str
    pin: str


class OrderPayOut(CamelModel):
    type: str
    label: str


class OrderOut(CamelModel):
    id: int
    no: str
    date: str
    status: str
    payment_status: str
    items: list[OrderLineOut]
    sub: float
    ship: float
    total: float
    addr: OrderAddrOut
    pay: OrderPayOut
    tracking_number: str | None = None


# ── reviews / comments ───────────────────────────────────────────────
class ReviewIn(CamelModel):
    stars: int = Field(ge=1, le=5)
    text: str = Field(min_length=1, max_length=2000)
    name: str | None = Field(default=None, max_length=120)


class CommentIn(CamelModel):
    text: str = Field(min_length=1, max_length=2000)
    name: str | None = Field(default=None, max_length=120)


class AnswerIn(CamelModel):
    text: str = Field(min_length=1, max_length=2000)


# ── enquiries ────────────────────────────────────────────────────────
class EnquiryIn(CamelModel):
    product_id: int
    quantity: int = Field(ge=1, le=100000)
    target_price: float | None = Field(default=None, ge=0)
    message: str | None = Field(default=None, max_length=2000)


class EnquiryUpdate(CamelModel):
    status: str = Field(pattern=r"^(OPEN|QUOTED|ACCEPTED|DECLINED|CLOSED)$")
    quoted_price: float | None = Field(default=None, ge=0)


class EnquiryOut(CamelModel):
    id: int
    product_id: int
    product_name: str
    maker: str
    buyer: str
    quantity: int
    target_price: float | None = None
    quoted_price: float | None = None
    message: str | None = None
    status: str
    date: str
