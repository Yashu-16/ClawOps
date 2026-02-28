import { useState, useEffect, useRef, useCallback } from "react";
import ConvosPanel from "./ConvosPanel.jsx";

const API = "http://localhost:8001";

const FAILURES = [
  { id:"null_pointer",  code:"NE-001", label:"NULL DEREFERENCE",  icon:"◈", file:"broken_module.py", line:18, desc:"NoneType → AttributeError",         tag:"CRITICAL" },
  { id:"sql_error",     code:"DB-002", label:"SCHEMA VIOLATION",  icon:"◆", file:"database.py",      line:41, desc:"Column mismatch → OperationalError", tag:"HIGH"     },
  { id:"infinite_loop", code:"MEM-003",label:"MEMORY OVERFLOW",   icon:"◉", file:"broken_module.py", line:52, desc:"Runaway loop → MemoryError",          tag:"CRITICAL" },
];

const PHASES = [
  { id:"detecting", label:"DETECT",  n:"01" },
  { id:"analyzing", label:"ANALYZE", n:"02" },
  { id:"fixing",    label:"PATCH",   n:"03" },
  { id:"testing",   label:"TEST",    n:"04" },
  { id:"deploying", label:"DEPLOY",  n:"05" },
  { id:"reporting", label:"REPORT",  n:"06" },
  { id:"complete",  label:"HEALED",  n:"✓"  },
];
const PHASE_IDX = Object.fromEntries(PHASES.map((p,i)=>[p.id,i]));

const DEMO_LOGS = (f) => [
  { level:"divider",     msg:"────────────────────────────────────────────────────────────",  phase:"detecting"  },
  { level:"banner",      msg:"  CLAWOPS AGENT  ·  NEURAL REPAIR CYCLE  ·  v2.0",             phase:"detecting"  },
  { level:"divider",     msg:"────────────────────────────────────────────────────────────",  phase:"detecting"  },
  { level:"phase",       msg:"▶  PHASE 1  ·  FAILURE DETECTION",                             phase:"detecting"  },
  { level:"info",        msg:"   Sending probe to /health endpoint …",                        phase:"detecting"  },
  { level:"error",       msg:"   ✗  HTTP 500 received — service is DOWN",                    phase:"detecting"  },
  { level:"info",        msg:"   Initiating autonomous repair sequence …",                   phase:"detecting"  },
  { level:"phase",       msg:"▶  PHASE 2  ·  LOG ANALYSIS",                                  phase:"analyzing"  },
  { level:"info",        msg:"   Ingesting log stream from disk …",                          phase:"analyzing"  },
  { level:"tool",        msg:"   TOOL  analyze_logs( log_path='logs/app.log' )",              phase:"analyzing"  },
  { level:"tool_result", msg:`   ✓  { success: true,  error_count: 4,  failure_type: "${f.id}" }`, phase:"analyzing" },
  { level:"success",     msg:`   Root cause →  ${f.desc}`,                                   phase:"analyzing"  },
  { level:"info",        msg:`   Affected file:  ${f.file}  ·  line ${f.line}`,              phase:"analyzing"  },
  { level:"phase",       msg:"▶  PHASE 3  ·  CODE PATCH",                                    phase:"fixing"     },
  { level:"info",        msg:`   Reading source file:  ${f.file} …`,                         phase:"fixing"     },
  { level:"tool",        msg:`   TOOL  read_file( path='app/${f.file}' )`,                   phase:"fixing"     },
  { level:"tool_result", msg:"   ✓  { success: true,  lines: 58 }",                          phase:"fixing"     },
  { level:"info",        msg:`   Identified bug:  ${f.desc}`,                                phase:"fixing"     },
  { level:"info",        msg:"   Generating minimal targeted patch …",                       phase:"fixing"     },
  { level:"tool",        msg:`   TOOL  write_file( path='app/${f.file}' )`,                  phase:"fixing"     },
  { level:"tool_result", msg:"   ✓  { success: true,  bytes_written: 1842 }",                phase:"fixing"     },
  { level:"success",     msg:"   ✓  Patch written to disk successfully",                     phase:"fixing"     },
  { level:"phase",       msg:"▶  PHASE 4  ·  TEST VALIDATION",                               phase:"testing"    },
  { level:"info",        msg:"   Running pytest test suite … (attempt 1 of 3)",              phase:"testing"    },
  { level:"tool",        msg:"   TOOL  run_tests()",                                          phase:"testing"    },
  { level:"tool_result", msg:"   ✓  { success: true,  passed: 8,  failed: 0,  errors: 0 }",  phase:"testing"    },
  { level:"success",     msg:"   ✓  All 8 tests passing — no regressions detected",          phase:"testing"    },
  { level:"phase",       msg:"▶  PHASE 5  ·  SERVICE RECOVERY & DEPLOYMENT",                 phase:"deploying"  },
  { level:"info",        msg:"   Rebuilding Docker container image …",                       phase:"deploying"  },
  { level:"info",        msg:"   Container build: COMPLETE",                                 phase:"deploying"  },
  { level:"tool",        msg:"   TOOL  restart_service()",                                   phase:"deploying"  },
  { level:"tool_result", msg:'   ✓  { success: true,  message: "Service restarted" }',       phase:"deploying"  },
  { level:"info",        msg:"   Verifying health endpoint …",                               phase:"deploying"  },
  { level:"tool",        msg:"   TOOL  health_check( url='http://localhost:8000/health' )",  phase:"deploying"  },
  { level:"tool_result", msg:'   ✓  { success: true,  status: "healthy",  http: 200 }',      phase:"deploying"  },
  { level:"success",     msg:"   ✓  Service is ONLINE — /health returns HTTP 200",           phase:"deploying"  },
  { level:"phase",       msg:"▶  PHASE 6  ·  POSTMORTEM GENERATION",                         phase:"reporting"  },
  { level:"info",        msg:"   Compiling incident timeline …",                             phase:"reporting"  },
  { level:"info",        msg:"   Documenting root cause and fix applied …",                  phase:"reporting"  },
  { level:"tool",        msg:"   TOOL  generate_postmortem( data={...} )",                   phase:"reporting"  },
  { level:"tool_result", msg:'   ✓  { success: true,  path: "postmortems/postmortem_report.md" }', phase:"reporting" },
  { level:"success",     msg:"   ✓  Postmortem report saved to disk",                        phase:"reporting"  },
  { level:"divider",     msg:"────────────────────────────────────────────────────────────",  phase:"complete"   },
  { level:"complete",    msg:"  ✓  REPAIR COMPLETE  ·  Duration: 0:01:52  ·  Tests: PASS  ·  Service: HEALTHY", phase:"complete" },
  { level:"divider",     msg:"────────────────────────────────────────────────────────────",  phase:"complete"   },
];

