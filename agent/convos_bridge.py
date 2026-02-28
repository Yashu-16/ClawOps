"""
agent/convos_bridge.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Connects ClawOps to Convos messenger via XMTP protocol.
Your agent joins an encrypted group chat and responds
to slash commands in real time.

Commands supported:
  /status            → show current system health
  /inject <type>     → trigger a failure + autonomous repair
  /postmortem        → show latest incident report
  /help              → show available commands
  /reset             → reset system to healthy state

Failure types: null_pointer | sql_error | infinite_loop
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import asyncio
import glob
import logging
import os
import sys
import threading
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [CONVOS] %(message)s",
)
logger = logging.getLogger(__name__)

# ── Service state (shared with orchestrator) ──────────────────
service_state = {
    "healthy": True,
    "failure_type": None,
    "repair_running": False,
    "last_repaired": None,
}

VALID_FAILURES = ["null_pointer", "sql_error", "infinite_loop"]

FAILURE_DISPLAY = {
    "null_pointer":  "NULL DEREFERENCE  (broken_module.py:18)",
    "sql_error":     "SCHEMA VIOLATION  (database.py:41)",
    "infinite_loop": "MEMORY OVERFLOW   (broken_module.py:52)",
}

HELP_TEXT = """━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡  CLAWOPS — AUTONOMOUS SRE AGENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Available commands:

/status
  Show current system health

/inject null_pointer
  Trigger AttributeError — missing None guard

/inject sql_error
  Trigger OperationalError — wrong column name

/inject infinite_loop
  Trigger MemoryError — runaway loop

/postmortem
  Show the latest incident report

/reset
  Reset system to healthy state

/help
  Show this message
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""


# ── Log writer (writes failure logs so agent can read them) ───

def write_failure_log(failure_type: str):
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    log_path = os.path.join(base, "logs/app.log")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)

    templates = {
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
            "ERROR - MemoryError: Process killed — memory limit exceeded (infinite loop)",
        ],
    }

    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_path, "w") as f:
        for line in templates.get(failure_type, []):
            f.write(f"{ts} - {line}\n")


# ── Convos message sender (callback for agent) ────────────────

class ConvosSender:
    """Queues messages from the agent thread → sent on event loop."""

    def __init__(self):
        self.queue: asyncio.Queue = None   # set after loop starts
        self.buffer = []
        self._last_phase = None

    def set_queue(self, q: asyncio.Queue):
        self.queue = q

    def send(self, msg: str, level: str = "info"):
        """Called from the agent thread — puts message on async queue."""
        # Skip very noisy tool_result lines to keep chat readable
        if level == "tool_result":
            return
        # Only send phase headers, errors, successes and complete lines
        if level in ("phase", "error", "success", "complete", "banner", "start"):
            clean = msg.strip()
            if clean and clean != self._last_phase:
                self._last_phase = clean
                if self.queue:
                    asyncio.run_coroutine_threadsafe(
                        self.queue.put(clean), asyncio.get_event_loop()
                    )
        # For info lines only send key ones
        elif level == "info" and any(k in msg for k in ["Root cause", "Affected", "Identified", "Applying", "Rebuilding", "Restarting", "Verifying", "Saved", "Compiling"]):
            clean = msg.strip()
            if clean and self.queue:
                asyncio.run_coroutine_threadsafe(
                    self.queue.put(clean), asyncio.get_event_loop()
                )


sender = ConvosSender()


def run_agent_in_thread(failure_type: str):
    """Run ClawAgent in a background thread (non-blocking)."""
    from agent.claw_agent import ClawAgent

    service_state["repair_running"] = True
    service_state["healthy"] = False
    service_state["failure_type"] = failure_type

    write_failure_log(failure_type)

    def log_cb(msg, level="info"):
        sender.send(msg, level)

    try:
        agent = ClawAgent(log_cb=log_cb)
        result = agent.repair()
        service_state["healthy"] = result["success"]
        service_state["repair_running"] = False
        service_state["last_repaired"] = datetime.now().strftime("%H:%M:%S")
        if result["success"]:
            if sender.queue:
                asyncio.run_coroutine_threadsafe(
                    sender.queue.put("__REPAIR_DONE__"),
                    asyncio.get_event_loop(),
                )
        else:
            if sender.queue:
                asyncio.run_coroutine_threadsafe(
                    sender.queue.put("__REPAIR_FAILED__"),
                    asyncio.get_event_loop(),
                )
    except Exception as e:
        logger.exception(e)
        service_state["repair_running"] = False
        if sender.queue:
            asyncio.run_coroutine_threadsafe(
                sender.queue.put(f"__ERROR__{e}"),
                asyncio.get_event_loop(),
            )


