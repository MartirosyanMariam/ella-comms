"""
Single source of truth for the active environment (dev | prod).

Set per HTTP request via middleware; scheduler falls back to APP_ENV env var.
"""
import os
from contextvars import ContextVar

# Set by request middleware; "" means "use APP_ENV"
_request_env: ContextVar[str] = ContextVar("request_env", default="")


def get_env() -> str:
    v = _request_env.get("")
    if v in ("dev", "prod"):
        return v
    return os.environ.get("APP_ENV", "dev")


def set_env_token(env: str):
    """Returns a reset token. Call reset_token() in a finally block."""
    if env not in ("dev", "prod"):
        env = ""
    return _request_env.set(env)


def reset_token(token):
    _request_env.reset(token)