/* ── Hex canvas ── */
function HexCanvas({ alarming }) {
  const ref = useRef(null);
  const alRef = useRef(alarming);
  useEffect(()=>{ alRef.current = alarming; },[alarming]);
  useEffect(()=>{
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let raf, t=0;
    const resize=()=>{ canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize(); window.addEventListener("resize",resize);
    const S=38,W=S*Math.sqrt(3),H=S*2;
    const hex=(cx,cy,s)=>{
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const a=Math.PI/180*(60*i-30);
        i===0?ctx.moveTo(cx+s*Math.cos(a),cy+s*Math.sin(a)):ctx.lineTo(cx+s*Math.cos(a),cy+s*Math.sin(a));
      }
      ctx.closePath();
    };
    const nodes=[];
    for(let c=0;c<Math.ceil(window.innerWidth/W)+2;c++)
      for(let r=0;r<Math.ceil(window.innerHeight/(H*.75))+2;r++)
        nodes.push({x:c*W+(r%2)*W/2,y:r*H*.75,ph:Math.random()*Math.PI*2,sp:.003+Math.random()*.005,pulse:Math.random()>.92});
    const draw=()=>{
      t+=.016; ctx.clearRect(0,0,canvas.width,canvas.height);
      const al=alRef.current;
      nodes.forEach(n=>{
        const b=.5+.5*Math.sin(t*n.sp*60+n.ph);
        const glow=n.pulse&&Math.sin(t*1.2+n.ph)>.85;
        const a=al?(.04+b*.07):(.02+b*.03);
        hex(n.x,n.y,S-1.5);
        ctx.strokeStyle=al?`rgba(255,50,50,${a*2.5})`:`rgba(0,255,190,${a})`;
        ctx.lineWidth=glow?1.5:.5; ctx.stroke();
        if(glow){ ctx.beginPath(); ctx.arc(n.x,n.y,2.5,0,Math.PI*2); ctx.fillStyle=al?"rgba(255,80,50,.8)":"rgba(0,255,190,.7)"; ctx.fill(); }
      });
      raf=requestAnimationFrame(draw);
    };
    draw();
    return()=>{ cancelAnimationFrame(raf); window.removeEventListener("resize",resize); };
  },[]);
  return <canvas ref={ref} style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",opacity:.6}}/>;
}

