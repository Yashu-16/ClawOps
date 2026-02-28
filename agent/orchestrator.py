"""
agent/orchestrator.py
FastAPI server that:
  • exposes REST endpoints consumed by the React dashboard
  • drives ClawAgent in a background thread
  • streams live agent logs via polling
"""
import logging
import os
import sys
import threading
from datetime import datetime

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.claw_agent import ClawAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ClawOps Orchestrator", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Shared state ──────────────────────────────────────────────
state = {
    "running":    False,
    "completed":  False,
    "success":    None,
    "phase":      "idle",
    "logs":       [],          # list of {ts, msg, level}
    "postmortem": None,
    "incident":   None,
}

PHASE_KEYWORDS = {
    "PHASE 1":         "detecting",
    "PHASE 2":         "analyzing",
    "PHASE 3":         "fixing",
    "PHASE 4":         "testing",
    "PHASE 5":         "deploying",
    "PHASE 6":         "reporting",
    "REPAIR COMPLETE": "complete",
    "DONE":            "complete",
}


def _push_log(msg: str, level: str = "info"):
    entry = {"ts": datetime.now().strftime("%H:%M:%S"), "msg": msg, "level": level}
    state["logs"].append(entry)
    for kw, phase in PHASE_KEYWORDS.items():
        if kw in msg:
            state["phase"] = phase
            break


FAILURE_LOGS = {
    "null_pointer": [
        "ERROR - Traceback (most recent call last):",
        "ERROR -   File \"app/broken_module.py\", line 18, in process_user_data",
        "ERROR -     result = user_data.get('name')",
        "ERROR - AttributeError: 'NoneType' object has no attribute 'get'",
    ],
    "sql_error": [
        "ERROR - Traceback (most recent call last):",
        "ERROR -   File \"app/database.py\", line 41, in get_user_by_id",
        "ERROR -     cursor.execute('SELECT id, usr_email FROM users WHERE id=?', (user_id,))",
        "ERROR - sqlite3.OperationalError: no such column: usr_email",
    ],
    "infinite_loop": [
        "ERROR - Traceback (most recent call last):",
        "ERROR -   File \"app/broken_module.py\", line 52, in calculate_stats",
        "ERROR -     while counter != target:",
        "ERROR - MemoryError: Process killed — memory limit exceeded (infinite loop detected)",
    ],
}


def _write_failure_log(failure_type: str):
    log_path = os.path.join(BASE, "logs/app.log")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_path, "w") as f:
        for line in FAILURE_LOGS.get(failure_type, FAILURE_LOGS["null_pointer"]):
            f.write(f"{ts} - {line}\n")


def _run_agent(failure_type: str):
    state["running"]   = True
    state["completed"] = False
    state["logs"]      = []
    state["phase"]     = "starting"
    state["success"]   = None
    state["postmortem"] = None

    try:
        _write_failure_log(failure_type)
        agent  = ClawAgent(log_cb=_push_log)
        result = agent.repair()

        state["success"]  = result["success"]
        state["incident"] = result.get("incident")
        pm = result.get("postmortem")
        if pm and pm.get("success"):
            state["postmortem"] = pm.get("content")
    except Exception as exc:
        logger.exception(exc)
        _push_log(f"FATAL: {exc}", "error")
        state["success"] = False
    finally:
        state["running"]   = False
        state["completed"] = True


# ── Routes ────────────────────────────────────────────────────

@app.get("/api/health")
def api_health():
    return {"status": "ok"}


@app.get("/api/status")
def api_status():
    return state


@app.get("/api/logs")
def api_logs(since: int = 0):
    return {
        "logs":      state["logs"][since:],
        "total":     len(state["logs"]),
        "phase":     state["phase"],
        "running":   state["running"],
        "completed": state["completed"],
        "success":   state["success"],
    }


@app.post("/api/trigger/{failure_type}")
def api_trigger(failure_type: str):
    valid = ["null_pointer", "sql_error", "infinite_loop"]
    if failure_type not in valid:
        return {"error": f"Invalid type. Choose: {valid}"}
    if state["running"]:
        return {"error": "Agent already running"}
    t = threading.Thread(target=_run_agent, args=(failure_type,), daemon=True)
    t.start()
    return {"status": "started", "failure_type": failure_type}


@app.get("/api/postmortem")
def api_postmortem():
    return {"content": state["postmortem"], "available": bool(state["postmortem"])}


@app.post("/api/reset")
def api_reset():
    if state["running"]:
        return {"error": "Cannot reset while agent is running"}
    state.update(running=False, completed=False, success=None,
                 phase="idle", logs=[], postmortem=None, incident=None)
    log_path = os.path.join(BASE, "logs/app.log")
    if os.path.exists(log_path):
        open(log_path, "w").close()
    return {"status": "reset"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
