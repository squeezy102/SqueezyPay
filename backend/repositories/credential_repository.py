from sqlalchemy.orm import Session
from models.models import Credential


class CredentialRepository:
    @staticmethod
    def get_all(db: Session) -> list[Credential]:
        return db.query(Credential).all()

    @staticmethod
    def get_by_id(db: Session, credential_id: int) -> Credential | None:
        return db.query(Credential).filter(Credential.id == credential_id).first()

    @staticmethod
    def get_by_bill_id(db: Session, bill_id: int) -> Credential | None:
        return db.query(Credential).filter(Credential.bill_id == bill_id).first()

    @staticmethod
    def create(db: Session, bill_id: int, username: str, password_encrypted: str, notes: str | None) -> Credential:
        credential = Credential(
            bill_id=bill_id,
            username=username,
            password_encrypted=password_encrypted,
            notes=notes,
        )
        db.add(credential)
        db.commit()
        db.refresh(credential)
        return credential

    @staticmethod
    def update(db: Session, credential: Credential, **kwargs) -> Credential:
        for key, value in kwargs.items():
            setattr(credential, key, value)
        db.commit()
        db.refresh(credential)
        return credential

    @staticmethod
    def delete(db: Session, credential: Credential) -> None:
        db.delete(credential)
        db.commit()