/* ── Pulse ring ── */
function PulseRing({ healthy }) {
  const c=healthy?"rgba(0,255,180,":"rgba(255,60,60,";
  return (
    <div style={{width:96,height:96,position:"relative",flexShrink:0}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{position:"absolute",inset:0,borderRadius:"50%",border:`1px solid ${c}.3)`,animation:`ringX ${1.8+i*.6}s ease-out ${i*.4}s infinite`}}/>
      ))}
      <div style={{position:"absolute",inset:"18%",borderRadius:"50%",
        background:`radial-gradient(circle,${c}.18) 0%,transparent 70%)`,
        border:`2px solid ${c}.65)`,
        boxShadow:`0 0 22px ${c}.3),inset 0 0 22px ${c}.1)`,
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:16,height:16,borderRadius:"50%",
          background:healthy?"#00ffb4":"#ff3c3c",
          boxShadow:healthy?"0 0 16px #00ffb4,0 0 30px rgba(0,255,180,.6)":"0 0 16px #ff3c3c,0 0 30px rgba(255,60,60,.6)",
          animation:healthy?"softBlink 3s ease-in-out infinite":"corePulse .8s ease-in-out infinite"}}/>
      </div>
    </div>
  );
}

/* ── DNA loader ── */
function DNA() {
  return (
    <div style={{display:"flex",gap:3,alignItems:"center",height:22}}>
      {Array.from({length:7}).map((_,i)=>(
        <div key={i} style={{width:4,background:"rgba(0,255,180,.8)",borderRadius:2,
          animation:`dnaW 1s ease-in-out ${i*.1}s infinite alternate`,
          boxShadow:"0 0 6px rgba(0,255,180,.6)"}}/>
      ))}
    </div>
  );
}

/* ── Failure card ── */
function FCard({f,selected,disabled,onClick}) {
  const [hov,setHov]=useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={()=>!disabled&&onClick()}
      style={{position:"relative",overflow:"hidden",padding:"13px 14px",borderRadius:6,
        background:selected?"rgba(0,255,180,.06)":hov?"rgba(0,255,180,.03)":"transparent",
        border:`1px solid ${selected?"rgba(0,255,180,.45)":hov?"rgba(0,255,180,.2)":"rgba(0,255,180,.09)"}`,
        cursor:disabled?"not-allowed":"pointer",opacity:disabled&&!selected?.45:1,
        transition:"all .25s",boxShadow:selected?"0 0 24px rgba(0,255,180,.09)":"none"}}>
      {(selected||hov)&&<div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(0,255,180,.55),transparent)"}}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:22,lineHeight:1,color:selected?"#00ffb4":"#006650",textShadow:selected?"0 0 14px rgba(0,255,180,.9)":"none",transition:"all .3s"}}>{f.icon}</span>
          <div>
            <div style={{fontSize:12,fontWeight:700,letterSpacing:2,fontFamily:"'Share Tech Mono',monospace",color:selected?"#00ffb4":hov?"#80ffdc":"#50b090",transition:"color .2s"}}>{f.label}</div>
            <div style={{fontSize:10,color:"#1a4a38",fontFamily:"'Share Tech Mono',monospace",marginTop:2}}>{f.code}</div>
          </div>
        </div>
        <span style={{fontSize:9,letterSpacing:1.5,padding:"3px 7px",borderRadius:2,fontFamily:"'Share Tech Mono',monospace",fontWeight:700,
          background:f.tag==="CRITICAL"?"rgba(255,60,60,.12)":"rgba(255,160,0,.12)",
          color:f.tag==="CRITICAL"?"#ff6868":"#ffaa00",
          border:`1px solid ${f.tag==="CRITICAL"?"rgba(255,60,60,.35)":"rgba(255,160,0,.35)"}`}}>{f.tag}</span>
      </div>
      <div style={{fontSize:12,color:"#3a7860",fontFamily:"'Share Tech Mono',monospace",marginBottom:4}}>{f.desc}</div>
      <div style={{fontSize:10,color:"#1a4030",fontFamily:"'Share Tech Mono',monospace"}}>📄 {f.file} · line {f.line}</div>
    </div>
  );
}

