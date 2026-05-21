"""Password hashing for share links — PBKDF2-HMAC-SHA256, stdlib only."""

import base64
import hashlib
import hmac
import secrets

_ITERATIONS = 240_000
_ALGO = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    if not password:
        return ""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    return "${algo}${iter}${salt}${hash}".format(
        algo=_ALGO,
        iter=_ITERATIONS,
        salt=base64.b64encode(salt).decode(),
        hash=base64.b64encode(digest).decode(),
    )


def verify_password(password: str, stored: str) -> bool:
    if not stored:
        # No password required; any input (including empty) is accepted.
        return True
    if not password:
        return False
    try:
        _, algo, iter_str, salt_b64, hash_b64 = stored.split("$")
    except ValueError:
        return False
    if algo != _ALGO:
        return False
    salt = base64.b64decode(salt_b64)
    expected = base64.b64decode(hash_b64)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, int(iter_str)
    )
    return hmac.compare_digest(digest, expected)


def new_token() -> str:
    # 32 url-safe bytes ≈ 43 chars, comfortably unguessable.
    return secrets.token_urlsafe(32)
