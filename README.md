# ⚡ ClawOps + 🦞 Convos — Autonomous SRE Agent v3.0

An AI-powered autonomous SRE agent that **detects, diagnoses, patches, tests,
redeploys, and documents** production failures — with zero human intervention.

Now with **Convos encrypted group chat integration** — your team gets live
narration of every repair step inside a private, quantum-resistant chat.

---

## 📁 Project Structure

```
clawops/
├── app/
│   ├── main.py            ← Target microservice (FastAPI, port 8000)
│   ├── broken_module.py   ← Bug 1 (null pointer) + Bug 2 (infinite loop)
│   ├── database.py        ← Bug 3 (wrong SQL column)
│   └── __init__.py
│
├── agent/
│   ├── tools.py           ← Tool registry (9 tools)
│   ├── claw_agent.py      ← Autonomous agent brain (6-phase repair cycle)
│   ├── orchestrator.py    ← FastAPI server driving agent (port 8001)
│   ├── convos_bridge.py   ← Convos/XMTP chat bridge (port 8002) ← NEW
│   └── __init__.py
│
├── frontend/
│   └── src/
│       ├── App.jsx        ← Main dashboard with Convos panel
│       └── ConvosPanel.jsx← Convos chat UI component ← NEW
│
├── tests/
│   └── test_broken_module.py
│
├── logs/                  ← Service logs (agent reads these)
├── postmortems/           ← Auto-generated incident reports
├── docker/Dockerfile
│
├── .env                   ← Environment config (XMTP key goes here)
├── requirements.txt
├── SETUP.bat              ← Run once
├── START.bat              ← Run every session
└── STOP.bat               ← Stop everything
```

---

## ✅ Prerequisites

| Tool    | Version | Download |
|---------|---------|----------|
| Python  | 3.11+   | https://www.python.org/downloads/ |
| Node.js | 18+     | https://nodejs.org/ |

> ⚠️ When installing Python, **tick "Add Python to PATH"** on the first screen.

---

## 🚀 STEP-BY-STEP: How to Run

### Step 1 — Extract the zip

Right-click `clawops_final.zip` → Extract All → choose your Desktop

```
Desktop/
└── clawops/        ← open a terminal here
```

### Step 2 — Open a terminal in the folder

- Press `Win + R`, type `cmd`, press Enter
- Type: `cd Desktop\clawops`
- Press Enter

### Step 3 — Run setup (ONE TIME ONLY)

Double-click **`SETUP.bat`** or type in terminal:
```cmd
SETUP.bat
```

This installs all Python and Node.js packages. Takes ~60 seconds.

### Step 4 — Start everything

Double-click **`START.bat`** or type:
```cmd
START.bat
```

This opens **4 terminal windows**:

| Window colour | Service | Port |
|--------------|---------|------|
| 🔴 Red    | Target microservice | 8000 |
| 🟢 Green  | Orchestrator agent  | 8001 |
| 🔵 Cyan   | Convos bridge       | 8002 |
| 🟡 Yellow | React dashboard     | 3000 |

The browser opens automatically at **http://localhost:3000**

### Step 5 — Use the dashboard

You'll see three panels:

```
┌─────────────┬──────────────────────┬─────────────────┐
│  LEFT       │  MIDDLE              │  RIGHT          │
│  Controls   │  Agent Log Stream    │  🦞 Convos Chat │
│  + Pipeline │  (all 6 phases)      │  (type commands)│
└─────────────┴──────────────────────┴─────────────────┘
```

### Step 6 — Run a demo

**Option A — Click the buttons (left panel):**
1. Click **◈ NULL DEREFERENCE** to inject a failure
2. Watch the service ring turn red
3. Watch the agent log stream show all 6 phases
4. Pipeline nodes light up one by one
5. Service goes green → click **☰ VIEW POSTMORTEM**

