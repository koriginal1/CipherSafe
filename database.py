from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

# Loads .env locally. On Vercel, configure the same values in Project Settings.
load_dotenv()

TABLE_NAME = "operations"


@lru_cache(maxsize=1)
def _client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY in your local .env file or deployment environment."
        )
    return create_client(url, key)


def add_operation(operation_type: str, algorithm: str,
                  message_length: int, status: str) -> None:
    """Save operation metadata only; never save plaintext, ciphertext, or keys."""
    payload = {
        "operation_type": operation_type,
        "algorithm": algorithm,
        "message_length": message_length,
        "status": status,
    }
    _client().table(TABLE_NAME).insert(payload).execute()


def get_operations(limit: int = 500) -> list[dict[str, Any]]:
    response = (
        _client()
        .table(TABLE_NAME)
        .select("id, timestamp, operation_type, algorithm, message_length, status")
        .order("id", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data or []


def clear_operations(operation_type: str | None = None) -> None:
    # The id is a generated positive bigint, so this filter targets all rows
    # without issuing an unfiltered delete request.
    query = _client().table(TABLE_NAME).delete()
    if operation_type:
        query = query.eq("operation_type", operation_type)
    else:
        query = query.gte("id", 1)
    query.execute()
