import { useState, useEffect, useRef } from "react";

const BRIDGE_URL = "http://localhost:8002";

const QUICK_CMDS = [
  { label: "/status",            cmd: "/status",              icon: "◉", color: "#00ffb4" },
  { label: "/inject null",       cmd: "/inject null_pointer", icon: "◈", color: "#ff6868" },
  { label: "/inject sql",        cmd: "/inject sql_error",    icon: "◆", color: "#ffaa00" },
  { label: "/inject loop",       cmd: "/inject infinite_loop",icon: "⟳", color: "#ff6868" },
  { label: "/postmortem",        cmd: "/postmortem",          icon: "☰", color: "#00ffb4" },
  { label: "/reset",             cmd: "/reset",               icon: "↺", color: "#aaffee" },
];

export default function ConvosPanel() {
  const [messages, setMessages] = useState([
    {
      from: "clawops",
      text: "⚡  ClawOps Convos Bridge active.\nType a command or use the quick buttons below.\nType /help to see all commands.",
      ts: new Date().toLocaleTimeString("en-US", { hour12: false }),
    },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline]   = useState(false);
  const endRef = useRef(null);

  // Check if bridge is online
  useEffect(() => {
    const check = async () => {
      try {
        await fetch(`${BRIDGE_URL}/chat`);
        setOnline(true);
      } catch {
        setOnline(false);
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const pushMsg = (from, text) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setMessages(p => [...p, { from, text, ts }]);
  };

  const send = async (text) => {
    if (!text.trim() || loading) return;
    pushMsg("user", text);
    setInput("");
    setLoading(true);

    if (!online) {
      // Simulate demo responses when bridge is offline
      await new Promise(r => setTimeout(r, 600));
      pushMsg("clawops", demoResponse(text));
      setLoading(false);
      return;
    }

    try {
      const r = await fetch(`${BRIDGE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const d = await r.json();
      for (const resp of (d.responses || [])) {
        pushMsg("clawops", resp);
        await new Promise(r => setTimeout(r, 300));
      }
    } catch {
      pushMsg("clawops", "⚠️  Bridge offline. Running in demo mode.");
      await new Promise(r => setTimeout(r, 400));
      pushMsg("clawops", demoResponse(text));
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", background: "rgba(0,4,3,.7)",
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid rgba(0,255,180,.08)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(0,6,4,.8)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🦞</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "#00ffdd" }}>CONVOS CHAT</div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#0a3028" }}>ENCRYPTED GROUP BRIDGE</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: online ? "#00ffb4" : "#ff4040",
            boxShadow: online ? "0 0 8px #00ffb4" : "0 0 8px #ff4040",
            animation: online ? "softBlink 3s infinite" : "none",
          }} />
          <span style={{ fontSize: 9, letterSpacing: 2, color: online ? "#00ffb4" : "#ff6060" }}>
            {online ? "BRIDGE ONLINE" : "DEMO MODE"}
          </span>
        </div>
      </div>

      {/* Quick command buttons */}
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid rgba(0,255,180,.06)",
        display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0,
      }}>
        {QUICK_CMDS.map(q => (
          <button key={q.cmd} onClick={() => send(q.cmd)}
            disabled={loading}
            style={{
              padding: "5px 10px", borderRadius: 3,
              background: "rgba(0,255,180,.04)",
              border: `1px solid ${q.color}33`,
              color: q.color, fontSize: 10, letterSpacing: 1,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'Share Tech Mono', monospace",
              opacity: loading ? .5 : 1,
              transition: "all .2s",
              display: "flex", alignItems: "center", gap: 5,
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,255,180,.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(0,255,180,.04)"}
          >
            <span>{q.icon}</span> {q.label}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        {messages.map((m, i) => (
          <ChatBubble key={i} m={m} />
        ))}
        {loading && <TypingDots />}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 14px", borderTop: "1px solid rgba(0,255,180,.07)",
        display: "flex", gap: 8, flexShrink: 0,
        background: "rgba(0,4,3,.8)",
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type a command… /inject, /status, /help"
          disabled={loading}
          style={{
            flex: 1, background: "rgba(0,255,180,.03)",
            border: "1px solid rgba(0,255,180,.15)",
            borderRadius: 4, padding: "10px 14px",
            color: "#66ffcc", fontSize: 13,
            fontFamily: "'Share Tech Mono', monospace",
            outline: "none",
          }}
        />
        <button onClick={() => send(input)} disabled={loading || !input.trim()}
          style={{
            padding: "10px 18px", background: "rgba(0,255,180,.08)",
            border: "1px solid rgba(0,255,180,.3)",
            borderRadius: 4, color: "#00ffdd", fontSize: 12,
            cursor: "pointer", fontFamily: "'Share Tech Mono', monospace",
            opacity: loading || !input.trim() ? .4 : 1,
          }}>
          SEND
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ m }) {
  const isBot = m.from === "clawops";
  return (
    <div style={{
      padding: "6px 16px",
      display: "flex", flexDirection: "column",
      alignItems: isBot ? "flex-start" : "flex-end",
      animation: "logSlide .15s ease-out both",
    }}>
      <div style={{ fontSize: 9, color: "#0a3028", marginBottom: 4, letterSpacing: 1 }}>
        {isBot ? "⚡ CLAWOPS" : "YOU"}  ·  {m.ts}
      </div>
      <div style={{
        maxWidth: "90%", padding: "10px 14px", borderRadius: 6,
        background: isBot ? "rgba(0,255,180,.05)" : "rgba(0,180,140,.08)",
        border: `1px solid ${isBot ? "rgba(0,255,180,.15)" : "rgba(0,200,160,.2)"}`,
        fontSize: 12.5, lineHeight: 1.7,
        color: isBot ? "#66ffcc" : "#aaffee",
        fontFamily: "'Share Tech Mono', monospace",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {m.text}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ padding: "6px 16px", display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 9, color: "#0a3028" }}>⚡ CLAWOPS</span>
      <div style={{ display: "flex", gap: 4, paddingLeft: 8 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#00ffb4", boxShadow: "0 0 5px #00ffb4",
            animation: `bootDots .8s ease-in-out ${i*.2}s infinite alternate`,
          }} />
        ))}
      </div>
    </div>
  );
}

// Demo responses when bridge is offline
function demoResponse(text) {
  const t = text.toLowerCase().trim();
  if (t.includes("status"))
    return "🟢  SERVICE STATUS\n━━━━━━━━━━━━━━━━\nState:   HEALTHY\nPort:    localhost:8000";
  if (t.includes("help"))
    return "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡  CLAWOPS COMMANDS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/status  — system health\n/inject null_pointer\n/inject sql_error\n/inject infinite_loop\n/postmortem — latest report\n/reset — clear state";
  if (t.includes("inject null"))
    return "🔴  FAILURE INJECTED\n━━━━━━━━━━━━━━━━━━\nType: NULL DEREFERENCE\n\n▶ PHASE 1 · DETECTION\n✗  HTTP 500 — service DOWN\n\n▶ PHASE 2 · LOG ANALYSIS\nRoot cause → NoneType.get() on line 18\n\n▶ PHASE 3 · PATCH\n✓  None guard added to broken_module.py\n\n▶ PHASE 4 · TESTS\n✓  8/8 tests passing\n\n▶ PHASE 5 · DEPLOY\n✓  Service restarted — HTTP 200\n\n▶ PHASE 6 · POSTMORTEM\n✓  Report saved\n\n✅ REPAIR COMPLETE\nType /postmortem to read report.";
  if (t.includes("inject sql"))
    return "🔴  FAILURE INJECTED\n━━━━━━━━━━━━━━━━━━\nType: SCHEMA VIOLATION\n\n▶ Phases 1-6 executing…\n\n✓  SQL column fixed: usr_email → user_email\n✓  8/8 tests passing\n✅ REPAIR COMPLETE";
  if (t.includes("inject") && t.includes("loop"))
    return "🔴  FAILURE INJECTED\n━━━━━━━━━━━━━━━━━━\nType: MEMORY OVERFLOW\n\n▶ Phases 1-6 executing…\n\n✓  Loop fixed: counter += 2 → counter += 1\n✓  8/8 tests passing\n✅ REPAIR COMPLETE";
  if (t.includes("postmortem"))
    return "📄  LATEST POSTMORTEM\n━━━━━━━━━━━━━━━━━━━━\nDate: " + new Date().toLocaleString() + "\nStatus: ✅ RESOLVED\n\nRoot cause identified and patched autonomously.\nAll 8 tests passing. Service online.\n\nRun the bridge server for full report.";
  if (t.includes("reset"))
    return "↺  System reset to healthy state.";
  return "❓  Unknown command. Type /help to see available commands.";
}
