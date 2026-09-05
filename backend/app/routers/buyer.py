"""Buyer-side routes: cart, wishlist, addresses, payment methods, orders."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.auth.deps import DB, CurrentUser
from app.models.catalogue import Product
from app.models.commerce import Cart, CartItem, Order, WishlistItem
from app.models.user import Address, PaymentMethod, PaymentType
from app.schemas.commerce import (
    AddressIn, AddressOut, CartLine, CartPut, OrderCreate, PaymentIn, PaymentOut, WishlistMerge,
)
from app.services import orders as order_svc

router = APIRouter(tags=["buyer"])


# ── cart ─────────────────────────────────────────────────────────────
def _cart(db, user) -> Cart:
    cart = db.scalar(select(Cart).where(Cart.user_id == user.id))
    if not cart:
        cart = Cart(user_id=user.id)
        db.add(cart); db.flush()
    return cart


def _cart_out(cart: Cart):
    return {"items": [{"id": i.product_id, "qty": i.quantity} for i in cart.items]}


def _valid_ids(db, ids: list[int]) -> set[int]:
    if not ids:
        return set()
    return set(db.scalars(select(Product.id).where(Product.id.in_(ids), Product.is_active.is_(True))).all())


@router.get("/cart")
def get_cart(db: DB, user: CurrentUser):
    return {"data": _cart_out(_cart(db, user))}


@router.put("/cart")
def put_cart(db: DB, user: CurrentUser, body: CartPut):
    cart = _cart(db, user)
    ok = _valid_ids(db, [l.id for l in body.items])
    cart.items.clear(); db.flush()
    for l in body.items:
        if l.id in ok:
            cart.items.append(CartItem(product_id=l.id, quantity=l.qty))
    db.commit(); db.refresh(cart)
    return {"data": _cart_out(cart)}


@router.post("/cart/merge")
def merge_cart(db: DB, user: CurrentUser, body: CartPut):
    """Guest cart ∪ server cart, quantity = max of the two."""
    cart = _cart(db, user)
    ok = _valid_ids(db, [l.id for l in body.items])
    have = {i.product_id: i for i in cart.items}
    for l in body.items:
        if l.id not in ok:
            continue
        if l.id in have:
            have[l.id].quantity = max(have[l.id].quantity, l.qty)
        else:
            cart.items.append(CartItem(product_id=l.id, quantity=l.qty))
    db.commit(); db.refresh(cart)
    return {"data": _cart_out(cart)}


@router.delete("/cart")
def clear_cart(db: DB, user: CurrentUser):
    cart = _cart(db, user)
    cart.items.clear(); db.commit()
    return {"data": {"items": []}}


# ── wishlist ─────────────────────────────────────────────────────────
def _wish_ids(db, user) -> list[int]:
    return list(db.scalars(select(WishlistItem.product_id).where(WishlistItem.user_id == user.id).order_by(WishlistItem.id)).all())


@router.get("/wishlist")
def get_wishlist(db: DB, user: CurrentUser):
    return {"data": _wish_ids(db, user)}


@router.post("/wishlist/merge")
def merge_wish(db: DB, user: CurrentUser, body: WishlistMerge):
    have = set(_wish_ids(db, user))
    for pid in _valid_ids(db, body.product_ids):
        if pid not in have:
            db.add(WishlistItem(user_id=user.id, product_id=pid))
    db.commit()
    return {"data": _wish_ids(db, user)}


@router.post("/wishlist/{product_id}", status_code=201)
def add_wish(db: DB, user: CurrentUser, product_id: int):
    if product_id not in _valid_ids(db, [product_id]):
        raise HTTPException(404, "Product not found")
    if product_id not in _wish_ids(db, user):
        db.add(WishlistItem(user_id=user.id, product_id=product_id)); db.commit()
    return {"data": _wish_ids(db, user)}


@router.delete("/wishlist/{product_id}")
def remove_wish(db: DB, user: CurrentUser, product_id: int):
    row = db.scalar(select(WishlistItem).where(WishlistItem.user_id == user.id, WishlistItem.product_id == product_id))
    if row:
        db.delete(row); db.commit()
    return {"data": _wish_ids(db, user)}


# ── addresses ────────────────────────────────────────────────────────
def _addr_out(a: Address) -> AddressOut:
    return AddressOut(id=a.id, name=a.name, phone=a.phone, line=a.line1, line2=a.line2, city=a.city,
                      state=a.state, pin=a.postal_code, is_default=a.is_default)


@router.get("/addresses")
def list_addresses(db: DB, user: CurrentUser):
    rows = db.scalars(select(Address).where(Address.user_id == user.id).order_by(Address.id)).all()
    return {"data": [_addr_out(a) for a in rows]}


@router.post("/addresses", status_code=201)
def add_address(db: DB, user: CurrentUser, body: AddressIn):
    first = db.scalar(select(Address.id).where(Address.user_id == user.id)) is None
    a = Address(user_id=user.id, name=body.name, phone=body.phone, line1=body.line, line2=body.line2,
                city=body.city, state=body.state, postal_code=body.pin, is_default=body.is_default or first)
    db.add(a)
    if not user.name:
        user.name, user.phone = body.name, user.phone or body.phone
    db.commit(); db.refresh(a)
    return {"data": _addr_out(a)}


@router.delete("/addresses/{address_id}")
def delete_address(db: DB, user: CurrentUser, address_id: int):
    a = db.get(Address, address_id)
    if not a or a.user_id != user.id:
        raise HTTPException(404, "Address not found")
    db.delete(a); db.commit()
    return {"data": {"deleted": address_id}}


# ── payment methods ──────────────────────────────────────────────────
def _pay_out(p: PaymentMethod) -> PaymentOut:
    return PaymentOut(id=p.id, type=p.type.value.lower(), label=p.label, is_default=p.is_default)


@router.get("/payment-methods")
def list_payments(db: DB, user: CurrentUser):
    rows = db.scalars(select(PaymentMethod).where(PaymentMethod.user_id == user.id).order_by(PaymentMethod.id)).all()
    return {"data": [_pay_out(p) for p in rows]}


@router.post("/payment-methods", status_code=201)
def add_payment(db: DB, user: CurrentUser, body: PaymentIn):
    first = db.scalar(select(PaymentMethod.id).where(PaymentMethod.user_id == user.id)) is None
    p = PaymentMethod(user_id=user.id, type=PaymentType.UPI if body.type == "upi" else PaymentType.CARD,
                      label=body.label(), is_default=first)
    db.add(p); db.commit(); db.refresh(p)
    return {"data": _pay_out(p)}


@router.delete("/payment-methods/{pm_id}")
def delete_payment(db: DB, user: CurrentUser, pm_id: int):
    p = db.get(PaymentMethod, pm_id)
    if not p or p.user_id != user.id:
        raise HTTPException(404, "Payment method not found")
    db.delete(p); db.commit()
    return {"data": {"deleted": pm_id}}


# ── orders ───────────────────────────────────────────────────────────
@router.post("/orders", status_code=201)
def create_order(db: DB, user: CurrentUser, body: OrderCreate):
    order = order_svc.place_order(db, user, body.address_id, body.payment_method_id, body.items)
    return {"data": order_svc.order_out(order)}


@router.get("/orders")
def list_orders(db: DB, user: CurrentUser):
    rows = db.scalars(order_svc.load_orders_query().where(Order.user_id == user.id).order_by(Order.id.desc())).all()
    return {"data": [order_svc.order_out(o) for o in rows]}


@router.get("/orders/{order_number}")
def get_order(db: DB, user: CurrentUser, order_number: str):
    o = db.scalar(order_svc.load_orders_query().where(Order.order_number == order_number, Order.user_id == user.id))
    if not o:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return {"data": order_svc.order_out(o)}
