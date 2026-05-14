"""
Mock of Ella's backend notification endpoint.
Accepts the canonical payload and returns 200 — used in dev so the
notification service can complete a full send loop without a live backend.
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Ella Backend Mock", version="1.0.0")


@app.get("/")
def root():
    return {"service": "Ella Backend Mock", "status": "ok", "endpoints": ["GET /health", "POST /api/v1/notifications/send"]}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/notifications/send")
async def receive_notification(request: Request):
    body = await request.json()
    logger.info(
        "📬  received notification | rule=%s  learner=%s  channel=%s",
        body.get("rule_id", "?"),
        body.get("learner_id", "?"),
        body.get("channel", "?"),
    )
    logger.debug("payload: %s", json.dumps(body, indent=2))
    return JSONResponse(
        status_code=200,
        content={
            "status": "accepted",
            "notification_id": f"mock-{datetime.now(timezone.utc).isoformat()}",
        },
    )
