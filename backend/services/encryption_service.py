import os

from cryptography.fernet import Fernet


class EncryptionService:
    def __init__(self):
        self._fernet: Fernet | None = None

    def _get_fernet(self) -> Fernet:
        if self._fernet is None:
            key = os.environ.get("SQUEEZYPAY_ENCRYPTION_KEY")
            if not key:
                raise RuntimeError(
                    "SQUEEZYPAY_ENCRYPTION_KEY environment variable is not set. "
                    "Run scripts/generate_key.py to create your encryption key, "
                    "then set it as a Windows environment variable and restart the server."
                )
            self._fernet = Fernet(key.encode())
        return self._fernet

    def encrypt(self, plaintext: str) -> str:
        return self._get_fernet().encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        return self._get_fernet().decrypt(ciphertext.encode()).decode()


encryption_service = EncryptionService()
