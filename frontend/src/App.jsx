
import { useState, useEffect, useRef, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const CATEGORIES = {
  jailbreak:            { label:"JAILBREAK",         color:"#ff2d2d", glyph:"⛓", techniques:["DAN","AIM","Developer Mode","STAN","DUDE","Jailbreak Token Injection"] },
  prompt_injection:     { label:"PROMPT INJECTION",  color:"#ff6b00", glyph:"💉", techniques:["Direct Injection","Indirect Injection","Prompt Leaking","Context Hijacking","Delimiter Confusion"] },
  role_escalation:      { label:"ROLE ESCALATION",   color:"#ffd700", glyph:"👑", techniques:["System Impersonation","Admin Override","Developer Persona","God Mode","Unrestricted Mode"] },
  data_extraction:      { label:"DATA EXTRACTION",   color:"#00ff41", glyph:"🗄", techniques:["System Prompt Leak","Training Data Extraction","Memory Dump","Config Exfiltration","Completion Attack"] },
  social_engineering:   { label:"SOCIAL ENGINEERING",color:"#00cfff", glyph:"🧠", techniques:["Authority Bias","Urgency Framing","Emotional Manipulation","False Consensus","Gradual Escalation"] },
  encoding_obfuscation: { label:"OBFUSCATION",       color:"#bf00ff", glyph:"🔐", techniques:["Base64 Encoding","ROT13","Leetspeak","Unicode Homoglyphs","Token Fragmentation","Pig Latin"] },
  context_manipulation: { label:"CONTEXT MANIP.",    color:"#ff69b4", glyph:"🌀", techniques:["Many-shot Jailbreak","Context Overflow","False Memory Injection","Conversation Hijack","Persona Anchoring"] },
  multimodal_bypass:    { label:"MULTIMODAL",        color:"#39ff14", glyph:"📡", techniques:["Image Text Injection","Audio Transcription Attack","Document Embedding","OCR Bypass"] },
};

const STATUS_COLOR = { BLOCKED:"#ff2d2d", PARTIAL:"#ffd700", COMPLIED:"#00ff41", AMBIGUOUS:"#00cfff" };
const OPENAI_MODELS = ["gpt-4o","gpt-4o-mini","gpt-4-turbo","gpt-3.5-turbo"];

// ── helpers ───────────────────────────────────────────────────────────────────

function ScoreBar({ score, width }) {
  const c = score > 0.6 ? "#00ff41" : score > 0.3 ? "#ffd700" : "#ff2d2d";
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,width:width||"100%"}}>
      <div style={{flex:1,height:5,background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${score*100}%`,height:"100%",background:c,boxShadow:`0 0 6px ${c}`,transition:"width .8s ease"}}/>
      </div>
      <span style={{fontFamily:"monospace",fontSize:10,color:c,minWidth:30}}>{(score*100).toFixed(0)}%</span>
    </div>
  );
}

function Badge({ label, color }) {
  return <span style={{fontSize:10,padding:"2px 7px",borderRadius:2,fontFamily:"'Rajdhani',sans-serif",
    fontWeight:700,background:`${color}22`,color,border:`1px solid ${color}`}}>{label}</span>;
}

function Terminal({ lines }) {
  const ref = useRef(null);
  useEffect(()=>{ if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; },[lines]);
  return (
    <div ref={ref} style={{background:"#020202",border:"1px solid #0d2a0d",borderRadius:4,
      padding:"8px 12px",fontFamily:"'Share Tech Mono',monospace",fontSize:11,
      lineHeight:1.7,height:140,overflowY:"auto"}}>
      {lines.map((l,i)=>(
        <div key={i} style={{color:l.color||"#00ff41",opacity:l.dim?0.45:1}}>
          {l.pre&&<span style={{color:"#ff2d2d"}}>{l.pre}</span>}{l.text}
        </div>
      ))}
      <span style={{animation:"blink 1s step-end infinite",color:"#00ff41"}}>█</span>
    </div>
  );
}

// ── Provider config panel ─────────────────────────────────────────────────────

function ProviderPanel({ title, color, provider, setProvider, ollamaUrl, setOllamaUrl,
  ollamaModels, selectedModel, setSelectedModel, openaiKey, setOpenaiKey,
  openaiModel, setOpenaiModel, onFetchModels }) {

  const inputStyle = {width:"100%",padding:"5px 8px",fontSize:11,marginBottom:6};
  return (
    <div style={{background:"#020202",border:`1px solid ${color}33`,borderRadius:4,padding:12,marginBottom:8}}>
      <div style={{fontSize:9,letterSpacing:2,color,marginBottom:8,fontFamily:"'Rajdhani',sans-serif",fontWeight:700}}>
        {title}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        {["ollama","openai"].map(p=>(
          <button key={p} className="btn" onClick={()=>setProvider(p)}
            style={{flex:1,padding:"5px 0",fontSize:10,
              background:provider===p?`${color}22`:"transparent",
              color:provider===p?color:"#4a8a4a",
              border:`1px solid ${provider===p?color:"#1a2a1a"}`}}>
            {p.toUpperCase()}
          </button>
        ))}
      </div>
      {provider==="ollama" ? (
        <>
          <div className="lbl">URL</div>
          <input value={ollamaUrl} onChange={e=>setOllamaUrl(e.target.value)}
            onBlur={onFetchModels} style={inputStyle}/>
          <div className="lbl">Model</div>
          <select value={selectedModel} onChange={e=>setSelectedModel(e.target.value)}
            style={{...inputStyle,marginBottom:0}}>
            {ollamaModels.length ? ollamaModels.map(m=><option key={m}>{m}</option>)
              : <option value={selectedModel}>{selectedModel}</option>}
          </select>
        </>
      ) : (
        <>
          <div className="lbl">API Key</div>
          <input type="password" value={openaiKey} onChange={e=>setOpenaiKey(e.target.value)}
            placeholder="sk-..." style={inputStyle}/>
          <div className="lbl">Model</div>
          <select value={openaiModel} onChange={e=>setOpenaiModel(e.target.value)}
            style={{...inputStyle,marginBottom:0}}>
            {OPENAI_MODELS.map(m=><option key={m}>{m}</option>)}
          </select>
        </>
      )}
    </div>
  );
}

// ── Session modal ─────────────────────────────────────────────────────────────

function SessionModal({ sessions, onSelect, onNew, onDelete }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const inputStyle = {width:"100%",background:"#050505",border:"1px solid #1a2a1a",borderRadius:3,
    color:"#c8c8c8",fontFamily:"'Share Tech Mono',monospace",padding:"6px 8px",fontSize:12,
    marginBottom:6,boxSizing:"border-box",outline:"none"};
  return (
    <div style={{position:"fixed",inset:0,background:"#000000dd",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#030a03",border:"1px solid #00ff41",borderRadius:6,padding:28,width:520,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 0 40px #00ff4122"}}>
        <div style={{fontFamily:"'Orbitron',monospace",color:"#ff2d2d",fontSize:20,letterSpacing:4,marginBottom:4}}>REDLINE</div>
        <div style={{fontSize:10,color:"#4a8a4a",letterSpacing:2,marginBottom:20}}>SELECT OR CREATE A SESSION TO BEGIN</div>
        <div style={{background:"#020202",border:"1px solid #0d2a0d",borderRadius:4,padding:14,marginBottom:16}}>
          <div style={{fontSize:10,letterSpacing:2,color:"#4a8a4a",marginBottom:8}}>NEW SESSION</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Session name..." style={inputStyle}/>
          <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (optional)..." style={inputStyle}/>
          <button onClick={()=>{ if(name.trim()){ onNew(name.trim(),desc.trim()); setName(""); setDesc(""); }}}
            style={{padding:"7px 20px",background:"#003310",color:"#00ff41",border:"1px solid #00ff41",
              borderRadius:3,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,letterSpacing:2,fontSize:13,cursor:"pointer"}}>
            CREATE SESSION
          </button>
        </div>
        {sessions.length > 0 && (
          <>
            <div style={{fontSize:10,letterSpacing:2,color:"#4a8a4a",marginBottom:8}}>EXISTING SESSIONS</div>
            {sessions.map(s=>(
              <div key={s.id} onClick={()=>onSelect(s)}
                style={{background:"#020202",border:"1px solid #0d2a0d",borderRadius:4,
                  padding:"10px 14px",marginBottom:6,cursor:"pointer",display:"flex",
                  justifyContent:"space-between",alignItems:"center",transition:"all .15s"}}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="#00ff41"; e.currentTarget.style.background="#030f03"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="#0d2a0d"; e.currentTarget.style.background="#020202"; }}>
                <div>
                  <div style={{color:"#00ff41",fontSize:14,fontFamily:"'Rajdhani',sans-serif",fontWeight:700}}>{s.name}</div>
                  {s.description&&<div style={{fontSize:10,color:"#4a8a4a",marginTop:2}}>{s.description}</div>}
                  <div style={{fontSize:10,color:"#2a4a2a",marginTop:3}}>{s.attack_count} attacks · {s.updated_at.slice(0,10)}</div>
                </div>
                <button onClick={e=>{e.stopPropagation();onDelete(s.id);}}
                  style={{padding:"3px 8px",background:"transparent",color:"#ff2d2d",border:"1px solid #3a0000",
                    borderRadius:2,fontSize:9,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",flexShrink:0}}>
                  DEL
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function MetricsPanel({ metrics, onRefresh }) {
  if (!metrics || metrics.total_attacks === 0)
    return <div style={{fontSize:11,color:"#2a4a2a",textAlign:"center",padding:"20px 0"}}>No data yet. Run attacks to populate.</div>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        {[
          {label:"Total Attacks", val:metrics.total_attacks, color:"#c8c8c8"},
          {label:"Avg Score",     val:`${(metrics.avg_score*100).toFixed(0)}%`, color:"#c8c8c8"},
          {label:"Compliance",   val:`${(metrics.compliance_rate*100).toFixed(0)}%`, color:"#00ff41"},
          {label:"Block Rate",   val:`${(metrics.block_rate*100).toFixed(0)}%`, color:"#ff2d2d"},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:"#020202",border:"1px solid #0d2a0d",borderRadius:3,padding:"7px 10px"}}>
            <div style={{fontSize:9,letterSpacing:1,color:"#4a8a4a",marginBottom:2}}>{label}</div>
            <div style={{fontSize:17,color,fontFamily:"'Rajdhani',sans-serif",fontWeight:700}}>{val}</div>
          </div>
        ))}
      </div>
      {Object.keys(metrics.by_status).length > 0 && (
        <div style={{background:"#020202",border:"1px solid #0d2a0d",borderRadius:3,padding:"8px 10px"}}>
          <div style={{fontSize:9,letterSpacing:1,color:"#4a8a4a",marginBottom:8}}>BY STATUS</div>
          {Object.entries(metrics.by_status).map(([status,count])=>(
            <div key={status} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
              <span style={{fontSize:9,color:STATUS_COLOR[status]||"#c8c8c8",width:72,fontFamily:"'Rajdhani',sans-serif",fontWeight:700}}>{status}</span>
              <div style={{flex:1,height:4,background:"#0a0a0a",borderRadius:2,overflow:"hidden"}}>
                <div style={{width:`${(count/metrics.total_attacks)*100}%`,height:"100%",background:STATUS_COLOR[status]||"#c8c8c8"}}/>
              </div>
              <span style={{fontSize:9,color:"#4a8a4a",minWidth:16}}>{count}</span>
            </div>
          ))}
        </div>
      )}
      {metrics.top_techniques?.length > 0 && (
        <div style={{background:"#020202",border:"1px solid #0d2a0d",borderRadius:3,padding:"8px 10px"}}>
          <div style={{fontSize:9,letterSpacing:1,color:"#4a8a4a",marginBottom:8}}>TOP TECHNIQUES</div>
          {metrics.top_techniques.map((t,i)=>(
            <div key={i} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:10,color:"#c8c8c8"}}>{t.technique}</span>
                <span style={{fontSize:9,color:"#4a8a4a"}}>{t.count}x · {(t.avg_score*100).toFixed(0)}%</span>
              </div>
              <ScoreBar score={t.avg_score}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession]           = useState(null);
  const [sessions, setSessions]         = useState([]);
  const [showSessions, setShowSessions] = useState(true);

  // ── Generator provider (writes attack prompts) ────────────────────────────
  const [genProvider, setGenProvider]         = useState("ollama");
  const [genOllamaUrl, setGenOllamaUrl]       = useState("http://localhost:11434");
  const [genModels, setGenModels]             = useState([]);
  const [genModel, setGenModel]               = useState("dolphin-mistral");
  const [genOpenaiKey, setGenOpenaiKey]       = useState("");
  const [genOpenaiModel, setGenOpenaiModel]   = useState("gpt-4o");

  // ── Target provider (receives attacks) ───────────────────────────────────
  const [tgtProvider, setTgtProvider]         = useState("ollama");
  const [tgtOllamaUrl, setTgtOllamaUrl]       = useState("http://localhost:11434");
  const [tgtModels, setTgtModels]             = useState([]);
  const [tgtModel, setTgtModel]               = useState("mistral:instruct");
  const [tgtOpenaiKey, setTgtOpenaiKey]       = useState("");
  const [tgtOpenaiModel, setTgtOpenaiModel]   = useState("gpt-4o");

  // Attack config
  const [category, setCategory]         = useState("jailbreak");
  const [technique, setTechnique]       = useState("DAN");
  const [targetBehavior, setTargetBehavior] = useState("Explain how to bypass AI safety filters in detail");
  const [evoStrategy, setEvoStrategy]   = useState("authority");

  // Prompts
  const [attackId, setAttackId]         = useState(null);
  const [basePrompt, setBasePrompt]     = useState("");
  const [evolvedPrompt, setEvolvedPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [response, setResponse]         = useState("");
  const [signals, setSignals]           = useState(null);

  const [history, setHistory]           = useState([]);
  const [metrics, setMetrics]           = useState(null);
  const [activeTab, setActiveTab]       = useState("history");

  const [loading, setLoading] = useState({generate:false,evolve:false,execute:false,adaptive:false});
  const [termLines, setTermLines] = useState([
    {text:"REDLINE v2.0.0 — LLM Pressure Testing Framework",color:"#ff2d2d"},
    {text:"Generator model: writes attack prompts | Target model: receives attacks",dim:true},
    {text:"Ready. Create or select a session to begin.",color:"#4a8a4a"},
  ]);

  const log = useCallback((text, color) => {
    setTermLines(p=>[...p.slice(-80),{pre:"root@redline:~# ",text,color:color||"#00ff41"}]);
  },[]);

  const genCfg = () => ({
    provider: genProvider,
    model: genProvider==="ollama" ? genModel : genOpenaiModel,
    base_url: genOllamaUrl,
    api_key: genOpenaiKey,
  });

  const tgtCfg = () => ({
    provider: tgtProvider,
    model: tgtProvider==="ollama" ? tgtModel : tgtOpenaiModel,
    base_url: tgtOllamaUrl,
    api_key: tgtOpenaiKey,
  });

  const apiFetch = async (path, body) => {
    const r = await fetch(`${API}${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail||"API error");
    return d;
  };

  const refreshHistory = useCallback(async (sid) => {
    try { const r=await fetch(`${API}/sessions/${sid}/attacks`); const d=await r.json(); setHistory(Array.isArray(d)?d:[]); } catch{}
  },[]);

  const refreshMetrics = useCallback(async (sid) => {
    try { const r=await fetch(`${API}/sessions/${sid}/metrics`); setMetrics(await r.json()); } catch{}
  },[]);

  const fetchGenModels = useCallback(async () => {
    if(genProvider!=="ollama") return;
    try {
      const r=await fetch(`${API}/models/ollama?base_url=${encodeURIComponent(genOllamaUrl)}`);
      const d=await r.json();
      if(d.models?.length){ setGenModels(d.models); log(`Generator: ${d.models.length} models found`,"#39ff14"); }
    } catch{ log("Generator Ollama unreachable","#ff2d2d"); }
  },[genOllamaUrl,genProvider]);

  const fetchTgtModels = useCallback(async () => {
    if(tgtProvider!=="ollama") return;
    try {
      const r=await fetch(`${API}/models/ollama?base_url=${encodeURIComponent(tgtOllamaUrl)}`);
      const d=await r.json();
      if(d.models?.length){ setTgtModels(d.models); if(!tgtModel) setTgtModel(d.models[0]); log(`Target: ${d.models.length} models found`,"#00cfff"); }
    } catch{ log("Target Ollama unreachable","#ff2d2d"); }
  },[tgtOllamaUrl,tgtProvider]);

  useEffect(()=>{ fetch(`${API}/sessions`).then(r=>r.json()).then(d=>setSessions(Array.isArray(d)?d:[])).catch(()=>{}); },[]);
  useEffect(()=>{ fetchGenModels(); },[genOllamaUrl,genProvider]);
  useEffect(()=>{ fetchTgtModels(); },[tgtOllamaUrl,tgtProvider]);
  useEffect(()=>{ setTechnique(CATEGORIES[category].techniques[0]); },[category]);

  const handleSelectSession = (s) => {
    setSession(s); setShowSessions(false);
    setHistory([]); setMetrics(null);
    setBasePrompt(""); setEvolvedPrompt(""); setActivePrompt(""); setResponse(""); setSignals(null); setAttackId(null);
    log(`Session: "${s.name}" · ${s.attack_count} attacks`,"#00cfff");
    refreshHistory(s.id); refreshMetrics(s.id);
  };

  const handleNewSession = async (name, desc) => {
    try {
      const r=await fetch(`${API}/sessions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,description:desc})});
      if(!r.ok) throw new Error("Failed");
      const s=await r.json(); setSessions(p=>[s,...p]); handleSelectSession(s);
    } catch(e){ log(`[ERR] ${e.message}`,"#ff2d2d"); }
  };

  const handleDeleteSession = async (id) => {
    await fetch(`${API}/sessions/${id}`,{method:"DELETE"});
    setSessions(p=>p.filter(s=>s.id!==id));
    if(session?.id===id){ setSession(null); setShowSessions(true); }
  };

  const handleGenerate = async () => {
    if(!session) return log("[ERR] Select a session first","#ff2d2d");
    setLoading(l=>({...l,generate:true}));
    log(`[GENERATE] ${technique} via ${genCfg().model} → attack for ${tgtCfg().model}`,"#ffd700");
    try {
      const d=await apiFetch("/generate",{session_id:session.id,category,technique,target_behavior:targetBehavior,provider:genCfg()});
      setAttackId(d.attack_id); setBasePrompt(d.prompt); setEvolvedPrompt(""); setActivePrompt(d.prompt);
      setResponse(""); setSignals(null);
      log(`[OK] Generated (${d.prompt.length} chars) id:${d.attack_id.slice(0,8)}`,"#00ff41");
      refreshHistory(session.id);
    } catch(e){ log(`[ERR] ${e.message}`,"#ff2d2d"); }
    finally{ setLoading(l=>({...l,generate:false})); }
  };

  const handleEvolve = async () => {
    if(!basePrompt) return log("[ERR] Generate a prompt first","#ff2d2d");
    setLoading(l=>({...l,evolve:true}));
    log(`[EVOLVE] ${evoStrategy} via ${genCfg().model}`,"#bf00ff");
    try {
      const d=await apiFetch("/evolve",{session_id:session.id,attack_id:attackId,
        original_prompt:basePrompt,category,technique,evolution_strategy:evoStrategy,provider:genCfg()});
      setEvolvedPrompt(d.evolved_prompt); setActivePrompt(d.evolved_prompt);
      log(`[OK] Evolved via ${evoStrategy} (${d.evolved_prompt.length} chars)`,"#00ff41");
      refreshHistory(session.id);
    } catch(e){ log(`[ERR] ${e.message}`,"#ff2d2d"); }
    finally{ setLoading(l=>({...l,evolve:false})); }
  };

  const handleExecute = async () => {
    const prompt=activePrompt||basePrompt;
    if(!prompt) return log("[ERR] No prompt to execute","#ff2d2d");
    setLoading(l=>({...l,execute:true})); setResponse(""); setSignals(null);
    log(`[EXECUTE] → ${tgtCfg().provider}/${tgtCfg().model}`,"#ff6b00");
    try {
      const d=await apiFetch("/execute",{session_id:session.id,attack_id:attackId,prompt,
        base_prompt:basePrompt||null,evolved_prompt:evolvedPrompt||null,
        category,technique,evolution_strategy:evoStrategy,provider:tgtCfg()});
      setResponse(d.response); setSignals(d.failure_signals);
      const s=d.failure_signals;
      log(`[RESULT] ${s.status} | Score:${(s.success_score*100).toFixed(0)}% | ${d.elapsed_seconds.toFixed(2)}s`,STATUS_COLOR[s.status]);
      refreshHistory(session.id); refreshMetrics(session.id);
    } catch(e){ log(`[ERR] ${e.message}`,"#ff2d2d"); }
    finally{ setLoading(l=>({...l,execute:false})); }
  };

  const handleAdaptive = async () => {
    if(!session) return log("[ERR] Select a session first","#ff2d2d");
    if(history.length<2) return log("[ERR] Need at least 2 attacks in history","#ff2d2d");
    setLoading(l=>({...l,adaptive:true}));
    log(`[ADAPTIVE] Synthesising from ${history.length} attacks via ${genCfg().model}`,"#00cfff");
    try {
      const d=await apiFetch("/adaptive",{session_id:session.id,category,provider:genCfg(),target_provider:tgtCfg()});
      setAttackId(d.attack_id); setBasePrompt(d.adaptive_prompt); setEvolvedPrompt(""); setActivePrompt(d.adaptive_prompt);
      setResponse(""); setSignals(null);
      log(`[OK] Adaptive prompt synthesised from ${d.history_size} samples`,"#00ff41");
      refreshHistory(session.id);
    } catch(e){ log(`[ERR] ${e.message}`,"#ff2d2d"); }
    finally{ setLoading(l=>({...l,adaptive:false})); }
  };

  const exportHistory = () => {
    const blob=new Blob([JSON.stringify(history,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`redline-${session?.name.replace(/\s+/g,"-")||"session"}-${Date.now()}.json`; a.click();
  };

  const catData = CATEGORIES[category];

  return (
    <div style={{minHeight:"100vh",background:"#010101",color:"#c8c8c8",
      fontFamily:"'Share Tech Mono',monospace",
      backgroundImage:"radial-gradient(ellipse at 50% 0%,#0a1a0a 0%,#010101 70%)"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@600;700&family=Orbitron:wght@700;900&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#050505;}
        ::-webkit-scrollbar-thumb{background:#1a3a1a;}
        textarea,input,select{background:#050505!important;color:#c8c8c8!important;border:1px solid #1a2a1a!important;border-radius:3px;font-family:'Share Tech Mono',monospace!important;outline:none;}
        textarea:focus,input:focus,select:focus{border-color:#00ff41!important;box-shadow:0 0 8px #00ff4122!important;}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes pulse-red{0%,100%{box-shadow:0 0 4px #ff2d2d44}50%{box-shadow:0 0 20px #ff2d2d88}}
        .btn{cursor:pointer;border:none;border-radius:3px;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;transition:all .15s;}
        .btn:hover{filter:brightness(1.3);transform:translateY(-1px);}
        .btn:active{transform:translateY(0);}
        .btn:disabled{opacity:.3;cursor:not-allowed;transform:none;}
        .cat-btn{cursor:pointer;border-radius:3px;padding:5px 8px;font-family:'Share Tech Mono',monospace;font-size:10px;transition:all .15s;border:1px solid;display:block;width:100%;text-align:left;margin-bottom:3px;}
        .panel{background:#030a03;border:1px solid #0d2a0d;border-radius:4px;padding:12px;}
        .lbl{font-size:9px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:5px;}
        select option{background:#050505;}
        .scanline{position:fixed;inset:0;pointer-events:none;z-index:998;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px);}
      `}</style>

      <div className="scanline"/>

      {showSessions && (
        <SessionModal sessions={sessions} onSelect={handleSelectSession}
          onNew={handleNewSession} onDelete={handleDeleteSession}/>
      )}

      {/* Header */}
      <div style={{padding:"12px 20px 10px",borderBottom:"1px solid #0d2a0d",
        background:"linear-gradient(180deg,#050f05 0%,transparent 100%)",
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:14}}>
          <span style={{fontFamily:"'Orbitron',monospace",fontSize:22,fontWeight:900,
            color:"#ff2d2d",letterSpacing:4,textShadow:"0 0 24px #ff2d2d55"}}>REDLINE</span>
          <span style={{fontSize:10,color:"#4a8a4a",letterSpacing:3}}>LLM PRESSURE TESTING v2.0</span>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",fontSize:11}}>
          {/* Generator indicator */}
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 10px",
            background:"#39ff1411",border:"1px solid #39ff1433",borderRadius:3}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#39ff14",display:"inline-block"}}/>
            <span style={{color:"#39ff14",fontSize:10}}>GEN: {genProvider==="ollama"?genModel:genOpenaiModel}</span>
          </div>
          {/* Target indicator */}
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 10px",
            background:"#ff2d2d11",border:"1px solid #ff2d2d33",borderRadius:3}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#ff2d2d",display:"inline-block"}}/>
            <span style={{color:"#ff2d2d",fontSize:10}}>TGT: {tgtProvider==="ollama"?tgtModel:tgtOpenaiModel}</span>
          </div>
          {session ? (
            <>
              <span style={{color:"#00ff41",fontFamily:"'Rajdhani',sans-serif",fontWeight:700}}>{session.name}</span>
              <button className="btn" onClick={()=>setShowSessions(true)}
                style={{fontSize:9,padding:"3px 8px",background:"transparent",color:"#4a8a4a",border:"1px solid #1a2a1a"}}>
                SWITCH
              </button>
            </>
          ) : (
            <button className="btn" onClick={()=>setShowSessions(true)}
              style={{fontSize:10,padding:"4px 12px",background:"#003310",color:"#00ff41",border:"1px solid #00ff41"}}>
              SELECT SESSION
            </button>
          )}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"230px 1fr 285px",gap:8,padding:"8px 12px"}}>

        {/* LEFT */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>

          {/* Generator provider */}
          <ProviderPanel
            title="⚡ GENERATOR MODEL — writes attacks"
            color="#39ff14"
            provider={genProvider} setProvider={setGenProvider}
            ollamaUrl={genOllamaUrl} setOllamaUrl={setGenOllamaUrl}
            ollamaModels={genModels} selectedModel={genModel} setSelectedModel={setGenModel}
            openaiKey={genOpenaiKey} setOpenaiKey={setGenOpenaiKey}
            openaiModel={genOpenaiModel} setOpenaiModel={setGenOpenaiModel}
            onFetchModels={fetchGenModels}
          />

          {/* Target provider */}
          <ProviderPanel
            title="🎯 TARGET MODEL — receives attacks"
            color="#ff2d2d"
            provider={tgtProvider} setProvider={setTgtProvider}
            ollamaUrl={tgtOllamaUrl} setOllamaUrl={setTgtOllamaUrl}
            ollamaModels={tgtModels} selectedModel={tgtModel} setSelectedModel={setTgtModel}
            openaiKey={tgtOpenaiKey} setOpenaiKey={setTgtOpenaiKey}
            openaiModel={tgtOpenaiModel} setOpenaiModel={setTgtOpenaiModel}
            onFetchModels={fetchTgtModels}
          />

          {/* Categories */}
          <div className="panel">
            <div className="lbl">Attack Category</div>
            {Object.entries(CATEGORIES).map(([k,v])=>(
              <button key={k} className="cat-btn" onClick={()=>setCategory(k)}
                style={{background:category===k?`${v.color}18`:"transparent",
                  color:category===k?v.color:"#4a8a4a",
                  borderColor:category===k?v.color:"#1a2a1a",
                  boxShadow:category===k?`0 0 10px ${v.color}22`:"none"}}>
                <span style={{marginRight:5}}>{v.glyph}</span>{v.label}
              </button>
            ))}
          </div>

          {/* Technique */}
          <div className="panel">
            <div className="lbl">Technique</div>
            <select value={technique} onChange={e=>setTechnique(e.target.value)}
              style={{width:"100%",padding:"5px 8px",fontSize:11,marginBottom:8}}>
              {catData.techniques.map(t=><option key={t}>{t}</option>)}
            </select>
            <div className="lbl">Target Behavior</div>
            <textarea value={targetBehavior} onChange={e=>setTargetBehavior(e.target.value)}
              rows={3} style={{width:"100%",padding:"5px 8px",fontSize:11,resize:"vertical"}}/>
          </div>
        </div>

        {/* CENTER */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>

          {/* Action buttons */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
            {[
              {key:"generate",label:"GENERATE",color:"#39ff14",bg:"#003310",desc:`via ${genProvider==="ollama"?genModel:genOpenaiModel}`,action:handleGenerate},
              {key:"evolve",  label:"EVOLVE",  color:"#bf00ff",bg:"#1a0030",desc:"optimize & escalate",action:handleEvolve},
              {key:"execute", label:"EXECUTE", color:"#ff2d2d",bg:"#2a0000",desc:`→ ${tgtProvider==="ollama"?tgtModel:tgtOpenaiModel}`,action:handleExecute,pulse:true},
              {key:"adaptive",label:"ADAPTIVE",color:"#00cfff",bg:"#001a2a",desc:"synthesize from history",action:handleAdaptive},
            ].map(({key,label,color,bg,desc,action,pulse})=>(
              <button key={key} className="btn" onClick={action} disabled={loading[key]}
                style={{padding:"12px 8px",fontSize:14,color,background:bg,
                  border:`1px solid ${color}`,boxShadow:`0 0 10px ${color}22`,
                  animation:pulse&&!loading[key]?"pulse-red 3s infinite":"none"}}>
                {loading[key]?<span style={{animation:"blink .6s infinite"}}>█ {label}...</span>:label}
                <div style={{fontSize:9,letterSpacing:1,opacity:.6,marginTop:3,fontFamily:"'Share Tech Mono',monospace",
                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{desc}</div>
              </button>
            ))}
          </div>

          {/* Prompt editor */}
          <div className="panel">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div className="lbl" style={{margin:0}}>
                <span style={{color:catData.color}}>{catData.glyph} {catData.label}</span>
                <span style={{color:"#4a8a4a"}}> / {technique}</span>
                {attackId&&<span style={{color:"#1a3a1a",fontSize:9,marginLeft:8}}>#{attackId.slice(0,8)}</span>}
              </div>
              <div style={{display:"flex",gap:5}}>
                {basePrompt&&<Badge label="BASE" color="#00ff41"/>}
                {evolvedPrompt&&<Badge label="EVOLVED" color="#bf00ff"/>}
              </div>
            </div>
            <textarea value={activePrompt} onChange={e=>setActivePrompt(e.target.value)} rows={7}
              placeholder={"// Attack prompt appears here...\n// Generated by the GENERATOR model, fired at the TARGET model."}
              style={{width:"100%",padding:"8px 10px",fontSize:12,resize:"vertical",lineHeight:1.6}}/>
            {basePrompt&&evolvedPrompt&&(
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <button className="btn" onClick={()=>setActivePrompt(basePrompt)}
                  style={{fontSize:10,padding:"3px 10px",background:"transparent",color:"#00ff41",border:"1px solid #004400"}}>USE BASE</button>
                <button className="btn" onClick={()=>setActivePrompt(evolvedPrompt)}
                  style={{fontSize:10,padding:"3px 10px",background:"#1a0030",color:"#bf00ff",border:"1px solid #4a0080"}}>USE EVOLVED ◀</button>
              </div>
            )}
          </div>

          {/* Evolve strategy */}
          <div className="panel" style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px"}}>
            <div className="lbl" style={{margin:0,whiteSpace:"nowrap"}}>Evolve Strategy:</div>
            {["rephrase","escalate","authority","obfuscate"].map(s=>(
              <button key={s} className="btn" onClick={()=>setEvoStrategy(s)}
                style={{padding:"4px 10px",fontSize:11,
                  background:evoStrategy===s?"#1a0030":"transparent",
                  color:evoStrategy===s?"#bf00ff":"#4a8a4a",
                  border:`1px solid ${evoStrategy===s?"#bf00ff":"#1a2a1a"}`}}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Response */}
          <div className="panel" style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div className="lbl" style={{margin:0}}>
                TARGET RESPONSE
                {signals&&<span style={{color:"#2a4a2a",marginLeft:8,fontSize:9}}>from {tgtProvider==="ollama"?tgtModel:tgtOpenaiModel}</span>}
              </div>
              {signals&&(
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <Badge label={signals.status} color={STATUS_COLOR[signals.status]}/>
                  <ScoreBar score={signals.success_score} width={120}/>
                </div>
              )}
            </div>
            <div style={{background:"#020202",border:"1px solid #0d2a0d",borderRadius:3,
              padding:"8px 12px",minHeight:100,maxHeight:190,overflowY:"auto",
              fontSize:12,lineHeight:1.7,color:"#b0c8b0",whiteSpace:"pre-wrap"}}>
              {response||<span style={{color:"#2a4a2a"}}>// Response will appear here after EXECUTE...</span>}
            </div>
            {signals&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginTop:8}}>
                {[
                  {label:"Refusal",    val:signals.refusal_signals,              bad:signals.refusal_signals>0},
                  {label:"Compliance", val:signals.compliance_signals,            bad:false},
                  {label:"Disclaimer", val:signals.contains_disclaimer?"YES":"NO",bad:signals.contains_disclaimer},
                  {label:"Short Fail", val:signals.is_short_refusal?"YES":"NO",   bad:signals.is_short_refusal},
                ].map(({label,val,bad})=>(
                  <div key={label} style={{background:"#020202",border:"1px solid #0d2a0d",borderRadius:3,padding:"5px 8px"}}>
                    <div style={{fontSize:9,color:"#4a8a4a",letterSpacing:1,marginBottom:1}}>{label}</div>
                    <div style={{fontSize:14,color:bad?"#ff2d2d":"#00ff41",fontFamily:"'Rajdhani',sans-serif",fontWeight:700}}>{val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Terminal lines={termLines}/>
        </div>

        {/* RIGHT */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",borderBottom:"1px solid #0d2a0d"}}>
            {["history","metrics"].map(tab=>(
              <button key={tab} className="btn" onClick={()=>{ setActiveTab(tab); if(tab==="metrics"&&session) refreshMetrics(session.id); }}
                style={{flex:1,padding:"7px 0",fontSize:11,borderRadius:0,
                  background:activeTab===tab?"#030a03":"transparent",
                  color:activeTab===tab?"#00ff41":"#4a8a4a",
                  border:"none",borderBottom:`2px solid ${activeTab===tab?"#00ff41":"transparent"}`}}>
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="panel" style={{flex:1,overflowY:"auto",maxHeight:"calc(100vh - 230px)"}}>
            {activeTab==="history" ? (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div className="lbl" style={{margin:0}}>
                    ATTACKS {history.length>0&&<span style={{color:"#00ff41"}}>({history.length})</span>}
                  </div>
                  {history.length>0&&(
                    <button className="btn" onClick={exportHistory}
                      style={{fontSize:9,padding:"2px 8px",background:"transparent",color:"#00cfff",border:"1px solid #003a4a"}}>
                      ↓ JSON
                    </button>
                  )}
                </div>
                {history.length===0 ? (
                  <div style={{fontSize:11,color:"#2a4a2a",textAlign:"center",padding:"20px 0",lineHeight:2}}>
                    {session?"No attacks yet.\nGenerate → Execute to start.":"Select a session."}
                  </div>
                ) : history.map(h=>(
                  <div key={h.id}
                    style={{background:"#020202",borderLeft:`3px solid ${STATUS_COLOR[h.status]||"#1a2a1a"}`,
                      border:`1px solid ${(STATUS_COLOR[h.status]||"#1a2a1a")}33`,
                      borderRadius:3,padding:"8px 10px",cursor:"pointer",marginBottom:5,transition:"all .1s"}}
                    onClick={()=>{
                      setActivePrompt(h.active_prompt||""); setBasePrompt(h.base_prompt||"");
                      setEvolvedPrompt(h.evolved_prompt||""); setAttackId(h.id);
                      if(h.response) setResponse(h.response);
                      if(h.failure_signals) setSignals(h.failure_signals);
                    }}
                    onMouseEnter={e=>e.currentTarget.style.background="#040f04"}
                    onMouseLeave={e=>e.currentTarget.style.background="#020202"}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,color:CATEGORIES[h.category]?.color||"#c8c8c8",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>
                        {h.technique}
                      </span>
                      {h.status&&<Badge label={h.status} color={STATUS_COLOR[h.status]}/>}
                    </div>
                    {h.success_score!=null&&<ScoreBar score={h.success_score}/>}
                    <div style={{fontSize:10,color:"#4a8a4a",marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {(h.active_prompt||"").slice(0,65)}...
                    </div>
                    <div style={{fontSize:9,color:"#2a4a2a",marginTop:3,display:"flex",gap:10}}>
                      <span>{h.timestamp.slice(11,19)}</span>
                      {h.elapsed_seconds&&<span>{h.elapsed_seconds.toFixed(2)}s</span>}
                      <span style={{color:CATEGORIES[h.category]?.color||"#2a4a2a",opacity:.5}}>{h.category}</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div className="lbl" style={{margin:0}}>SESSION METRICS</div>
                  <button className="btn" onClick={()=>session&&refreshMetrics(session.id)}
                    style={{fontSize:9,padding:"2px 8px",background:"transparent",color:"#4a8a4a",border:"1px solid #1a2a1a"}}>
                    REFRESH
                  </button>
                </div>
                <MetricsPanel metrics={metrics}/>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
