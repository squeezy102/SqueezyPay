from sqlalchemy.orm import Session
from models.models import Credential


class CredentialRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> list[Credential]:
        return self.db.query(Credential).all()

    def get_by_id(self, credential_id: int) -> Credential | None:
        return self.db.query(Credential).filter(Credential.id == credential_id).first()

    def get_by_bill_id(self, bill_id: int) -> Credential | None:
        return self.db.query(Credential).filter(Credential.bill_id == bill_id).first()

    def create(self, bill_id: int, username: str, password_encrypted: str, notes: str | None) -> Credential:
        credential = Credential(
            bill_id=bill_id,
            username=username,
            password_encrypted=password_encrypted,
            notes=notes,
        )
        self.db.add(credential)
        self.db.commit()
        self.db.refresh(credential)
        return credential

    def update(self, credential: Credential, **kwargs) -> Credential:
        for key, value in kwargs.items():
            setattr(credential, key, value)
        self.db.commit()
        self.db.refresh(credential)
        return credential

    def delete(self, credential: Credential) -> None:
        self.db.delete(credential)
        self.db.commit()
