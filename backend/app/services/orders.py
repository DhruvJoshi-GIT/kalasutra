"""Order placement and serialisation."""
from __future__ import annotations

import time
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.catalogue import Product
from app.models.commerce import Cart, Order, OrderItem, OrderStatus, PaymentStatus
from app.models.user import Address, PaymentMethod, User
from app.schemas.commerce import CartLine, OrderAddrOut, OrderLineOut, OrderOut, OrderPayOut

FREE_SHIPPING_FROM = Decimal("999")
SHIPPING_FEE = Decimal("79")


def shipping_for(subtotal: Decimal) -> Decimal:
    if subtotal <= 0:
        return Decimal("0")
    return Decimal("0") if subtotal >= FREE_SHIPPING_FROM else SHIPPING_FEE


def _base36(n: int) -> str:
    digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    return out or "0"


def new_order_number() -> str:
    return "KS" + _base36(int(time.time() * 1000))


def place_order(db: Session, user: User, address_id: int, payment_method_id: int, lines: list[CartLine]) -> Order:
    addr = db.get(Address, address_id)
    if not addr or addr.user_id != user.id:
        raise HTTPException(400, "Choose a delivery address")
    pay = db.get(PaymentMethod, payment_method_id)
    if not pay or pay.user_id != user.id:
        raise HTTPException(400, "Choose a payment method")

    ids = [l.id for l in lines]
    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(ids), Product.is_active.is_(True))).all()}
    missing = [i for i in ids if i not in products]
    if missing:
        raise HTTPException(400, f"Some items are no longer available: {missing}")

    items: list[OrderItem] = []
    subtotal = Decimal("0")
    for l in lines:
        p = products[l.id]
        line_total = p.price * l.qty
        subtotal += line_total
        items.append(OrderItem(product_id=p.id, artisan_id=p.artisan_id, name=p.name, sku=p.sku,
                               price=p.price, quantity=l.qty, total=line_total))
    ship = shipping_for(subtotal)
    order = Order(
        order_number=new_order_number(), user_id=user.id, address_id=addr.id,
        address_snapshot={"name": addr.name, "phone": addr.phone, "line": addr.line1, "line2": addr.line2,
                          "city": addr.city, "state": addr.state, "pin": addr.postal_code},
        status=OrderStatus.PENDING, payment_status=PaymentStatus.PAID,  # simulated payment
        payment_method=pay.label, payment_type=pay.type.value.lower(),
        subtotal=subtotal, shipping=ship, total=subtotal + ship, items=items,
    )
    db.add(order)
    cart = db.scalar(select(Cart).where(Cart.user_id == user.id))
    if cart:
        cart.items.clear()
    db.commit()
    db.refresh(order)
    return order


def order_out(o: Order, only_artisan: int | None = None) -> OrderOut:
    items = [i for i in o.items if only_artisan is None or i.artisan_id == only_artisan]
    sub = sum((i.total for i in items), Decimal("0"))
    ship = o.shipping if only_artisan is None else Decimal("0")
    a = o.address_snapshot
    return OrderOut(
        id=o.id, no=o.order_number, date=o.created_at.isoformat(), status=o.status.value,
        payment_status=o.payment_status.value,
        items=[OrderLineOut(id=i.product_id, n=i.name, qty=i.quantity, price=float(i.price), total=float(i.total)) for i in items],
        sub=float(sub), ship=float(ship), total=float(sub + ship),
        addr=OrderAddrOut(name=a["name"], phone=a["phone"], line=a["line"], city=a["city"], state=a["state"], pin=a["pin"]),
        pay=OrderPayOut(type=o.payment_type or "upi", label=o.payment_method or ""),
        tracking_number=o.tracking_number,
    )


def load_orders_query():
    return select(Order).options(selectinload(Order.items))
