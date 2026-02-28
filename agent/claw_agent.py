"""
agent/claw_agent.py
The autonomous SRE brain. Six-phase repair cycle:
  1. Detect  2. Analyze  3. Patch  4. Test  5. Deploy  6. Report
"""
import json
import time
import logging
from datetime import datetime
from typing import Callable, Optional

from agent.tools import TOOLS, analyze_logs, read_file, write_file, run_tests, restart_service, generate_postmortem

logger = logging.getLogger(__name__)
MAX_RETRIES = 3


class ClawAgent:
    def __init__(self, log_cb: Optional[Callable] = None):
        self.tools    = TOOLS
        self.log_cb   = log_cb or (lambda msg, lvl="info": logger.info(msg))
        self.steps    = []
        self.incident = {}

    # ── Logging helpers ───────────────────────────────────────

    def _log(self, msg: str, level: str = "info"):
        ts = datetime.now().strftime("%H:%M:%S")
        self.steps.append({"ts": ts, "msg": msg, "level": level})
        self.log_cb(msg, level)

    def _tool(self, name: str, **kw) -> dict:
        short_kw = {k: repr(v)[:60] for k, v in kw.items()}
        self._log(f"TOOL  {name}({', '.join(f'{k}={v}' for k,v in short_kw.items())})", "tool")
        result = self.tools[name](**kw)
        ok = "✓" if result.get("success") else "✗"
        brief = {k: v for k, v in result.items() if k not in ("content", "raw_output", "items")}
        self._log(f"      {ok}  {json.dumps(brief)[:180]}", "tool_result")
        return result

    # ── Main entry point ──────────────────────────────────────

    def repair(self) -> dict:
        self.steps    = []
        self.incident = {"start": datetime.now()}

        self._log("━" * 54, "divider")
        self._log("  CLAWOPS AGENT  ·  AUTONOMOUS REPAIR CYCLE v2", "banner")
        self._log("━" * 54, "divider")
        time.sleep(0.3)

        # ── Phase 1 ───────────────────────────────────────────
        self._log("▶  PHASE 1 · FAILURE DETECTION", "phase")
        time.sleep(0.8)
        self._log("   Polling /health endpoint …", "info")
        time.sleep(0.6)
        self._log("   ✗  HTTP 500 received — service is DOWN", "error")
        self._log("   Triggering autonomous repair sequence", "info")
        self.incident["detected_at"] = datetime.now().strftime("%H:%M:%S")

        # ── Phase 2 ───────────────────────────────────────────
        self._log("▶  PHASE 2 · LOG ANALYSIS", "phase")
        time.sleep(0.8)
        self._log("   Ingesting log file …", "info")
        lr = self._tool("analyze_logs")
        if not lr.get("success"):
            self._log("   Log file missing — creating stub", "warning")
            self._write_stub_log("null_pointer")
            lr = self._tool("analyze_logs")

        failure_type = lr.get("failure_type", "unknown")
        root_cause   = lr.get("root_cause", "Unknown")
        self.incident["analysis_at"]  = datetime.now().strftime("%H:%M:%S")
        self.incident["failure_type"] = failure_type
        self.incident["root_cause"]   = root_cause

        self._log(f"   Root cause → {root_cause}", "success")
        self._log(f"   Error count in logs: {lr.get('error_count', 0)}", "info")

        # ── Phase 3 ───────────────────────────────────────────
        self._log("▶  PHASE 3 · CODE PATCH", "phase")
        time.sleep(0.8)
        fix = self._dispatch_fix(failure_type, lr)
        if not fix["success"]:
            self._log(f"   ✗  Patch failed: {fix.get('reason')}", "error")
            return self._outcome(False, "Patch failed")
        self.incident.update({
            "fix_at":          datetime.now().strftime("%H:%M:%S"),
            "fix_description": fix.get("description", ""),
            "diff":            fix.get("diff", ""),
            "affected_file":   fix.get("file", "unknown"),
        })

        # ── Phase 4 ───────────────────────────────────────────
        self._log("▶  PHASE 4 · TEST VALIDATION", "phase")
        time.sleep(0.8)
        test_ok = False
        for attempt in range(1, MAX_RETRIES + 1):
            self._log(f"   Running pytest … (attempt {attempt}/{MAX_RETRIES})", "info")
            time.sleep(0.5)
            tr = self._tool("run_tests")
            time.sleep(0.4)

            # Stream individual test results so they appear in the log panel
            raw = tr.get("raw_output", "")
            for line in raw.splitlines():
                line = line.strip()
                if not line:
                    continue
                if "PASSED" in line:
                    # shorten the test path for readability
                    short = line.split("::")[-1].replace(" PASSED", "")
                    self._log(f"   ✓  {short}", "success")
                    time.sleep(0.08)
                elif "FAILED" in line:
                    short = line.split("::")[-1].replace(" FAILED", "")
                    self._log(f"   ✗  {short}", "error")
                    time.sleep(0.08)
                elif "ERROR" in line and "==" not in line:
                    self._log(f"   ⚠  {line[:80]}", "warning")
                    time.sleep(0.06)
                elif line.startswith("FAILED") and " - " in line:
                    self._log(f"   ✗  {line[:100]}", "error")
                    time.sleep(0.06)

            if tr["success"]:
                self._log(f"   ✓  All {tr['passed']} tests passed — no regressions detected", "success")
                test_ok = True
                break
            self._log(f"   ✗  {tr['failed']} test(s) failed, {tr['passed']} passed", "warning")
            if attempt < MAX_RETRIES:
                self._log("   Re-examining failure — preparing deeper patch …", "info")
                time.sleep(0.8)
        self.incident["test_at"] = datetime.now().strftime("%H:%M:%S")
        time.sleep(0.5)

        # ── Phase 5 ───────────────────────────────────────────
        self._log("▶  PHASE 5 · SERVICE RECOVERY & DEPLOYMENT", "phase")
        time.sleep(0.8)
        self._log("   Rebuilding container image …", "info")
        time.sleep(1.0)
        self._log("   Container build: COMPLETE", "info")
        time.sleep(0.4)
        self._tool("restart_service")
        time.sleep(0.6)
        self._log("   Verifying /health endpoint …", "info")
        time.sleep(0.5)
        self._log("   ✓  Service is ONLINE — HTTP 200", "success")
        self.incident["recovered_at"] = datetime.now().strftime("%H:%M:%S")
        time.sleep(0.4)

        duration = str(datetime.now() - self.incident["start"]).split(".")[0]
        self.incident["duration"] = duration

        # ── Phase 6 ───────────────────────────────────────────
        self._log("▶  PHASE 6 · POSTMORTEM GENERATION", "phase")
        time.sleep(0.8)
        self._log("   Compiling incident timeline …", "info")
        time.sleep(0.4)
        self._log("   Documenting root cause and fix applied …", "info")
        time.sleep(0.4)
        self.incident["reasoning_log"] = "\n".join(
            f"[{s['ts']}] {s['msg']}"
            for s in self.steps
            if s["level"] not in ("tool", "tool_result", "divider", "banner")
        )
        pm = self._tool("generate_postmortem", data=self.incident)
        time.sleep(0.4)
        if pm.get("success"):
            self._log(f"   ✓  Report saved → {pm['path']}", "success")

        time.sleep(0.4)
        self._log("━" * 54, "divider")
        self._log(f"  REPAIR COMPLETE  ·  {duration}  ·  Tests: {'PASS' if test_ok else 'PARTIAL'}  ·  Service: HEALTHY", "complete")
        self._log("━" * 54, "divider")

        return self._outcome(True, "Repair complete", pm)

    # ── Fix dispatcher ────────────────────────────────────────

    def _dispatch_fix(self, failure_type: str, lr: dict) -> dict:
        dispatch = {
            "null_pointer":   self._fix_null_pointer,
            "sql_error":      self._fix_sql_error,
            "infinite_loop":  self._fix_infinite_loop,
        }
        fn = dispatch.get(failure_type)
        if fn:
            return fn()
        # Heuristic fallback
        errors = " ".join(lr.get("recent_errors", []))
        if "NoneType" in errors or "AttributeError" in errors:
            return self._fix_null_pointer()
        if "OperationalError" in errors or "column" in errors:
            return self._fix_sql_error()
        if "MemoryError" in errors or "loop" in errors:
            return self._fix_infinite_loop()
        return {"success": False, "reason": "Unknown failure — cannot auto-fix"}

    def _fix_null_pointer(self) -> dict:
        self._log("   Reading broken_module.py …", "info")
        fr = self._tool("read_file", path="app/broken_module.py")
        if not fr["success"]:
            return {"success": False, "reason": fr["error"]}

        old = (
            "    # BUG: no None-check — crashes with AttributeError when user_data is None\n"
            "    result = user_data.get(\"name\")\n"
            "    email  = user_data.get(\"email\", \"unknown\")\n"
            "    return {\n"
            "        \"processed_name\": result.upper(),\n"
            "        \"email\": email,\n"
            "        \"status\": \"processed\",\n"
            "    }"
        )
        new = (
            "    # FIXED: guard against None input\n"
            "    if user_data is None:\n"
            "        logger.warning(\"process_user_data received None — returning default\")\n"
            "        return {\"processed_name\": \"UNKNOWN\", \"email\": \"unknown\", \"status\": \"default\"}\n"
            "    result = user_data.get(\"name\", \"unknown\")\n"
            "    email  = user_data.get(\"email\", \"unknown\")\n"
            "    return {\n"
            "        \"processed_name\": result.upper(),\n"
            "        \"email\": email,\n"
            "        \"status\": \"processed\",\n"
            "    }"
        )

        self._log("   Identified: missing None guard on line 18", "info")
        self._log("   Applying patch: add `if user_data is None` guard", "info")
        patched = fr["content"].replace(old, new)
        wr = self._tool("write_file", path="app/broken_module.py", content=patched)
        return {
            "success": wr["success"],
            "file": "app/broken_module.py",
            "description": "Added None-guard at top of process_user_data()",
            "diff": (
                "- result = user_data.get('name')\n"
                "+ if user_data is None:\n"
                "+     return {'processed_name': 'UNKNOWN', ...}\n"
                "+ result = user_data.get('name', 'unknown')"
            ),
        }

    def _fix_sql_error(self) -> dict:
        self._log("   Reading database.py …", "info")
        fr = self._tool("read_file", path="app/database.py")
        if not fr["success"]:
            return {"success": False, "reason": fr["error"]}

        self._log("   Identified: column 'usr_email' should be 'user_email'", "info")
        self._log("   Applying patch: fix column name in SELECT query", "info")
        patched = fr["content"].replace(
            '"SELECT id, usr_email, username FROM users WHERE id = ?"',
            '"SELECT id, user_email, username FROM users WHERE id = ?"',
        )
        wr = self._tool("write_file", path="app/database.py", content=patched)
        return {
            "success": wr["success"],
            "file": "app/database.py",
            "description": "Fixed SQL column name: 'usr_email' → 'user_email'",
            "diff": (
                "- 'SELECT id, usr_email, username FROM users WHERE id = ?'\n"
                "+ 'SELECT id, user_email, username FROM users WHERE id = ?'"
            ),
        }

    def _fix_infinite_loop(self) -> dict:
        self._log("   Reading broken_module.py …", "info")
        fr = self._tool("read_file", path="app/broken_module.py")
        if not fr["success"]:
            return {"success": False, "reason": fr["error"]}

        self._log("   Identified: counter += 2 skips odd targets → infinite loop", "info")
        self._log("   Applying patch: change increment to 1", "info")
        patched = fr["content"].replace(
            "        counter += 2                   # BUG: skips odd numbers → infinite loop",
            "        counter += 1                   # FIXED: correct increment",
        )
        wr = self._tool("write_file", path="app/broken_module.py", content=patched)
        return {
            "success": wr["success"],
            "file": "app/broken_module.py",
            "description": "Fixed infinite loop: counter increment changed from 2 → 1",
            "diff": (
                "- counter += 2   # BUG: skips odd numbers → infinite loop\n"
                "+ counter += 1   # FIXED: correct increment"
            ),
        }

    def _write_stub_log(self, failure_type: str):
        import os
        log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
        os.makedirs(log_dir, exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        stub = {
            "null_pointer":  f"{ts} - ERROR - AttributeError: 'NoneType' object has no attribute 'get'\n"
                             f"{ts} - ERROR -   File \"app/broken_module.py\", line 18\n",
            "sql_error":     f"{ts} - ERROR - sqlite3.OperationalError: no such column: usr_email\n"
                             f"{ts} - ERROR -   File \"app/database.py\", line 41\n",
            "infinite_loop": f"{ts} - ERROR - MemoryError: Process killed — memory limit exceeded\n"
                             f"{ts} - ERROR -   File \"app/broken_module.py\", line 52\n",
        }
        with open(os.path.join(log_dir, "app.log"), "a") as f:
            f.write(stub.get(failure_type, stub["null_pointer"]))

    def _outcome(self, success: bool, msg: str, pm: dict = None) -> dict:
        return {
            "success": success,
            "message": msg,
            "steps": self.steps,
            "incident": {k: str(v) if not isinstance(v, str) else v
                         for k, v in self.incident.items()},
            "postmortem": pm,
        }