/* ── Pipeline node ── */
function PNode({p,done,active}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flex:1}}>
      <div style={{width:36,height:36,borderRadius:"50%",position:"relative",
        display:"flex",alignItems:"center",justifyContent:"center",
        background:done?"rgba(0,255,180,.2)":active?"rgba(0,255,180,.12)":"rgba(0,255,180,.03)",
        border:`2px solid ${done?"rgba(0,255,180,.8)":active?"rgba(0,255,180,.65)":"rgba(0,255,180,.14)"}`,
        boxShadow:done?"0 0 12px rgba(0,255,180,.4)":active?"0 0 20px rgba(0,255,180,.6),0 0 40px rgba(0,255,180,.25)":"none",
        transition:"all .4s",animation:active?"nodeB 1.6s ease-in-out infinite":"none"}}>
        <span style={{fontSize:done?13:10,fontFamily:"'Share Tech Mono',monospace",color:done?"#00ffb4":active?"#aaffee":"#1a5040",fontWeight:700}}>{done?"✓":p.n}</span>
        {active&&<div style={{position:"absolute",inset:-5,borderRadius:"50%",border:"1px solid rgba(0,255,180,.28)",animation:"ringX 1.5s ease-out infinite"}}/>}
      </div>
      <span style={{fontSize:8,letterSpacing:1.5,fontFamily:"'Share Tech Mono',monospace",color:done?"#00ffb4":active?"#aaffee":"#1a4030",transition:"color .4s",textAlign:"center"}}>{p.label}</span>
    </div>
  );
}

/* ── Log line ── */
const LS = {
  phase:       {c:"#00ffdd",bg:"rgba(0,255,200,.07)",bl:"rgba(0,255,200,.4)", b:true, sz:15},
  banner:      {c:"#00ffdd",bg:"rgba(0,255,200,.09)",bl:"rgba(0,255,200,.5)", b:true, sz:15},
  divider:     {c:"#0e3a28",bg:"transparent",        bl:"transparent",         b:false,sz:13},
  error:       {c:"#ff7878",bg:"rgba(255,80,80,.07)",bl:"rgba(255,80,80,.5)",  b:false,sz:14},
  warning:     {c:"#ffcc44",bg:"rgba(255,200,0,.06)", bl:"rgba(255,200,0,.4)", b:false,sz:14},
  success:     {c:"#66ffcc",bg:"rgba(0,255,180,.06)", bl:"rgba(0,255,180,.35)",b:false,sz:14},
  complete:    {c:"#00ffdd",bg:"rgba(0,255,200,.09)", bl:"rgba(0,255,200,.5)", b:true, sz:15},
  tool:        {c:"#2a9970",bg:"transparent",         bl:"transparent",        b:false,sz:13},
  tool_result: {c:"#1a7055",bg:"transparent",         bl:"transparent",        b:false,sz:13},
  info:        {c:"#55c499",bg:"transparent",         bl:"transparent",        b:false,sz:14},
};
function LLine({e,idx}) {
  const s=LS[e.level]||LS.info;
  const isBlock=["phase","banner","complete"].includes(e.level);
  return (
    <div style={{display:"flex",gap:14,padding:`${isBlock?9:4}px 22px`,background:s.bg,
      borderLeft:`3px solid ${s.bl}`,animation:"logSlide .18s ease-out both",
      animationDelay:`${Math.min(idx*5,100)}ms`}}>
      <span style={{fontSize:11,color:"#1a5040",fontFamily:"'Share Tech Mono',monospace",paddingTop:2,flexShrink:0,minWidth:60}}>{e.ts}</span>
      <span style={{fontSize:s.sz,color:s.c,fontFamily:"'Share Tech Mono',monospace",fontWeight:s.b?700:500,lineHeight:1.65,wordBreak:"break-all",
        textShadow:s.b?`0 0 14px ${s.c}88`:`0 0 5px ${s.c}22`}}>{e.msg}</span>
    </div>
  );
}

/* ── Postmortem modal ── */
function PMModal({content,onClose}) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,6,4,.94)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"min(860px,94vw)",maxHeight:"86vh",background:"#020e0a",border:"1px solid rgba(0,255,180,.22)",borderRadius:8,display:"flex",flexDirection:"column",boxShadow:"0 0 80px rgba(0,255,180,.07)",overflow:"hidden"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"17px 24px",borderBottom:"1px solid rgba(0,255,180,.09)",background:"rgba(0,255,180,.02)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#00ffb4",boxShadow:"0 0 10px #00ffb4"}}/>
            <span style={{fontSize:13,letterSpacing:3,color:"#00ffdd",fontFamily:"'Share Tech Mono',monospace"}}>INCIDENT POSTMORTEM</span>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#1a5040",cursor:"pointer",fontSize:20}}>✕</button>
        </div>
        <div style={{flex:1,overflow:"auto",padding:"22px 26px"}}>
          <pre style={{fontSize:13,lineHeight:2,margin:0,color:"#55c499",fontFamily:"'Share Tech Mono',monospace",whiteSpace:"pre-wrap"}}>{content}</pre>
        </div>
      </div>
    </div>
  );
}

