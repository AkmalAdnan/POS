"""Spice POS API v2 — thin FastAPI entrypoint.

Routes live under /app/backend/routes/*, Pydantic models under /app/backend/models/*,
and cross-cutting helpers under /app/backend/core/*.
"""
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from core.config import CORS_ORIGINS
from core.db import client
from routes import api_router
from seed import seed_startup

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Spice POS API v2")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await seed_startup()
        logger.info("Seeding completed.")
    except Exception as e:
        logger.exception("Seed error: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
