import json
import logging
import logging.handlers
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

LOG_FILENAME = "squeezypay.log"
MAX_LOG_BYTES = 5 * 1024 * 1024
LOG_BACKUP_COUNT = 5


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "service": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def _resolve_log_dir() -> Path:
    if getattr(sys, "frozen", False):
        # Packaged: write logs to %APPDATA%\SqueezyPay\logs\
        log_dir = Path(os.environ.get("APPDATA", "")) / "SqueezyPay" / "logs"
    else:
        log_dir = Path(__file__).resolve().parent.parent / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def configure_logging() -> None:
    log_path = _resolve_log_dir() / LOG_FILENAME

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    # Console handler - plain text for readability during development
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    root.addHandler(console)

    # Rotating file handler - JSON for admin dashboard consumption
    file_handler = logging.handlers.RotatingFileHandler(
        log_path, maxBytes=MAX_LOG_BYTES, backupCount=LOG_BACKUP_COUNT, encoding="utf-8"
    )
    file_handler.setFormatter(JsonFormatter())
    root.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
