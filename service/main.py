import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

import app_env
from db.rules_db import close_rules_pool, run_migrations
from routers.rules import router as rules_router
from routers.logs import router as logs_router
from routers.saved_queries import router as saved_queries_router
from scheduler import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting up — running migrations")
    await run_migrations()
    start_scheduler()
    yield
    logger.info("shutting down")
    stop_scheduler()
    await close_rules_pool()


app = FastAPI(
    title="Ella Communication Engine",
    version="1.0.0",
    description="Rule-based notification service for the Ella language learning app.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def env_middleware(request: Request, call_next):
    env = request.headers.get("X-App-Env", "")
    token = app_env.set_env_token(env)
    try:
        return await call_next(request)
    finally:
        app_env.reset_token(token)

app.include_router(rules_router, prefix="/api/v1")
app.include_router(logs_router, prefix="/api/v1")
app.include_router(saved_queries_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/v1/env")
def get_env():
    return {"env": app_env.get_env()}
