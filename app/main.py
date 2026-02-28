"""
ClawOps Target Microservice
A FastAPI service with endpoints for health checking and failure injection.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from datetime import datetime

app = FastAPI(title="ClawOps Target Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("logs", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/app.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# Shared mutable state (simulates service state)
service_state = {
    "healthy": True,
    "failure_type": None,
    "injected_at": None,
}

FAILURE_LOG_TEMPLATES = {
    "null_pointer": [
        "ERROR - Unhandled exception in request handler",
        "ERROR - Traceback (most recent call last):",
        "ERROR -   File \"app/broken_module.py\", line 18, in process_user_data",
        "ERROR -     result = user_data.get('name')",
        "ERROR - AttributeError: 'NoneType' object has no attribute 'get'",
    ],
    "sql_error": [
        "ERROR - Database query failed",
        "ERROR - Traceback (most recent call last):",
        "ERROR -   File \"app/database.py\", line 41, in get_user_by_id",
        "ERROR -     cursor.execute('SELECT id, usr_email FROM users WHERE id=?', (user_id,))",
        "ERROR - sqlite3.OperationalError: no such column: usr_email",
    ],
    "infinite_loop": [
        "ERROR - Worker process terminated unexpectedly",
        "ERROR - Traceback (most recent call last):",
        "ERROR -   File \"app/broken_module.py\", line 52, in calculate_stats",
        "ERROR -     while counter != target:",
        "ERROR - MemoryError: Process killed — memory limit exceeded (infinite loop detected)",
    ],
}


def write_failure_logs(failure_type: str):
    lines = FAILURE_LOG_TEMPLATES.get(failure_type, [])
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open("logs/app.log", "a") as f:
        for line in lines:
            f.write(f"{ts} - {line}\n")


@app.get("/")
def root():
    return {"service": "ClawOps Target", "version": "1.0.0"}


@app.get("/health")
def health():
    if not service_state["healthy"]:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "unhealthy",
                "failure_type": service_state["failure_type"],
                "injected_at": service_state["injected_at"],
            },
        )
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/inject/{failure_type}")
def inject_failure(failure_type: str):
    valid = ["null_pointer", "sql_error", "infinite_loop"]
    if failure_type not in valid:
        raise HTTPException(status_code=400, detail=f"Choose: {valid}")
    service_state["healthy"] = False
    service_state["failure_type"] = failure_type
    service_state["injected_at"] = datetime.now().isoformat()
    write_failure_logs(failure_type)
    logger.error(f"FAILURE INJECTED: {failure_type}")
    return {"status": "failure_injected", "type": failure_type}


@app.post("/recover")
def recover():
    service_state["healthy"] = True
    service_state["failure_type"] = None
    service_state["injected_at"] = None
    return {"status": "recovered"}


@app.get("/state")
def state():
    return service_state