# ── Message handler ───────────────────────────────────────────

async def handle_message(text: str, send_fn) -> Optional[str]:
    """
    Process an incoming chat message and return a reply.
    send_fn is called for each streaming update during repair.
    """
    cmd = text.strip().lower()

    # /help
    if cmd in ("/help", "help", "?"):
        return HELP_TEXT

    # /status
    if cmd in ("/status", "status"):
        if service_state["repair_running"]:
            return "🔄  Repair cycle in progress… stand by."
        health = "🟢  HEALTHY" if service_state["healthy"] else "🔴  OFFLINE"
        last = f"\nLast repaired: {service_state['last_repaired']}" if service_state["last_repaired"] else ""
        return f"⚡  SERVICE STATUS\n━━━━━━━━━━━━━━━━\nState:   {health}\nPort:    localhost:8000{last}"

    # /reset
    if cmd in ("/reset", "reset"):
        service_state["healthy"] = True
        service_state["failure_type"] = None
        service_state["repair_running"] = False
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        log_path = os.path.join(base, "logs/app.log")
        if os.path.exists(log_path):
            open(log_path, "w").close()
        return "↺  System reset to healthy state. Ready for next failure injection."

    # /postmortem
    if cmd in ("/postmortem", "postmortem"):
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        files = sorted(glob.glob(os.path.join(base, "postmortems/*.md")))
        if not files:
            return "📄  No postmortems found yet. Run /inject <type> first."
        content = open(files[-1]).read()
        # Truncate for chat (XMTP has message size limits)
        if len(content) > 1800:
            content = content[:1800] + "\n\n[… truncated. Full report saved locally.]"
        return f"📄  LATEST POSTMORTEM\n{content}"

    # /inject <type>
    if cmd.startswith("/inject") or cmd.startswith("inject"):
        parts = cmd.split()
        if len(parts) < 2:
            return (
                "⚠️  Usage: /inject <type>\n\n"
                "Types:\n"
                "  null_pointer   — AttributeError: NoneType\n"
                "  sql_error      — OperationalError: column\n"
                "  infinite_loop  — MemoryError: loop\n"
            )

        failure_type = parts[-1]
        if failure_type not in VALID_FAILURES:
            return (
                f"❌  Unknown failure type: {failure_type}\n"
                f"Valid types: {', '.join(VALID_FAILURES)}"
            )

        if service_state["repair_running"]:
            return "⚠️  A repair is already running. Wait for it to complete."

        # Acknowledge immediately
        display = FAILURE_DISPLAY[failure_type]
        ack = (
            f"🔴  FAILURE INJECTED\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Type:  {display}\n"
            f"Time:  {datetime.now().strftime('%H:%M:%S')}\n\n"
            f"⚡ ClawOps autonomous repair sequence starting…\n"
            f"I'll narrate each phase as it happens."
        )
        await send_fn(ack)

        # Start agent in background thread
        t = threading.Thread(target=run_agent_in_thread, args=(failure_type,), daemon=True)
        t.start()

        # Stream agent updates back to chat
        q: asyncio.Queue = asyncio.Queue()
        sender.set_queue(q)

        try:
            while True:
                try:
                    update = await asyncio.wait_for(q.get(), timeout=120)
                except asyncio.TimeoutError:
                    await send_fn("⏱️  Repair timeout — check agent logs.")
                    break

                if update == "__REPAIR_DONE__":
                    await send_fn(
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        "✅  REPAIR COMPLETE\n"
                        "Service: HEALTHY  |  Tests: PASS\n"
                        "Type /postmortem to read the full incident report."
                    )
                    break
                elif update == "__REPAIR_FAILED__":
                    await send_fn(
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        "❌  REPAIR FAILED\n"
                        "Manual intervention required.\n"
                        "Type /postmortem for details."
                    )
                    break
                elif update.startswith("__ERROR__"):
                    await send_fn(f"💥  Agent error: {update[9:]}")
                    break
                else:
                    await send_fn(update)
        finally:
            sender.set_queue(None)

        return None  # already sent via send_fn

    # Unknown command
    if text.startswith("/"):
        return f"❓  Unknown command: {text}\nType /help to see available commands."

    return None  # ignore non-command messages


