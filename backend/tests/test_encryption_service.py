"""
Unit tests for EncryptionService (services/encryption_service.py).
"""

import pytest


def test_encrypt_decrypt_roundtrip():
    """
    Scenario: Encrypt a plaintext string then decrypt the result
    EP class: Valid partition — key set, plaintext non-empty
    Expected: decrypted value equals the original plaintext
    """
    from services.encryption_service import EncryptionService

    svc = EncryptionService()
    plaintext = "my-secret-password"
    ciphertext = svc.encrypt(plaintext)
    assert svc.decrypt(ciphertext) == plaintext


def test_encryption_missing_key_raises(monkeypatch):
    """
    Scenario: EncryptionService.encrypt() called after clearing the encryption key env var
    EP class: Invalid partition — SQUEEZYPAY_ENCRYPTION_KEY absent
    Expected: raises RuntimeError
    """
    from services.encryption_service import EncryptionService

    monkeypatch.delenv("SQUEEZYPAY_ENCRYPTION_KEY", raising=False)
    svc = EncryptionService()
    svc._fernet = None  # ensure cache is cleared so _get_fernet re-reads env
    with pytest.raises(RuntimeError):
        svc.encrypt("test")


def test_encrypt_produces_different_ciphertext_each_time():
    """
    Scenario: The same plaintext is encrypted twice
    EP class: Valid partition — Fernet uses a random nonce per operation
    Expected: the two ciphertexts differ (probabilistic — should always pass)
    """
    from services.encryption_service import EncryptionService

    svc = EncryptionService()
    plaintext = "same-plaintext"
    ct1 = svc.encrypt(plaintext)
    ct2 = svc.encrypt(plaintext)
    assert ct1 != ct2
