from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.logging_config import configure_logging, get_logger
from database.db import init_db
from api.bills import router as bills_router
from api.credentials import router as credentials_router
from api.payment_methods import router as payment_methods_router
from api.payment_history import router as payment_history_router

configure_logging()
logger = get_logger("squeezypay.main")

app = FastAPI(title="SqueezyPay API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bills_router)
app.include_router(credentials_router)
app.include_router(payment_methods_router)
app.include_router(payment_history_router)


@app.on_event("startup")
def startup_event():
    init_db()
    logger.info("SqueezyPay backend started")


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
