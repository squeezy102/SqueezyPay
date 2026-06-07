import os
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from sqlalchemy.orm import Session

from core.auth import ALGORITHM
from core.logging_config import get_logger
from models.models import AuthConfig

logger = get_logger("squeezypay.services.auth")

TOKEN_EXPIRE_HOURS = 12


def _get_secret_key() -> str:
    return os.environ.get("SQUEEZYPAY_SECRET_KEY", "")


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def is_configured(self) -> bool:
        return self.db.query(AuthConfig).first() is not None

    def setup(self, passphrase: str) -> bool:
        if self.is_configured():
            return False
        hashed = bcrypt.hashpw(passphrase.encode(), bcrypt.gensalt()).decode()
        self.db.add(AuthConfig(passphrase_hash=hashed))
        self.db.commit()
        logger.info("Auth passphrase configured")
        return True

    def verify(self, passphrase: str) -> bool:
        config = self.db.query(AuthConfig).first()
        if not config:
            return False
        return bcrypt.checkpw(passphrase.encode(), config.passphrase_hash.encode())

    def create_token(self) -> str:
        secret = _get_secret_key()
        if not secret:
            raise RuntimeError("SQUEEZYPAY_SECRET_KEY environment variable not set")
        payload = {
            "sub": "household",
            "exp": datetime.now(UTC) + timedelta(hours=TOKEN_EXPIRE_HOURS),
            "iat": datetime.now(UTC),
        }
        return jwt.encode(payload, secret, algorithm=ALGORITHM)

    def decode_token(self, token: str) -> dict:
        secret = _get_secret_key()
        if not secret:
            raise RuntimeError("SQUEEZYPAY_SECRET_KEY environment variable not set")
        return jwt.decode(token, secret, algorithms=[ALGORITHM])

    def change_passphrase(self, current: str, new_passphrase: str) -> bool:
        if not self.verify(current):
            return False
        config = self.db.query(AuthConfig).first()
        config.passphrase_hash = bcrypt.hashpw(new_passphrase.encode(), bcrypt.gensalt()).decode()
        self.db.commit()
        logger.info("Auth passphrase changed")
        return True
