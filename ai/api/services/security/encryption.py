"""
Encryption Module for Sensitive Data
===================================

AES-256 encryption for data at rest:
- Candidate answers
- HR document content
- Quiz questions (optional)

Uses Fernet (AES-128-CBC + HMAC) from cryptography library.
"""

import os
import base64
import logging
from typing import Optional, Union
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Key Management
# ---------------------------------------------------------------------------

def get_encryption_key() -> bytes:
    """
    Get or derive the encryption key.
    
    Priority:
    1. ENCRYPTION_KEY environment variable (base64-encoded Fernet key)
    2. Derive from SECRET_KEY + salt
    
    Returns:
        32-byte key suitable for Fernet
    """
    # Option 1: Direct Fernet key from env
    env_key = os.getenv('ENCRYPTION_KEY')
    if env_key:
        try:
            # Validate it's a valid Fernet key
            Fernet(env_key.encode())
            return env_key.encode()
        except Exception:
            logger.warning("ENCRYPTION_KEY is not a valid Fernet key, deriving from SECRET_KEY")
    
    # Option 2: Derive from Django SECRET_KEY
    secret_key = getattr(settings, 'SECRET_KEY', 'default-secret-key')
    salt = b'recrutement-encryption-salt-v1'  # Fixed salt for deterministic key derivation
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    
    derived_key = base64.urlsafe_b64encode(kdf.derive(secret_key.encode()))
    return derived_key


def generate_new_encryption_key() -> str:
    """Generate a new Fernet key for ENCRYPTION_KEY env var."""
    return Fernet.generate_key().decode()


# Singleton cipher instance
_cipher: Optional[Fernet] = None


def get_cipher() -> Fernet:
    """Get the singleton Fernet cipher instance."""
    global _cipher
    if _cipher is None:
        key = get_encryption_key()
        _cipher = Fernet(key)
    return _cipher


# ---------------------------------------------------------------------------
# Encryption/Decryption Functions
# ---------------------------------------------------------------------------

def encrypt_value(value: Union[str, bytes, None]) -> Optional[str]:
    """
    Encrypt a string or bytes value.
    
    Args:
        value: Plain text string or bytes to encrypt
        
    Returns:
        Base64-encoded encrypted string, or None if input is None/empty
    """
    if value is None:
        return None
    
    if isinstance(value, str):
        if not value:
            return None
        data = value.encode('utf-8')
    elif isinstance(value, bytes):
        if not value:
            return None
        data = value
    else:
        raise TypeError(f"Expected str or bytes, got {type(value)}")
    
    try:
        cipher = get_cipher()
        encrypted = cipher.encrypt(data)
        return encrypted.decode('utf-8')
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        raise


def decrypt_value(encrypted_value: Union[str, bytes, None]) -> Optional[str]:
    """
    Decrypt an encrypted value.
    
    Args:
        encrypted_value: Base64-encoded encrypted string
        
    Returns:
        Decrypted plain text string, or None if input is None/empty
    """
    if encrypted_value is None:
        return None
    
    if isinstance(encrypted_value, str):
        if not encrypted_value:
            return None
        data = encrypted_value.encode('utf-8')
    elif isinstance(encrypted_value, bytes):
        if not encrypted_value:
            return None
        data = encrypted_value
    else:
        raise TypeError(f"Expected str or bytes, got {type(encrypted_value)}")
    
    try:
        cipher = get_cipher()
        decrypted = cipher.decrypt(data)
        return decrypted.decode('utf-8')
    except InvalidToken:
        logger.error("Decryption failed: Invalid token or key mismatch")
        raise ValueError("Invalid encrypted data or encryption key mismatch")
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        raise


def encrypt_json(data: dict) -> str:
    """
    Encrypt a JSON-serializable dictionary.
    
    Args:
        data: Dictionary to encrypt
        
    Returns:
        Encrypted JSON string
    """
    import json
    json_str = json.dumps(data)
    return encrypt_value(json_str)


def decrypt_json(encrypted_data: str) -> dict:
    """
    Decrypt and parse JSON data.
    
    Args:
        encrypted_data: Encrypted JSON string
        
    Returns:
        Decrypted dictionary
    """
    import json
    json_str = decrypt_value(encrypted_data)
    return json.loads(json_str)


# ---------------------------------------------------------------------------
# Encrypted Text Field Descriptor for Django Models
# ---------------------------------------------------------------------------

