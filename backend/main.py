import os
import re
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from api.auth import router as auth_router
from api.bills import router as bills_router
from api.categories import router as categories_router
from api.credentials import router as credentials_router
from api.diagnostics import router as diagnostics_router
from api.frontend_log import router as frontend_log_router
from api.income import router as income_router
from api.payment_history import router as payment_history_router
from api.payment_methods import router as payment_methods_router
from api.plaid import router as plaid_router
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
    "http://localhost:8000",
    "http://127.0.0.1:8000",
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


def _resolve_frontend_dist() -> Path | None:
    """Locate the frontend dist/ directory whether running packaged or from source."""
    if getattr(sys, "frozen", False):
        # PyInstaller: bundled assets are in sys._MEIPASS
        candidate = Path(sys._MEIPASS) / "frontend" / "dist"  # type: ignore[attr-defined]
    else:
        candidate = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    return candidate if candidate.is_dir() else None


@asynccontextmanager
async def lifespan(app: FastAPI):
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

    # Installer bootstrap — if a passphrase temp file exists, seed auth and delete it.
    # The installer writes initial_passphrase.tmp to %APPDATA%\SqueezyPay\ after
    # the user sets their passphrase on the installer's passphrase page.
    # This file is consumed exactly once and never stored in plaintext after this point.
    appdata_dir = Path(os.environ.get("APPDATA", "")) / "SqueezyPay"
    passphrase_tmp = appdata_dir / "initial_passphrase.tmp"
    if passphrase_tmp.exists():
        try:
            passphrase = passphrase_tmp.read_text(encoding="utf-8").strip()
            if passphrase:
                from database.db import SessionLocal
                from services.auth_service import AuthService
                with SessionLocal() as db:
                    AuthService(db).setup(passphrase)
                logger.info("Initial passphrase seeded from installer bootstrap")
        finally:
            passphrase_tmp.unlink(missing_ok=True)

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
app.include_router(diagnostics_router, dependencies=[Depends(require_auth)])
app.include_router(payment_methods_router, dependencies=[Depends(require_auth)])
app.include_router(payment_history_router, dependencies=[Depends(require_auth)])
app.include_router(frontend_log_router, dependencies=[Depends(require_auth)])
app.include_router(income_router, dependencies=[Depends(require_auth)])
app.include_router(settings_router, dependencies=[Depends(require_auth)])
app.include_router(categories_router, dependencies=[Depends(require_auth)])
app.include_router(plaid_router, dependencies=[Depends(require_auth)])


@app.get("/health")
def health():
    return {"status": "ok"}


# Mount the React SPA — API routes registered above take priority.
# In packaged mode the dist/ is bundled inside sys._MEIPASS.
# In dev mode the Vite dev server handles this; no mount needed.
_frontend_dist = _resolve_frontend_dist()
if _frontend_dist:
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    app.mount("/assets", StaticFiles(directory=str(_frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):  # noqa: ARG001
        index = _frontend_dist / "index.html"
        return FileResponse(str(index))


if __name__ == "__main__":
    if "--migrate" in sys.argv:
        # Headless migration mode — used by the installer and upgrade flow.
        from alembic.config import Config as AlembicConfig

        from alembic import command

        ini_path = Path(__file__).parent / "alembic.ini"
        alembic_cfg = AlembicConfig(str(ini_path))
        command.upgrade(alembic_cfg, "head")
        sys.exit(0)

    if "--generate-key" in sys.argv:
        # Key generation mode — used by the installer to produce secrets
        # without requiring Python to be installed on the target machine.
        # Usage:
        #   backend.exe --generate-key fernet <output_file>
        #   backend.exe --generate-key secret <output_file>
        import secrets

        from cryptography.fernet import Fernet

        args = sys.argv
        idx = args.index("--generate-key")
        key_type = args[idx + 1] if idx + 1 < len(args) else ""
        out_file = args[idx + 2] if idx + 2 < len(args) else ""
        if key_type == "fernet":
            key = Fernet.generate_key().decode()
        elif key_type == "secret":
            key = secrets.token_hex(32)
        else:
            print("Unknown key type", file=sys.stderr)
            sys.exit(1)
        if out_file:
            Path(out_file).write_text(key)
        else:
            print(key)
        sys.exit(0)

    import webbrowser

    import uvicorn

    # Open the browser after a short delay so uvicorn is ready to accept connections.
    # Only do this in packaged mode — dev mode uses the Vite dev server URL.
    if getattr(sys, "frozen", False):
        import threading
        def _open_browser():
            time.sleep(1.5)
            webbrowser.open("http://localhost:8000")
        threading.Thread(target=_open_browser, daemon=True).start()

    uvicorn.run(app, host="0.0.0.0", port=8000)