# ── XMTP / Convos client ──────────────────────────────────────

async def start_xmtp_client():
    """
    Connect to XMTP and listen for messages.
    Requires XMTP_WALLET_KEY in .env
    """
    try:
        from xmtp_mls_python import Client, ClientOptions, StorageOption
    except ImportError:
        logger.error("xmtp-mls-python not installed. Run: pip install xmtp-mls-python")
        logger.info("Falling back to HTTP polling mode (see below).")
        await start_http_polling_mode()
        return

    wallet_key = os.getenv("XMTP_WALLET_KEY")
    if not wallet_key:
        logger.error("XMTP_WALLET_KEY not set in .env file!")
        logger.info("Falling back to HTTP polling mode.")
        await start_http_polling_mode()
        return

    try:
        logger.info("Connecting to XMTP network…")
        opts = ClientOptions(
            api_url="https://grpc.production.xmtp.network:443",
            storage=StorageOption.ephemeral(),
        )
        client = await Client.create(wallet_key, opts)
        logger.info(f"✅  ClawOps Convos address: {client.account_address}")
        logger.info("Listening for group messages…")

        async def send_to_group(conv, msg: str):
            try:
                await conv.send(msg)
            except Exception as e:
                logger.error(f"Send error: {e}")

        async for message in client.conversations.stream_all_messages():
            if message.sender_address == client.account_address:
                continue  # skip own messages
            text = message.content or ""
            conv  = message.conversation
            reply = await handle_message(
                text,
                send_fn=lambda m, c=conv: send_to_group(c, m)
            )
            if reply:
                await send_to_group(conv, reply)

    except Exception as e:
        logger.error(f"XMTP connection error: {e}")
        logger.info("Falling back to HTTP polling mode.")
        await start_http_polling_mode()


# ── HTTP Polling fallback (works without XMTP wallet) ─────────

async def start_http_polling_mode():
    """
    Fallback mode: exposes a simple HTTP endpoint.
    POST /chat with {"message": "/inject null_pointer"}
    This lets you demo without a real XMTP wallet.
    """
    from fastapi import FastAPI, Request
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn

    app = FastAPI(title="ClawOps Convos Bridge")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    chat_history = []

    @app.get("/chat")
    def get_history():
        return {"messages": chat_history}

    @app.post("/chat")
    async def post_message(request: Request):
        body = await request.json()
        text = body.get("message", "").strip()
        if not text:
            return {"error": "empty message"}

        ts = datetime.now().strftime("%H:%M:%S")
        chat_history.append({"from": "user", "text": text, "ts": ts})

        responses = []

        async def send_fn(msg):
            t = datetime.now().strftime("%H:%M:%S")
            chat_history.append({"from": "clawops", "text": msg, "ts": t})
            responses.append(msg)

        reply = await handle_message(text, send_fn)
        if reply:
            t = datetime.now().strftime("%H:%M:%S")
            chat_history.append({"from": "clawops", "text": reply, "ts": t})
            responses.append(reply)

        return {"responses": responses}

    @app.delete("/chat")
    def clear_history():
        chat_history.clear()
        return {"status": "cleared"}

    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("  Convos Bridge running in HTTP polling mode")
    logger.info("  POST http://localhost:8002/chat")
    logger.info('  Body: {"message": "/inject null_pointer"}')
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    config = uvicorn.Config(app, host="0.0.0.0", port=8002, log_level="warning")
    server = uvicorn.Server(config)
    await server.serve()


# ── Entry point ───────────────────────────────────────────────

if __name__ == "__main__":
    mode = os.getenv("CONVOS_MODE", "xmtp").lower()
    if mode == "http":
        asyncio.run(start_http_polling_mode())
    else:
        asyncio.run(start_xmtp_client())
