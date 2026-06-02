from fastapi import APIRouter
from core.logging_config import get_logger

router = APIRouter(prefix="/api/frontend-log", tags=["frontend-log"])
logger = get_logger("squeezypay.frontend")


@router.post("/", status_code=204)
def log_frontend_error(payload: dict):
    level = str(payload.get("level", "ERROR")).upper()
    message = payload.get("message", "(no message)")
    detail = payload.get("detail", "")
    component = payload.get("component", "")

    log_fn = logger.error if level == "ERROR" else logger.warning
    parts = [message]
    if component:
        parts.append(f"component={component}")
    if detail:
        parts.append(f"detail={detail}")
    log_fn(" | ".join(parts))