**Option B — Type in the Convos chat (right panel):**
```
/inject null_pointer
/inject sql_error
/inject infinite_loop
/status
/postmortem
/reset
/help
```

### Step 7 — Stop everything

Double-click **`STOP.bat`** or just close the 4 terminal windows.

---

## 🦞 Convos Integration — Two Modes

### Mode 1: HTTP Demo Mode (default, no setup needed)

The Convos bridge runs on port 8002 automatically. Use it via:
- The chat panel on the right side of the dashboard
- Or directly: `POST http://localhost:8002/chat`

No Convos account needed. Works immediately.

### Mode 2: Real Convos App Integration

To make ClawOps a real participant in a Convos group chat:

1. Download Convos:
   - iOS: https://apps.apple.com/us/app/convos-messenger/id6744776535
   - Android: https://appdistribution.firebase.dev/i/21e11163419efe98

2. Get an XMTP wallet key (any Ethereum private key works)

3. Edit the `.env` file in the project folder:
   ```
   CONVOS_MODE=xmtp
   XMTP_WALLET_KEY=your_private_key_here
   ```

4. Restart `START.bat`

5. The Cyan terminal will show your agent's Convos address — add it to your group!

6. Type commands in the Convos app — ClawOps responds in the group chat.

---

## 🐛 The Three Bugs (What the Agent Fixes)

### Bug 1 — Null Pointer (`broken_module.py` line 18)
```python
# BEFORE: crashes when user_data is None
result = user_data.get("name")   # 💥 AttributeError

# AFTER: agent adds None guard
if user_data is None:
    return {"status": "default", "processed_name": "UNKNOWN"}
result = user_data.get("name", "unknown")
```

### Bug 2 — SQL Mismatch (`database.py` line 41)
```python
# BEFORE: wrong column name
"SELECT id, usr_email FROM users"    # 💥 OperationalError

# AFTER: correct column name
"SELECT id, user_email FROM users"   # ✅ Fixed
```

### Bug 3 — Infinite Loop (`broken_module.py` line 52)
```python
# BEFORE: skips odd numbers → never reaches odd target
counter += 2    # 💥 MemoryError

# AFTER: correct increment
counter += 1    # ✅ Hits every number
```

---

## 💬 Convos Chat Commands

| Command | What it does |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Show current system health |
| `/inject null_pointer` | Inject AttributeError → start repair |
| `/inject sql_error` | Inject OperationalError → start repair |
| `/inject infinite_loop` | Inject MemoryError → start repair |
| `/postmortem` | Show the latest incident report |
| `/reset` | Reset system to healthy state |

---

## 🧪 Run Tests Manually

```cmd
python -m pytest tests/ -v
```

Before agent repairs: some tests FAIL (by design)
After agent repairs: all 8 tests PASS

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| `'python' is not recognized` | Reinstall Python, tick "Add to PATH" |
| `'npm' is not recognized` | Reinstall Node.js, restart terminal |
| Port already in use | Run `STOP.bat`, then `START.bat` |
| Convos panel shows "DEMO MODE" | Normal — bridge is in HTTP mode (still works) |
| Phase tracker stuck | Refresh browser — hot reload fixes it |
| Agent log stops at Phase 4 | Wait ~30 more seconds, Phase 5+6 follow automatically |
| Red terminal shows error | Check Python version is 3.11+ |

---

## 🏆 Why This Wins ClawHack

| Criterion | Implementation |
|-----------|---------------|
| Uses Convos | ✅ Full bridge integration — agent lives in group chat |
| Uses OpenClaw | ✅ All 6 phases run autonomously |
| Technical depth | ✅ Real code patching + XMTP protocol |
| Real-world use case | ✅ SRE on-call alerting (PagerDuty alternative) |
| Demo drama | ✅ Phone chat + web dashboard simultaneously |
| Encrypted privacy | ✅ Quantum-resistant Convos protocol |

---

*ClawOps Neural Agent v3.0 — Built for ClawHack × Convos*
