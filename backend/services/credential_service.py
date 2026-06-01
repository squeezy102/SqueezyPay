from sqlalchemy.orm import Session
from repositories.credential_repository import CredentialRepository
from services.encryption_service import encryption_service
from core.logging_config import get_logger

logger = get_logger("squeezypay.services.credentials")


class CredentialService:
    def __init__(self, db: Session):
        self.repo = CredentialRepository(db)

    def get_all(self) -> list[dict]:
        credentials = self.repo.get_all()
        return [self._to_dict(c) for c in credentials]

    def get_by_id(self, credential_id: int) -> dict | None:
        credential = self.repo.get_by_id(credential_id)
        if not credential:
            return None
        return self._to_dict(credential)

    def get_by_bill_id(self, bill_id: int) -> dict | None:
        credential = self.repo.get_by_bill_id(bill_id)
        if not credential:
            return None
        return self._to_dict(credential)

    def create(self, bill_id: int, username: str, password: str, notes: str | None) -> dict:
        password_encrypted = encryption_service.encrypt(password)
        credential = self.repo.create(bill_id, username, password_encrypted, notes)
        result = self._to_dict(credential)
        logger.info(f"Created credential id={result['id']} for bill_id={bill_id}")
        return result

    def update(self, credential_id: int, **kwargs) -> dict | None:
        credential = self.repo.get_by_id(credential_id)
        if not credential:
            logger.warning(f"Update attempted on non-existent credential id={credential_id}")
            return None
        if "password" in kwargs:
            kwargs["password_encrypted"] = encryption_service.encrypt(kwargs.pop("password"))
        return self._to_dict(self.repo.update(credential, **kwargs))

    def delete(self, credential_id: int) -> bool:
        credential = self.repo.get_by_id(credential_id)
        if not credential:
            return False
        self.repo.delete(credential)
        return True

    def _to_dict(self, credential) -> dict:
        return {
            "id": credential.id,
            "bill_id": credential.bill_id,
            "username": credential.username,
            "password": encryption_service.decrypt(credential.password_encrypted),
            "notes": credential.notes,
            "created_at": credential.created_at,
            "updated_at": credential.updated_at,
        }
