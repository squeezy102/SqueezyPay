import re
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from api.auth import router as auth_router
from api.bills import router as bills_router
from api.categories import router as categories_router
from api.credentials import router as credentials_router
from api.frontend_log import router as frontend_log_router
from api.income import router as income_router
from api.payment_history import router as payment_history_router
from api.payment_methods import router as payment_methods_router
from api.settings import router as settings_router
from core.auth import require_auth
from core.limiter import limiter
from core.logging_config import configure_logging, get_logger
from database.db import init_db

configure_logging()
logger = get_logger("squeezypay.main")

_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:9000",
]
_ALLOWED_ORIGIN_REGEX = re.compile(
    r"http://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?"
)


def _is_allowed_origin(origin: str) -> bool:
    return origin in _ALLOWED_ORIGINS or bool(_ALLOWED_ORIGIN_REGEX.fullmatch(origin))


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    origin = request.headers.get("origin", "")
    headers = {"Retry-After": "60"}
    if origin and _is_allowed_origin(origin):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
        headers=headers,
    )


_SUPPRESS_REQUEST_LOG = {"/health"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    if not os.environ.get("SQUEEZYPAY_ENCRYPTION_KEY"):
        raise RuntimeError(
            "SQUEEZYPAY_ENCRYPTION_KEY is not set. "
            "Run scripts/generate_key.py to create your encryption key."
        )
    if not os.environ.get("SQUEEZYPAY_SECRET_KEY"):
        raise RuntimeError(
            "SQUEEZYPAY_SECRET_KEY is not set. "
            "Set a 32+ character random string as your JWT signing key."
        )
    init_db()
    logger.info("SqueezyPay backend started")
    yield


app = FastAPI(title="SqueezyPay API", version="0.1.0", lifespan=lifespan)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    if request.url.path in _SUPPRESS_REQUEST_LOG:
        return await call_next(request)
    logger.info("[REQUEST] %s %s", request.method, request.url.path)
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000)
    logger.info(
        "[RESPONSE] %s %s %s %dms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=_ALLOWED_ORIGIN_REGEX.pattern,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(bills_router, dependencies=[Depends(require_auth)])
app.include_router(credentials_router, dependencies=[Depends(require_auth)])
app.include_router(payment_methods_router, dependencies=[Depends(require_auth)])
app.include_router(payment_history_router, dependencies=[Depends(require_auth)])
app.include_router(frontend_log_router, dependencies=[Depends(require_auth)])
app.include_router(income_router, dependencies=[Depends(require_auth)])
app.include_router(settings_router, dependencies=[Depends(require_auth)])
app.include_router(categories_router, dependencies=[Depends(require_auth)])


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
