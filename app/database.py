"""
database.py
SQLite helper with ONE intentional bug:
  Bug: column name 'usr_email' should be 'user_email'
"""
import sqlite3
import logging
import os

logger = logging.getLogger(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "clawops.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT    NOT NULL,
            username   TEXT    NOT NULL
        )
    """)
    cur.execute(
        "INSERT OR IGNORE INTO users (id, user_email, username) VALUES (1, 'alice@example.com', 'alice')"
    )
    conn.commit()
    conn.close()
    logger.info("Database initialised")


def get_user_by_id(user_id: int):
    """
    BUG: queries column 'usr_email' — real column is 'user_email'.
    Fix: replace 'usr_email' with 'user_email' in the SELECT.
    """
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()
    try:
        # BUG ↓
        cur.execute(
            "SELECT id, usr_email, username FROM users WHERE id = ?",
            (user_id,),
        )
        row = cur.fetchone()
    finally:
        conn.close()

    if row:
        return {"id": row[0], "email": row[1], "username": row[2]}
    return None