class EncryptedTextField:
    """
    Descriptor for encrypted text fields.
    
    Stores encrypted data in the database, but returns plaintext in Python.
    Usage:
        class MyModel(models.Model):
            _content = models.TextField(db_column='content')
            content = EncryptedTextField('_content')
    """
    
    def __init__(self, db_column: str):
        self.db_column = db_column
    
    def __get__(self, instance, owner):
        if instance is None:
            return self
        encrypted = getattr(instance, self.db_column)
        return decrypt_value(encrypted) if encrypted else None
    
    def __set__(self, instance, value):
        if value is not None and value != '':
            encrypted = encrypt_value(value)
        else:
            encrypted = None
        setattr(instance, self.db_column, encrypted)


# ---------------------------------------------------------------------------
# Field Encryption Mixin for Django Models
# ---------------------------------------------------------------------------

class EncryptedFieldMixin:
    """
    Mixin for encrypting/decrypting model fields automatically.
    
    Usage in model:
        class QuizAnswer(models.Model):
            _answer_text = models.TextField(db_column='answer_text')
            
            @property
            def answer_text(self):
                return decrypt_value(self._answer_text)
            
            @answer_text.setter
            def answer_text(self, value):
                self._answer_text = encrypt_value(value)
    """
    
    @staticmethod
    def encrypt(value):
        return encrypt_value(value)
    
    @staticmethod
    def decrypt(value):
        return decrypt_value(value)


# ---------------------------------------------------------------------------
# Batch Encryption Utilities
# ---------------------------------------------------------------------------

def encrypt_dict_values(data: dict, fields: list) -> dict:
    """
    Encrypt specific fields in a dictionary.
    
    Args:
        data: Dictionary with data
        fields: List of field names to encrypt
        
    Returns:
        Dictionary with specified fields encrypted
    """
    result = data.copy()
    for field in fields:
        if field in result and result[field] is not None:
            result[field] = encrypt_value(result[field])
    return result


def decrypt_dict_values(data: dict, fields: list) -> dict:
    """
    Decrypt specific fields in a dictionary.
    
    Args:
        data: Dictionary with encrypted data
        fields: List of field names to decrypt
        
    Returns:
        Dictionary with specified fields decrypted
    """
    result = data.copy()
    for field in fields:
        if field in result and result[field] is not None:
            result[field] = decrypt_value(result[field])
    return result


# ---------------------------------------------------------------------------
# File Encryption (for HR documents)
# ---------------------------------------------------------------------------

def encrypt_file_content(file_path: str) -> bytes:
    """
    Encrypt the contents of a file.
    
    Args:
        file_path: Path to file to encrypt
        
    Returns:
        Encrypted bytes
    """
    with open(file_path, 'rb') as f:
        content = f.read()
    
    cipher = get_cipher()
    return cipher.encrypt(content)


def decrypt_file_content(encrypted_bytes: bytes) -> bytes:
    """
    Decrypt file contents.
    
    Args:
        encrypted_bytes: Encrypted file bytes
        
    Returns:
        Decrypted bytes
    """
    cipher = get_cipher()
    return cipher.decrypt(encrypted_bytes)


def encrypt_document_text(text: str) -> str:
    """
    Encrypt document text (full_text, content fields).
    
    Args:
        text: Document text content
        
    Returns:
        Encrypted string
    """
    return encrypt_value(text)


def decrypt_document_text(encrypted_text: str) -> str:
    """
    Decrypt document text.
    
    Args:
        encrypted_text: Encrypted document text
        
    Returns:
        Decrypted text
    """
    return decrypt_value(encrypted_text)


# ---------------------------------------------------------------------------
# Key Rotation Support
# ---------------------------------------------------------------------------

def rotate_encryption_key(old_key: str, new_key: str, encrypted_values: list) -> list:
    """
    Rotate encryption key by re-encrypting values.
    
    Args:
        old_key: Current encryption key
        new_key: New encryption key
        encrypted_values: List of encrypted strings to re-encrypt
        
    Returns:
        List of re-encrypted strings
    """
    global _cipher
    
    # Decrypt with old key
    old_cipher = Fernet(old_key.encode())
    
    # Encrypt with new key
    new_cipher = Fernet(new_key.encode())
    
    re_encrypted = []
    for value in encrypted_values:
        if value:
            decrypted = old_cipher.decrypt(value.encode())
            re_encrypted.append(new_cipher.encrypt(decrypted).decode())
        else:
            re_encrypted.append(value)
    
    return re_encrypted


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

def test_encryption() -> bool:
    """Test encryption/decryption cycle."""
    try:
        test_value = "test-encryption-string-123"
        encrypted = encrypt_value(test_value)
        decrypted = decrypt_value(encrypted)
        
        if decrypted == test_value:
            logger.info("Encryption test passed")
            return True
        else:
            logger.error("Encryption test failed: value mismatch")
            return False
    except Exception as e:
        logger.error(f"Encryption test failed: {e}")
        return False
