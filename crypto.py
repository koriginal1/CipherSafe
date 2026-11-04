from __future__ import annotations

import base64
import json
import os
import hmac
import re

from Crypto.Cipher import AES, DES3, PKCS1_OAEP
from Crypto.Hash import SHA256
from Crypto.Protocol.KDF import PBKDF2
from Crypto.PublicKey import RSA
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad, unpad
from Crypto.Hash import HMAC

_COMPACT_FORMATS = {
    "AES": ("A", ("salt", "nonce", "ciphertext", "tag")),
    "3DES": ("D", ("salt", "iv", "ciphertext", "mac")),
    "RSA": ("R", ("encrypted_key", "nonce", "ciphertext", "tag")),
}
_COMPACT_FORMATS_BY_CODE = {
    code: (algorithm, fields)
    for algorithm, (code, fields) in _COMPACT_FORMATS.items()
}


def _b64e(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def _b64d(value: str) -> bytes:
    try:
        return base64.b64decode(value.encode("ascii"), validate=True)
    except Exception as exc:
        raise ValueError("Ciphertext format is invalid.") from exc


def _compact_package(algorithm: str, *parts: bytes) -> str:
    code, fields = _COMPACT_FORMATS[algorithm]
    if len(parts) != len(fields):
        raise ValueError("Ciphertext format is invalid.")
    encoded_parts = (
        base64.urlsafe_b64encode(part).decode("ascii").rstrip("=")
        for part in parts
    )
    return ".".join(("CS1", code, *encoded_parts))


def _parse_compact_package(text: str, expected_algorithm: str) -> dict:
    parts = text.split(".")
    if len(parts) < 2 or parts[0] != "CS1":
        raise ValueError("Ciphertext format is invalid or incomplete.")

    try:
        algorithm, fields = _COMPACT_FORMATS_BY_CODE[parts[1]]
    except KeyError as exc:
        raise ValueError("Ciphertext format is invalid or unsupported.") from exc

    if algorithm != expected_algorithm:
        raise ValueError(f"This ciphertext is not in the expected {expected_algorithm} format.")
    if len(parts) != len(fields) + 2:
        raise ValueError("Ciphertext format is invalid or incomplete.")

    package = {"algorithm": algorithm}
    for field, value in zip(fields, parts[2:]):
        if any(character not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" for character in value):
            raise ValueError("Ciphertext format is invalid.")
        try:
            padded_value = value + "=" * (-len(value) % 4)
            decoded_value = base64.b64decode(padded_value, altchars=b"-_", validate=True)
        except Exception as exc:
            raise ValueError("Ciphertext format is invalid.") from exc
        package[field] = _b64e(decoded_value)

    return package


def _derive(passphrase: str, salt: bytes, length: int) -> bytes:
    if not passphrase:
        raise ValueError("Enter a key/passphrase.")
    return PBKDF2(passphrase.encode("utf-8"), salt, dkLen=length, count=300_000, hmac_hash_module=SHA256)


def _parse_package(text: str, expected_algorithm: str) -> dict:
    if text.startswith("CS1."):
        return _parse_compact_package(text, expected_algorithm)

    try:
        package = json.loads(text)
    except Exception as exc:
        raise ValueError("Ciphertext format is invalid or incomplete.") from exc
    if not isinstance(package, dict) or package.get("algorithm") != expected_algorithm:
        raise ValueError(f"This ciphertext is not in the expected {expected_algorithm} format.")
    return package


def _import_rsa_key(key_text: str):
    match = re.fullmatch(
        r"-----BEGIN ([A-Z0-9 ]+)-----\s*(.*?)\s*-----END \1-----",
        key_text.strip(),
        re.DOTALL,
    )
    if match:
        label, body = match.groups()
        body = "".join(body.split())
        pem_body = "\n".join(body[index:index + 64] for index in range(0, len(body), 64))
        key_text = f"-----BEGIN {label}-----\n{pem_body}\n-----END {label}-----"
    return RSA.import_key(key_text)


def _aes_encrypt(text: str, passphrase: str) -> str:
    salt = get_random_bytes(16)
    key = _derive(passphrase, salt, 32)
    nonce = get_random_bytes(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(text.encode("utf-8"))
    return _compact_package("AES", salt, nonce, ciphertext, tag)


def _aes_decrypt(text: str, passphrase: str) -> str:
    package = _parse_package(text, "AES")
    try:
        salt = _b64d(package["salt"])
        nonce = _b64d(package["nonce"])
        ciphertext = _b64d(package["ciphertext"])
        tag = _b64d(package["tag"])
        key = _derive(passphrase, salt, 32)
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        return cipher.decrypt_and_verify(ciphertext, tag).decode("utf-8")
    except ValueError:
        raise ValueError("Decryption failed. The passphrase may be wrong or the ciphertext was changed.")
    except Exception as exc:
        raise ValueError("Decryption failed. Check the passphrase and ciphertext.") from exc


def _des3_encrypt(text: str, passphrase: str) -> str:
    # 3DES is included for legacy/educational compatibility only.
    salt = get_random_bytes(16)
    derived = _derive(passphrase, salt, 48)
    key, mac_key = derived[:24], derived[24:]
    try:
        key = DES3.adjust_key_parity(key)
    except ValueError as exc:
        # A rare derived key can be rejected as degenerate; ask for a different passphrase.
        raise ValueError("This passphrase generated an invalid 3DES key. Try a different passphrase.") from exc
    iv = get_random_bytes(8)
    cipher = DES3.new(key, DES3.MODE_CBC, iv=iv)
    ciphertext = cipher.encrypt(pad(text.encode("utf-8"), DES3.block_size))
    authenticated = b"3DES-v1|" + salt + iv + ciphertext
    mac = HMAC.new(mac_key, authenticated, digestmod=SHA256).digest()
    return _compact_package("3DES", salt, iv, ciphertext, mac)


def _des3_decrypt(text: str, passphrase: str) -> str:
    package = _parse_package(text, "3DES")
    try:
        salt = _b64d(package["salt"])
        iv = _b64d(package["iv"])
        ciphertext = _b64d(package["ciphertext"])
        supplied_mac = _b64d(package["mac"])
        derived = _derive(passphrase, salt, 48)
        key, mac_key = derived[:24], derived[24:]
        key = DES3.adjust_key_parity(key)
        authenticated = b"3DES-v1|" + salt + iv + ciphertext
        expected_mac = HMAC.new(mac_key, authenticated, digestmod=SHA256).digest()
        if not hmac.compare_digest(supplied_mac, expected_mac):
            raise ValueError("Decryption failed. The passphrase may be wrong or the ciphertext was changed.")
        cipher = DES3.new(key, DES3.MODE_CBC, iv=iv)
        return unpad(cipher.decrypt(ciphertext), DES3.block_size).decode("utf-8")
    except ValueError as exc:
        if str(exc).startswith("Decryption failed"):
            raise
        raise ValueError("Decryption failed. Check the passphrase and ciphertext.") from exc
    except Exception as exc:
        raise ValueError("Decryption failed. Check the passphrase and ciphertext.") from exc


def _rsa_encrypt(text: str, public_key_text: str) -> str:
    if not public_key_text.strip():
        raise ValueError("For RSA encryption, paste a PEM public key into the Key field.")
    try:
        public_key = _import_rsa_key(public_key_text)
        if public_key.has_private():
            public_key = public_key.public_key()
        cipher = PKCS1_OAEP.new(public_key, hashAlgo=SHA256)
        # Hybrid encryption: RSA wraps a random AES key; AES-GCM encrypts the full message.
        session_key = get_random_bytes(32)
        aes_nonce = get_random_bytes(12)
        aes_cipher = AES.new(session_key, AES.MODE_GCM, nonce=aes_nonce)
        encrypted_message, tag = aes_cipher.encrypt_and_digest(text.encode("utf-8"))
        encrypted_session_key = cipher.encrypt(session_key)
        return _compact_package("RSA", encrypted_session_key, aes_nonce, encrypted_message, tag)
    except ValueError as exc:
        if str(exc).startswith("For RSA"):
            raise
        raise ValueError("RSA encryption failed. Check that the key is a valid PEM public key.") from exc
    except Exception as exc:
        raise ValueError("RSA encryption failed. Check that the key is a valid PEM public key.") from exc


def _rsa_decrypt(text: str, private_key_text: str) -> str:
    if not private_key_text.strip():
        raise ValueError("For RSA decryption, paste the matching PEM private key into the Key field.")
    package = _parse_package(text, "RSA")
    try:
        private_key = _import_rsa_key(private_key_text)
        if not private_key.has_private():
            raise ValueError("RSA decryption requires a private key, not a public key.")
        cipher = PKCS1_OAEP.new(private_key, hashAlgo=SHA256)
        session_key = cipher.decrypt(_b64d(package["encrypted_key"]))
        aes_cipher = AES.new(session_key, AES.MODE_GCM, nonce=_b64d(package["nonce"]))
        plaintext = aes_cipher.decrypt_and_verify(_b64d(package["ciphertext"]), _b64d(package["tag"]))
        return plaintext.decode("utf-8")
    except ValueError as exc:
        if str(exc).startswith("RSA decryption requires"):
            raise
        raise ValueError("RSA decryption failed. The private key may not match, or the ciphertext may be damaged.") from exc
    except Exception as exc:
        raise ValueError("RSA decryption failed. The private key may not match, or the ciphertext may be damaged.") from exc


def encrypt_message(text: str, algorithm: str, key: str) -> str:
    algorithm = algorithm.strip().upper()
    if algorithm == "AES":
        return _aes_encrypt(text, key)
    if algorithm == "RSA":
        return _rsa_encrypt(text, key)
    if algorithm == "3DES":
        return _des3_encrypt(text, key)
    raise ValueError("Unsupported algorithm. Choose AES, RSA, or 3DES.")


def decrypt_message(text: str, algorithm: str, key: str) -> str:
    algorithm = algorithm.strip().upper()
    if algorithm == "AES":
        return _aes_decrypt(text, key)
    if algorithm == "RSA":
        return _rsa_decrypt(text, key)
    if algorithm == "3DES":
        return _des3_decrypt(text, key)
    raise ValueError("Unsupported algorithm. Choose AES, RSA, or 3DES.")


def generate_rsa_keypair() -> tuple[str, str]:
    """Generate a 2048-bit RSA keypair as PEM strings for the UI to offer for download."""
    key = RSA.generate(2048)
    private_pem = key.export_key(format="PEM", pkcs=8).decode("ascii")
    public_pem = key.public_key().export_key(format="PEM").decode("ascii")
    return public_pem, private_pem
