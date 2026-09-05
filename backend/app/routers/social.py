"""Reviews, comments/questions, B2B enquiries."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.auth.deps import DB, CurrentArtisan, CurrentUser
from app.models.artisan import ArtisanProfile
from app.models.catalogue import Product
from app.models.social import Enquiry, EnquiryStatus, ProductComment, Review
from app.models.user import User
from app.schemas.catalogue import CommentOut, ReviewOut
from app.schemas.commerce import AnswerIn, CommentIn, EnquiryIn, EnquiryOut, EnquiryUpdate, ReviewIn

router = APIRouter(tags=["social"])


def _product(db, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if not p or not p.is_active:
        raise HTTPException(404, "Product not found")
    return p


def _who(user: User, given: str | None) -> str:
    return (given or user.name or (user.email or "").split("@")[0] or "Buyer").strip()


# ── reviews ──────────────────────────────────────────────────────────
@router.get("/products/{product_id}/reviews")
def list_reviews(db: DB, product_id: int):
    rows = db.scalars(select(Review).where(Review.product_id == product_id).order_by(Review.id.desc())).all()
    return {"data": [ReviewOut(name=r.author_name, stars=r.rating, text=r.comment, date=r.created_at.isoformat()) for r in rows]}


@router.post("/products/{product_id}/reviews", status_code=201)
def add_review(db: DB, user: CurrentUser, product_id: int, body: ReviewIn):
    _product(db, product_id)
    r = db.scalar(select(Review).where(Review.product_id == product_id, Review.user_id == user.id))
    if not r:
        r = Review(product_id=product_id, user_id=user.id)
        db.add(r)
    r.author_name, r.rating, r.comment = _who(user, body.name), body.stars, body.text
    if body.name and not user.name:
        user.name = body.name
    db.commit()
    return list_reviews(db, product_id)


# ── comments / questions ─────────────────────────────────────────────
@router.get("/products/{product_id}/comments")
def list_comments(db: DB, product_id: int):
    rows = db.scalars(select(ProductComment).where(ProductComment.product_id == product_id).order_by(ProductComment.id.desc())).all()
    return {"data": [CommentOut(name=c.author_name, text=c.text, date=c.created_at.isoformat(), answer=c.answer) for c in rows]}


@router.post("/products/{product_id}/comments", status_code=201)
def add_comment(db: DB, user: CurrentUser, product_id: int, body: CommentIn):
    _product(db, product_id)
    db.add(ProductComment(product_id=product_id, user_id=user.id, author_name=_who(user, body.name), text=body.text))
    if body.name and not user.name:
        user.name = body.name
    db.commit()
    return list_comments(db, product_id)


@router.post("/artisan/comments/{comment_id}/answer")
def answer_comment(db: DB, who: CurrentArtisan, comment_id: int, body: AnswerIn):
    _, profile = who
    c = db.get(ProductComment, comment_id)
    if not c or db.get(Product, c.product_id).artisan_id != profile.id:
        raise HTTPException(404, "Comment not found")
    c.answer, c.answered_at = body.text, dt.datetime.now(dt.timezone.utc)
    db.commit()
    return list_comments(db, c.product_id)


# ── enquiries (B2B) ──────────────────────────────────────────────────
def _enq_out(db, e: Enquiry) -> EnquiryOut:
    p = db.get(Product, e.product_id)
    a = db.get(ArtisanProfile, e.artisan_id)
    b = db.get(User, e.buyer_id)
    return EnquiryOut(
        id=e.id, product_id=e.product_id, product_name=p.name if p else "", maker=a.display_name if a else "",
        buyer=(b.name or b.email or b.phone or "Buyer") if b else "Buyer", quantity=e.quantity,
        target_price=float(e.target_price) if e.target_price is not None else None,
        quoted_price=float(e.quoted_price) if e.quoted_price is not None else None,
        message=e.message, status=e.status.value, date=e.created_at.isoformat(),
    )


@router.post("/enquiries", status_code=201)
def create_enquiry(db: DB, user: CurrentUser, body: EnquiryIn):
    p = _product(db, body.product_id)
    if not p.artisan_id:
        raise HTTPException(400, "This piece has no maker to quote")
    e = Enquiry(buyer_id=user.id, artisan_id=p.artisan_id, product_id=p.id, quantity=body.quantity,
                target_price=body.target_price, message=body.message)
    db.add(e); db.commit(); db.refresh(e)
    return {"data": _enq_out(db, e)}


@router.get("/enquiries")
def my_enquiries(db: DB, user: CurrentUser):
    rows = db.scalars(select(Enquiry).where(Enquiry.buyer_id == user.id).order_by(Enquiry.id.desc())).all()
    return {"data": [_enq_out(db, e) for e in rows]}


@router.get("/artisan/enquiries")
def artisan_enquiries(db: DB, who: CurrentArtisan):
    _, profile = who
    rows = db.scalars(select(Enquiry).where(Enquiry.artisan_id == profile.id).order_by(Enquiry.id.desc())).all()
    return {"data": [_enq_out(db, e) for e in rows]}


@router.patch("/artisan/enquiries/{enquiry_id}")
def update_enquiry(db: DB, who: CurrentArtisan, enquiry_id: int, body: EnquiryUpdate):
    _, profile = who
    e = db.get(Enquiry, enquiry_id)
    if not e or e.artisan_id != profile.id:
        raise HTTPException(404, "Enquiry not found")
    e.status = EnquiryStatus(body.status)
    if body.quoted_price is not None:
        e.quoted_price = body.quoted_price
    db.commit(); db.refresh(e)
    return {"data": _enq_out(db, e)}
