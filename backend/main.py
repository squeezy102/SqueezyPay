from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from core.logging_config import configure_logging, get_logger
from core.auth import require_auth
from database.db import init_db
from api.bills import router as bills_router
from api.credentials import router as credentials_router
from api.payment_methods import router as payment_methods_router
from api.payment_history import router as payment_history_router
from api.frontend_log import router as frontend_log_router
from api.income import router as income_router
from api.settings import router as settings_router
from api.categories import router as categories_router
from api.auth import router as auth_router

configure_logging()
logger = get_logger("squeezypay.main")

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("SqueezyPay backend started")
    yield


app = FastAPI(title="SqueezyPay API", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