function demoPM(f) {
  return `# 🛡️ INCIDENT POSTMORTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Date:        ${new Date().toLocaleString()}
  Incident ID: INC-${Date.now().toString().slice(-8)}
  Severity:    P1 — Production Outage
  Status:      ✅ RESOLVED — Autonomous repair completed

TIMELINE
  T+0:00  ❌  Health check failure (HTTP 500)
  T+0:20  🔍  Log stream ingested, root cause confirmed
  T+0:45  🔧  Patch generated and applied to source
  T+1:05  ✅  All 8 tests passing
  T+1:52  💚  Service health restored (HTTP 200)

ROOT CAUSE
  Code:    ${f.code}  ·  Type: ${f.id}
  File:    ${f.file}  ·  line ${f.line}
  Detail:  ${f.desc}

PREVENTIVE RECOMMENDATIONS
  1. Input-validation decorators on all public functions
  2. Schema integrity checks at service startup
  3. Max-iteration guards on all while-loops
  4. Health-check polling interval ≤ 10 seconds
  5. pylint / mypy integrated into CI pipeline

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Auto-generated by ClawOps Neural Agent v2.0`;
}

/* ── Main App ── */
export default function App() {
  const [logs,setLogs]          = useState([]);
  const [phase,setPhase]        = useState("idle");
  const [running,setRunning]    = useState(false);
  const [completed,setCompleted]= useState(false);
  const [success,setSuccess]    = useState(null);
  const [sel,setSel]            = useState(null);
  const [healthy,setHealthy]    = useState(true);
  const [pm,setPm]              = useState(null);
  const [showPM,setShowPM]      = useState(false);
  const [alarming,setAlarming]  = useState(false);
  const [boot,setBoot]          = useState(true);
  const [showConvos,setShowConvos] = useState(true);

  const liRef   = useRef(0);
  const pollRef = useRef(null);
  const endRef  = useRef(null);

  // On page load: reset backend state so dashboard and server are in sync
  useEffect(()=>{
    setTimeout(()=>setBoot(false),1800);
    // Auto-reset backend when browser loads/refreshes
    fetch(`${API}/api/reset`,{method:'POST'}).catch(()=>{});
  },[]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[logs]);

  const stopPoll=useCallback(()=>{
    if(pollRef.current){clearInterval(pollRef.current);pollRef.current=null;}
  },[]);

  const doPoll=useCallback(async()=>{
    try{
      const r=await fetch(`${API}/api/logs?since=${liRef.current}`);
      if(!r.ok) throw new Error();
      const d=await r.json();
      if(d.logs?.length){ setLogs(p=>[...p,...d.logs]); liRef.current+=d.logs.length; }
      setPhase(d.phase||"idle"); setRunning(d.running); setCompleted(d.completed); setSuccess(d.success);
      if(d.completed){
        // Keep polling 6 more times (3 seconds) to catch any final log lines
        // before fully stopping — prevents cutting off Phase 5/6 logs
        let sweeps = 0;
        const finalSweep = setInterval(async()=>{
          sweeps++;
          try{
            const r2=await fetch(`${API}/api/logs?since=${liRef.current}`);
            const d2=await r2.json();
            if(d2.logs?.length){ setLogs(p=>[...p,...d2.logs]); liRef.current+=d2.logs.length; }
            if(d2.phase) setPhase(d2.phase);
          }catch{}
          if(sweeps>=6){
            clearInterval(finalSweep);
            stopPoll();
            if(d.success) setHealthy(true);
            const pmr=await(await fetch(`${API}/api/postmortem`)).json();
            if(pmr.available) setPm(pmr.content);
          }
        },500);
      }
    }catch{}
  },[stopPoll]);

  const triggerDemo=useCallback((failure)=>{
    const entries=DEMO_LOGS(failure);
    setRunning(true);
    entries.forEach((entry,i)=>{
      setTimeout(()=>{
        const ts=new Date().toLocaleTimeString("en-US",{hour12:false});
        setLogs(p=>[...p,{...entry,ts}]);
        setPhase(entry.phase);
        if(i===entries.length-1){
          setRunning(false); setCompleted(true); setSuccess(true);
          setHealthy(true); setAlarming(false); setPm(demoPM(failure));
        }
      }, i*300);
    });
  },[]);

  const trigger=useCallback(async(id)=>{
    stopPoll();
    const failure=FAILURES.find(f=>f.id===id);
    setSel(id); setLogs([]); liRef.current=0;
    setCompleted(false); setSuccess(null); setPm(null); setShowPM(false);
    setHealthy(false); setAlarming(true);
    setTimeout(()=>setAlarming(false),2400);
    try{
      const r=await fetch(`${API}/api/trigger/${id}`,{method:"POST"});
      if(!r.ok) throw new Error();
      setRunning(true); pollRef.current=setInterval(doPoll,500);
    }catch{ triggerDemo(failure); }
  },[stopPoll,doPoll,triggerDemo]);

  const reset=useCallback(async()=>{
    stopPoll();
    try{await fetch(`${API}/api/reset`,{method:"POST"});}catch{}
    setLogs([]); liRef.current=0;
    setPhase("idle"); setRunning(false); setCompleted(false);
    setSuccess(null); setSel(null); setHealthy(true); setPm(null); setShowPM(false);
  },[stopPoll]);

  const ci=PHASE_IDX[phase]??-1;
  const af=FAILURES.find(f=>f.id===sel);

  return (
    <div style={{minHeight:"100vh",background:"#00080a",fontFamily:"'Share Tech Mono',monospace",color:"#55c499",overflow:"hidden",position:"relative"}}>
      <HexCanvas alarming={alarming}/>
      <div style={{position:"fixed",inset:0,zIndex:1,pointerEvents:"none",
        background:"radial-gradient(ellipse 80% 70% at 50% 40%,transparent 30%,rgba(0,6,4,.75) 100%)"}}/>

      {/* Boot */}
      {boot&&(
        <div style={{position:"fixed",inset:0,zIndex:5000,background:"#00080a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:22,animation:"bootFade .5s ease-out 1.3s both"}}>
          <div style={{fontSize:56,color:"#00ffb4",textShadow:"0 0 32px rgba(0,255,180,.9)",animation:"bootPulse .8s ease-in-out infinite alternate"}}>⚡</div>
          <div style={{fontSize:18,letterSpacing:10,color:"#00ffb4",textShadow:"0 0 22px rgba(0,255,180,.6)"}}>CLAWOPS</div>
          <div style={{fontSize:12,letterSpacing:5,color:"#1a5040"}}>INITIALISING NEURAL SYSTEMS…</div>
          <div style={{display:"flex",gap:8,marginTop:6}}>
            {[0,1,2,3,4].map(i=>(
              <div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#00ffb4",boxShadow:"0 0 10px #00ffb4",animation:`bootDots 1s ease-in-out ${i*.15}s infinite alternate`}}/>
            ))}
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{position:"relative",zIndex:100,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 28px",height:62,borderBottom:"1px solid rgba(0,255,180,.08)",background:"rgba(0,6,4,.9)",backdropFilter:"blur(12px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:26,filter:"drop-shadow(0 0 14px rgba(0,255,180,.9))",color:"#00ffb4"}}>⚡</span>
          <div>
            <div style={{fontSize:21,fontWeight:700,letterSpacing:6,color:"#00ffdd",textShadow:"0 0 20px rgba(0,255,200,.5)",lineHeight:1}}>CLAWOPS</div>
            <div style={{fontSize:9,letterSpacing:4,color:"#0d4535",lineHeight:1.5}}>AUTONOMOUS SRE NEURAL AGENT</div>
          </div>
          <div style={{width:1,height:34,background:"rgba(0,255,180,.12)",marginLeft:6}}/>
          <div style={{fontSize:10,letterSpacing:2,color:"#0a3a28"}}>v2.0</div>
          {/* Convos badge */}
          <div style={{marginLeft:8,padding:"4px 10px",border:"1px solid rgba(0,255,180,.2)",borderRadius:3,background:"rgba(0,255,180,.04)",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:14}}>🦞</span>
            <span style={{fontSize:9,letterSpacing:2,color:"#00ffb4"}}>CONVOS</span>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:healthy?"#00ffb4":"#ff4040",boxShadow:healthy?"0 0 10px #00ffb4":"0 0 10px #ff4040",animation:healthy?"softBlink 3s ease-in-out infinite":"corePulse .7s ease-in-out infinite"}}/>
            <span style={{fontSize:14,letterSpacing:3,color:healthy?"#00ffdd":"#ff5555",textShadow:`0 0 12px ${healthy?"rgba(0,255,200,.5)":"rgba(255,64,64,.5)"}`}}>
              {healthy?"SYSTEM NOMINAL":"SYSTEM FAILURE"}
            </span>
          </div>
          {running&&<div style={{display:"flex",alignItems:"center",gap:7}}><DNA/><span style={{fontSize:10,letterSpacing:2,color:"#1a8070"}}>AGENT ACTIVE</span></div>}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {/* Toggle Convos panel */}
          <button onClick={()=>setShowConvos(p=>!p)}
            style={{padding:"7px 14px",background:showConvos?"rgba(0,255,180,.08)":"rgba(0,255,180,.03)",border:`1px solid ${showConvos?"rgba(0,255,180,.35)":"rgba(0,255,180,.12)"}`,borderRadius:4,color:showConvos?"#00ffdd":"#1a6050",fontSize:10,letterSpacing:2,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",transition:"all .2s"}}>
            🦞 {showConvos?"HIDE CHAT":"SHOW CHAT"}
          </button>
          {(running||completed)&&(
            <button onClick={reset}
              style={{padding:"7px 16px",background:"rgba(0,255,180,.04)",border:"1px solid rgba(0,255,180,.16)",borderRadius:4,color:"#1a6050",fontSize:10,letterSpacing:2,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",transition:"all .2s"}}
              onMouseEnter={e=>e.currentTarget.style.color="#00ffb4"}
              onMouseLeave={e=>e.currentTarget.style.color="#1a6050"}>
              ↺ RESET
            </button>
          )}
          <div style={{padding:"6px 12px",border:"1px solid rgba(0,255,180,.08)",borderRadius:4,fontSize:10,letterSpacing:2,color:"#0a3028"}}>
            {new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
          </div>
        </div>
      </header>

      {/* ── BODY: sidebar + log + convos ── */}
      <div style={{
        display:"grid",
        gridTemplateColumns:showConvos?"280px 1fr 320px":"280px 1fr",
        height:"calc(100vh - 62px)",
        position:"relative",zIndex:10,
        transition:"grid-template-columns .3s ease",
      }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{borderRight:"1px solid rgba(0,255,180,.07)",background:"rgba(0,4,3,.68)",backdropFilter:"blur(6px)",overflowY:"auto",display:"flex",flexDirection:"column"}}>

          <div style={{padding:"20px 18px 16px",borderBottom:"1px solid rgba(0,255,180,.06)",display:"flex",alignItems:"center",gap:16}}>
            <PulseRing healthy={healthy}/>
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:"#0a3028",marginBottom:5}}>TARGET SERVICE</div>
              <div style={{fontSize:16,fontWeight:700,letterSpacing:2,color:healthy?"#00ffdd":"#ff5555",textShadow:`0 0 12px ${healthy?"rgba(0,255,200,.5)":"rgba(255,80,80,.5)"}`,transition:"all .4s"}}>
                {healthy?"ONLINE":"OFFLINE"}
              </div>
              <div style={{fontSize:10,color:"#0a3028",marginTop:3}}>localhost:8000</div>
              {completed&&<div style={{marginTop:8,fontSize:11,color:success?"#66ffcc":"#ff7070"}}>{success?"✓ HEALED AUTONOMOUSLY":"✗ REPAIR FAILED"}</div>}
            </div>
          </div>

          <div style={{padding:"16px 14px 0"}}>
            <div style={{fontSize:9,letterSpacing:4,color:"#0a3028",marginBottom:11,paddingBottom:7,borderBottom:"1px solid rgba(0,255,180,.05)"}}>INJECT FAILURE</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {FAILURES.map(f=><FCard key={f.id} f={f} selected={sel===f.id} disabled={running} onClick={()=>trigger(f.id)}/>)}
            </div>
          </div>

          <div style={{padding:"16px 14px 0"}}>
            <div style={{fontSize:9,letterSpacing:4,color:"#0a3028",marginBottom:13,paddingBottom:7,borderBottom:"1px solid rgba(0,255,180,.05)"}}>NEURAL REPAIR PIPELINE</div>
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",top:17,left:18,right:18,height:1,background:"rgba(0,255,180,.06)"}}/>
              <div style={{position:"absolute",top:17,left:18,height:1,
                background:"rgba(0,255,180,.3)",
                width:ci<0?"0%":`${(ci/(PHASES.length-1))*87}%`,
                transition:"width .6s ease",boxShadow:"0 0 6px rgba(0,255,180,.4)"}}/>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                {PHASES.map((p,i)=><PNode key={p.id} p={p} done={ci>i} active={ci===i&&running}/>)}
              </div>
            </div>
          </div>

          {completed&&(
            <div style={{margin:"16px 14px 0",padding:"14px",border:"1px solid rgba(0,255,180,.1)",borderRadius:6,background:"rgba(0,255,180,.025)"}}>
              <div style={{fontSize:9,letterSpacing:4,color:"#0a3028",marginBottom:11}}>INCIDENT SUMMARY</div>
              {[
                {k:"OUTCOME",   v:success?"✓ RESOLVED":"✗ FAILED",   c:success?"#00ffdd":"#ff5555"},
                {k:"LOG LINES", v:`${logs.length}`,                    c:"#55c499"},
                {k:"ERROR CODE",v:af?.code||"—",                       c:"#55c499"},
                {k:"FILE",      v:af?.file||"—",                       c:"#55c499"},
              ].map(r=>(
                <div key={r.k} style={{display:"flex",justifyContent:"space-between",marginBottom:7,alignItems:"baseline"}}>
                  <span style={{fontSize:9,letterSpacing:2,color:"#0a3028"}}>{r.k}</span>
                  <span style={{fontSize:11,color:r.c,fontWeight:700}}>{r.v}</span>
                </div>
              ))}
              {pm&&(
                <button onClick={()=>setShowPM(true)} style={{marginTop:10,width:"100%",padding:"10px 0",background:"rgba(0,255,180,.06)",border:"1px solid rgba(0,255,180,.24)",borderRadius:4,color:"#00ffdd",fontSize:10,letterSpacing:3,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace"}}>
                  ☰  VIEW POSTMORTEM
                </button>
              )}
            </div>
          )}

          <div style={{flex:1}}/>
          <div style={{padding:"10px 14px",borderTop:"1px solid rgba(0,255,180,.04)",fontSize:9,color:"#061810",letterSpacing:2,textAlign:"center"}}>
            CLAWOPS  ·  AUTONOMOUS SRE  ·  CONVOS
          </div>
        </div>

        {/* ── MIDDLE: LOG STREAM ── */}
        <div style={{display:"flex",flexDirection:"column",overflow:"hidden",borderRight:showConvos?"1px solid rgba(0,255,180,.07)":"none"}}>
          <div style={{padding:"13px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(0,255,180,.07)",background:"rgba(0,4,3,.48)",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <span style={{fontSize:10,letterSpacing:4,color:"#0a3028"}}>AGENT REASONING STREAM</span>
              {sel&&<><div style={{width:1,height:13,background:"rgba(0,255,180,.12)"}}/><span style={{fontSize:11,color:"#1a6050",letterSpacing:1}}>{af?.label}</span></>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {running&&<DNA/>}
              {phase!=="idle"&&(
                <div style={{padding:"4px 10px",border:"1px solid rgba(0,255,180,.17)",borderRadius:3,fontSize:10,letterSpacing:2,color:completed&&success?"#00ffdd":running?"#aaffee":"#55c499",background:"rgba(0,255,180,.04)"}}>
                  {phase.toUpperCase()}
                </div>
              )}
              <span style={{fontSize:10,color:"#0a3028",letterSpacing:1,minWidth:80,textAlign:"right"}}>
                {running?"● STREAMING":completed?`${logs.length} LINES`:"IDLE"}
              </span>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",paddingTop:6,paddingBottom:16}}>
            {logs.length===0?(
              <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,opacity:.4}}>
                <div style={{width:80,height:80,borderRadius:"50%",border:"1px solid rgba(0,255,180,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,color:"#0a3028"}}>⚡</div>
                <div style={{fontSize:12,letterSpacing:4,color:"#0a3028",textAlign:"center"}}>NEURAL AGENT STANDING BY</div>
                <div style={{fontSize:10,color:"#061810",letterSpacing:2,textAlign:"center"}}>SELECT A FAILURE TYPE OR USE THE CONVOS CHAT →</div>
              </div>
            ):(
              logs.map((e,i)=><LLine key={i} e={e} idx={i}/>)
            )}
            <div ref={endRef}/>
          </div>
        </div>

        {/* ── RIGHT: CONVOS CHAT ── */}
        {showConvos&&(
          <div style={{overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <ConvosPanel/>
          </div>
        )}
      </div>

      {showPM&&pm&&<PMModal content={pm} onClose={()=>setShowPM(false)}/>}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#00080a;overflow:hidden;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(0,255,180,.15);border-radius:2px;}
        @keyframes ringX    {0%{transform:scale(1);opacity:.6}100%{transform:scale(2.2);opacity:0}}
        @keyframes corePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.45)}}
        @keyframes nodeB    {0%,100%{box-shadow:0 0 20px rgba(0,255,180,.5),0 0 40px rgba(0,255,180,.22)}50%{box-shadow:0 0 32px rgba(0,255,180,.8),0 0 64px rgba(0,255,180,.35)}}
        @keyframes dnaW     {0%{height:3px;opacity:.3}100%{height:19px;opacity:1}}
        @keyframes softBlink{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes logSlide {from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes bootFade {to{opacity:0;pointer-events:none}}
        @keyframes bootPulse{from{text-shadow:0 0 22px rgba(0,255,180,.5)}to{text-shadow:0 0 44px rgba(0,255,180,1),0 0 66px rgba(0,255,180,.5)}}
        @keyframes bootDots {from{transform:translateY(0);opacity:.3}to{transform:translateY(-8px);opacity:1}}
      `}</style>
    </div>
  );
}
