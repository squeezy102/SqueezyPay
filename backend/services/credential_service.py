from sqlalchemy.orm import Session

from core.logging_config import get_logger
from repositories.credential_repository import CredentialRepository
from services.encryption_service import encryption_service

logger = get_logger("squeezypay.services.credentials")


class CredentialService:
    @staticmethod
    def get_all(db: Session) -> list[dict]:
        credentials = CredentialRepository.get_all(db)
        return [CredentialService._to_dict(c) for c in credentials]

    @staticmethod
    def get_by_id(db: Session, credential_id: int) -> dict | None:
        credential = CredentialRepository.get_by_id(db, credential_id)
        if not credential:
            return None
        return CredentialService._to_dict(credential)

    @staticmethod
    def get_by_bill_id(db: Session, bill_id: int) -> dict | None:
        credential = CredentialRepository.get_by_bill_id(db, bill_id)
        if not credential:
            return None
        return CredentialService._to_dict(credential)

    @staticmethod
    def create(db: Session, bill_id: int, username: str, password: str, notes: str | None) -> dict:
        password_encrypted = encryption_service.encrypt(password)
        credential = CredentialRepository.create(db, bill_id, username, password_encrypted, notes)
        result = CredentialService._to_dict(credential)
        logger.info(f"Created credential id={result['id']} for bill_id={bill_id}")
        return result

    @staticmethod
    def update(db: Session, credential_id: int, **kwargs) -> dict | None:
        credential = CredentialRepository.get_by_id(db, credential_id)
        if not credential:
            logger.warning(f"Update attempted on non-existent credential id={credential_id}")
            return None
        if "password" in kwargs:
            kwargs["password_encrypted"] = encryption_service.encrypt(kwargs.pop("password"))
        return CredentialService._to_dict(CredentialRepository.update(db, credential, **kwargs))

    @staticmethod
    def delete(db: Session, credential_id: int) -> bool:
        credential = CredentialRepository.get_by_id(db, credential_id)
        if not credential:
            return False
        CredentialRepository.delete(db, credential)
        return True

    @staticmethod
    def _to_dict(credential) -> dict:
        return {
            "id": credential.id,
            "bill_id": credential.bill_id,
            "username": credential.username,
            "password": encryption_service.decrypt(credential.password_encrypted),
            "notes": credential.notes,
            "created_at": credential.created_at,
            "updated_at": credential.updated_at,
        }
