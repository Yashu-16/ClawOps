"""
tests/test_broken_module.py
These tests deliberately exercise the buggy code paths.
They FAIL before the agent repairs the code, and PASS after.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app.broken_module import process_user_data, calculate_stats
from app.database import init_db, get_user_by_id


# ── process_user_data ─────────────────────────────────────────

class TestProcessUserData:
    def test_valid_user(self):
        user = {"name": "alice", "email": "alice@example.com"}
        result = process_user_data(user)
        assert result["processed_name"] == "ALICE"
        assert result["email"] == "alice@example.com"
        assert result["status"] == "processed"

    def test_none_input_does_not_crash(self):
        """Bug 1: currently raises AttributeError — should return a safe default."""
        result = process_user_data(None)
        assert result["status"] == "default"
        assert result["processed_name"] == "UNKNOWN"

    def test_missing_email_defaults(self):
        user = {"name": "bob"}
        result = process_user_data(user)
        assert result["processed_name"] == "BOB"
        assert result["email"] == "unknown"


# ── calculate_stats ───────────────────────────────────────────

class TestCalculateStats:
    def test_even_target(self):
        result = calculate_stats(4)
        assert result["count"] == 4
        assert result["sum"] == 0 + 1 + 4 + 9

    def test_odd_target(self):
        """Bug 2: currently causes infinite loop for odd targets."""
        result = calculate_stats(3)
        assert result["count"] == 3

    def test_zero_target(self):
        result = calculate_stats(0)
        assert result["count"] == 0
        assert result["sum"] == 0


# ── database ──────────────────────────────────────────────────

class TestDatabase:
    def test_fetch_existing_user(self):
        """Bug 3: currently raises sqlite3.OperationalError (wrong column)."""
        init_db()
        user = get_user_by_id(1)
        assert user is not None
        assert user["email"] == "alice@example.com"

    def test_fetch_missing_user_returns_none(self):
        init_db()
        assert get_user_by_id(9999) is None
