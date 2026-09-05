"""FastAPI application factory."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import settings
from app.db import engine
from app.routers import auth, buyer, catalogue, social

API = "/api"


def create_app() -> FastAPI:
    app = FastAPI(title="KalaSutra API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=False,
        allow_methods=["*"], allow_headers=["*"], max_age=600,
    )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        details = [{"loc": [str(x) for x in e.get("loc", [])], "msg": e.get("msg", ""), "type": e.get("type", "")} for e in exc.errors()]
        return JSONResponse(status_code=422, content={"error": "Invalid input", "details": details})

    @app.get(f"{API}/health", tags=["meta"])
    def health():
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"ok": True, "version": app.version, "aiMode": settings.ai_mode}

    app.include_router(auth.router, prefix=API)
    app.include_router(catalogue.router, prefix=API)
    app.include_router(buyer.router, prefix=API)
    app.include_router(social.router, prefix=API)

    web = settings.web_path if settings.serve_web else None
    if web is not None:
        app.mount("/", StaticFiles(directory=str(web), html=True), name="web")

    return app


app = create_app()
