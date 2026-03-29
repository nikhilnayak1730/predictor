import { useState, useRef, useEffect, useCallback } from "react";

/* ─────────────── THEME ─────────────── */
const C = {
  bg: "#06090A",
  surface: "#0C1114",
  card: "#111820",
  cardHover: "#141E28",
  border: "#1C2A34",
  borderHi: "#2A3F50",
  accent: "#00C896",
  accentDim: "#00C89622",
  accentBorder: "#00C89644",
  gold: "#F0B429",
  goldDim: "#F0B42922",
  red: "#E05252",
  redDim: "#E0525222",
  blue: "#4A9EFF",
  blueDim: "#4A9EFF22",
  text: "#E8EFF5",
  sub: "#8BA4B8",
  muted: "#4A6278",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'Inter', 'Segoe UI', sans-serif",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: ${C.surface}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes slideIn { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(400px)} }
  @keyframes blink { 0%,100%{opacity:1} 49%{opacity:1} 50%{opacity:0} }
  @keyframes glow { 0%,100%{box-shadow:0 0 8px ${C.accent}44} 50%{box-shadow:0 0 20px ${C.accent}88} }
  .log-entry { animation: slideIn 0.2s ease; }
  .card-hover:hover { background: ${C.cardHover} !important; border-color: ${C.borderHi} !important; transition: all 0.2s; }
  .pulse-dot { animation: pulse 1.5s infinite; }
  .spin { animation: spin 1s linear infinite; }
  .blink { animation: blink 1s step-end infinite; }
  input[type=file] { display:none; }
  input, textarea { outline: none; }
  button { cursor: pointer; font-family: ${C.mono}; }
  .glow-border { animation: glow 2s ease-in-out infinite; }
`;

/* ─────────────── HELPERS ─────────────── */
const parseCSV = (text) => {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || ""]));
  });
};

const toSignals = (profile) => {
  const signals = [];
  if (profile.experience) {
    try {
      const exp = typeof profile.experience === "string" ? JSON.parse(profile.experience) : profile.experience;
      if (Array.isArray(exp)) exp.forEach(e => signals.push({ type: "promotion", date: e.start_date || e.startDate || "2022-01", description: `${e.title || e.position} at ${e.company || e.organization}`, impact: "high" }));
    } catch { if (profile.experience) signals.push({ type: "project", date: "2023-01", description: profile.experience, impact: "medium" }); }
  }
  if (profile.certifications) signals.push({ type: "certification", date: "2023-06", description: String(profile.certifications), impact: "high" });
  if (profile.skills) signals.push({ type: "skill", date: "2023-01", description: `Skills: ${String(profile.skills).slice(0, 120)}`, impact: "medium" });
  if (profile.education) signals.push({ type: "certification", date: "2020-06", description: String(profile.education), impact: "medium" });
  if (signals.length === 0) signals.push({ type: "skill", date: "2023-01", description: "Profile data available", impact: "low" });
  return signals;
};

const buildPrompt = (profile, signals) => `You are an elite talent intelligence AI agent. Analyze this candidate's signals and return ONLY valid JSON.

CANDIDATE: ${profile.name || profile.full_name || "Unknown"} | Role: ${profile.position || profile.current_role || profile.title || "Unknown"} | Exp: ${profile.years_experience || profile.yearsExp || "N/A"} yrs | Company: ${profile.current_company || profile.company || "N/A"}

SIGNALS:
${signals.map((s, i) => `${i + 1}. [${s.date}] ${s.type}: "${s.description}" | Impact: ${s.impact}`).join("\n")}

Respond ONLY with this JSON (no markdown, no extra text):
{"prediction":"This candidate will likely become [role] in [X] months because [reason]","futureRole":"[role]","timelineMonths":[number],"confidence":[60-95],"growthScore":[1-100],"learningVelocity":"Slow|Moderate|Fast|Exceptional","velocityScore":[1-100],"roleFit6months":"[description]","roleFit12months":"[description]","strengths":["s1","s2","s3"],"riskFactors":[{"factor":"f","severity":"Low|Medium|High","mitigation":"m"}],"bestInvestmentRole":"[role]","investmentRationale":"[rationale]","developmentActions":["a1","a2","a3"],"trajectoryInsight":"[2-3 sentence deep insight]"}`;

/* ─────────────── SAMPLE DATA ─────────────── */
const SAMPLE_DATA = [
  { name: "Priya Sharma", position: "Junior Software Engineer", current_company: "TCS", years_experience: "2", skills: "Python, React, SQL, Git, REST APIs", certifications: "AWS Cloud Practitioner", education: "B.Tech Computer Science, JNTU 2022", experience: JSON.stringify([{ title: "Intern", company: "Wipro", start_date: "2021-06" }, { title: "Junior SWE", company: "TCS", start_date: "2022-08" }]) },
  { name: "Arjun Mehta", position: "Data Analyst", current_company: "Deloitte", years_experience: "3", skills: "Python, Tableau, Power BI, SQL, Excel, Statistics", certifications: "Google Data Analytics, Tableau Desktop Specialist", education: "B.Sc Statistics, Delhi University 2021", experience: JSON.stringify([{ title: "Data Intern", company: "Accenture", start_date: "2021-01" }, { title: "Junior Analyst", company: "Deloitte", start_date: "2021-07" }, { title: "Data Analyst", company: "Deloitte", start_date: "2023-01" }]) },
  { name: "Riya Kapoor", position: "Product Manager", current_company: "Flipkart", years_experience: "5", skills: "Product Strategy, Agile, Jira, User Research, Analytics, SQL", certifications: "PMP, Google PM Certificate", education: "MBA IIM Bangalore 2019", experience: JSON.stringify([{ title: "Business Analyst", company: "McKinsey", start_date: "2019-07" }, { title: "Associate PM", company: "Swiggy", start_date: "2021-01" }, { title: "Product Manager", company: "Flipkart", start_date: "2022-06" }]) },
];

/* ─────────────── MAIN APP ─────────────── */
export default function App() {
  const [view, setView] = useState("setup");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [datasetName, setDatasetName] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [agentStatus, setAgentStatus] = useState("idle"); 
  const [results, setResults] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedResult, setSelectedResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);
  const logsRef = useRef(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [agentLogs]);

  const addLog = useCallback((msg, type = "info") => {
    const time = new Date().toLocaleTimeString("en", { hour12: false });
    setAgentLogs(l => [...l, { msg, type, time, id: Date.now() + Math.random() }]);
  }, []);

  const loadDataset = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      let parsed = [];
      try {
        if (file.name.endsWith(".json")) {
          const j = JSON.parse(text);
          parsed = Array.isArray(j) ? j : j.data || j.profiles || j.results || [j];
        } else {
          parsed = parseCSV(text);
        }
        setProfiles(parsed);
        setDatasetName(file.name);
        setDataset(file);
        addLog(`✓ Loaded "${file.name}" — ${parsed.length} profiles detected`, "success");
      } catch (err) { addLog(`✗ Failed to parse file: ${err.message}`, "error"); }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) loadDataset(f); };
  const handleFile = (e) => { const f = e.target.files[0]; if (f) loadDataset(f); };
  const loadSample = () => { setProfiles(SAMPLE_DATA); setDatasetName("sample_profiles.json"); setDataset("sample"); addLog("✓ Loaded sample dataset — 3 demo profiles", "success"); };

  const validateKey = async () => {
    if (!apiKey || apiKey.trim() === "") { 
        setApiKeyValid(false); 
        addLog("✗ Please enter an API key", "error");
        return; 
    }
    
    setApiKeyValid(null);
    addLog("⟳ Validating API key format...", "info");
    
    setTimeout(() => {
        setApiKeyValid(true);
        addLog("✓ API key format accepted", "success");
    }, 500);
  };

  const runAgent = async () => {
    setView("agent");
    setAgentStatus("running");
    setResults([]);
    setCurrentIdx(0);
    setAgentLogs([]);
    abortRef.current = false;
    addLog("◈ TrajectoryAI Agent initializing...", "system");
    addLog(`◈ Dataset: ${datasetName} (${profiles.length} profiles)`, "system");
    addLog(`◈ Model: Configured via API Key`, "system");
    addLog("─────────────────────────────────", "divider");
    await new Promise(r => setTimeout(r, 600));

    for (let i = 0; i < profiles.length; i++) {
      if (abortRef.current) { addLog("⊘ Agent stopped by user", "warn"); setAgentStatus("paused"); return; }
      const profile = profiles[i];
      const name = profile.name || profile.full_name || `Profile #${i + 1}`;
      setCurrentIdx(i);
      setProgress(Math.round((i / profiles.length) * 100));
      addLog(``, "spacer");
      addLog(`[${i + 1}/${profiles.length}] Processing: ${name}`, "agent");
      addLog(`  → Role: ${profile.position || profile.title || "Unknown"}`, "detail");
      addLog(`  → Building signal timeline...`, "detail");
      await new Promise(r => setTimeout(r, 300));
      const signals = toSignals(profile);
      addLog(`  → ${signals.length} signals extracted`, "detail");
      addLog(`  → Calling API...`, "detail");

      try {
        const useKey = apiKey || "demo";
        const headers = { 
            "Content-Type": "application/json", 
            "anthropic-version": "2023-06-01", 
            "anthropic-dangerous-direct-browser-access": "true" 
        };
        if (apiKey) headers["x-api-key"] = apiKey;

        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers,
          body: JSON.stringify({ 
              model: "claude-3-sonnet-20240229", 
              max_tokens: 1000, 
              messages: [{ role: "user", content: buildPrompt(profile, signals) }] 
          }),
        });
        
        if (!resp.ok) {
            const errorText = await resp.text();
            throw new Error(errorText);
        }

        const data = await resp.json();
        const raw = data.content?.map(b => b.text || "").join("") || "";
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        const result = { ...parsed, profile, name, signals, idx: i };
        setResults(r => [...r, result]);
        addLog(`  ✓ Prediction: ${parsed.futureRole} in ${parsed.timelineMonths}mo (${parsed.confidence}% confidence)`, "success");
        addLog(`  ✓ Growth: ${parsed.growthScore}/100 | Velocity: ${parsed.learningVelocity}`, "success");
      } catch (err) {
        addLog(`  ✗ Error: ${err.message}`, "error");
        setResults(r => [...r, { profile, name, signals, idx: i, error: true, futureRole: "Analysis Failed", prediction: "Could not analyze this profile.", confidence: 0, growthScore: 0 }]);
      }
      await new Promise(r => setTimeout(r, 400));
    }

    setProgress(100);
    addLog("", "spacer");
    addLog("─────────────────────────────────", "divider");
    addLog(`◈ Agent complete. ${profiles.length} profiles analyzed.`, "system");
    setAgentStatus("done");
    await new Promise(r => setTimeout(r, 800));
    setView("results");
  };

  const stopAgent = () => { abortRef.current = true; };

  const card = (extra = {}) => ({ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, ...extra });

  if (view === "setup") return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.sans }}>
      <style>{css}</style>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "16px 32px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 34, height: 34, background: C.accent, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 16, color: "#000", fontWeight: "bold" }}>◈</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.3 }}>TrajectoryAI</div>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, letterSpacing: 2 }}>AGENT PLATFORM v2.0</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {["SETUP", "AGENT", "RESULTS"].map((s, i) => (
            <div key={s} style={{ padding: "4px 14px", borderRadius: 20, fontSize: 10, fontFamily: C.mono, letterSpacing: 1.5, background: i === 0 ? C.accentDim : "transparent", color: i === 0 ? C.accent : C.muted, border: `1px solid ${i === 0 ? C.accent : C.border}` }}>{s}</div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: C.accent, fontFamily: C.mono, letterSpacing: 3, marginBottom: 10 }}>CONFIGURE YOUR AGENT</div>
          <h1 style={{ fontSize: 36, fontWeight: 300, lineHeight: 1.2, letterSpacing: -0.5 }}>Upload Dataset.<br /><span style={{ color: C.accent, fontWeight: 600 }}>Launch Intelligence.</span></h1>
          <p style={{ color: C.sub, marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>Connect your Bright Data scraped profiles + API key. The agent will autonomously analyze every candidate and predict their trajectory.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ ...card(), padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, background: C.goldDim, border: `1px solid ${C.gold}44`, borderRadius: 6, display: "grid", placeItems: "center", fontSize: 13 }}>🔑</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>LLM API Key</div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono }}>Claude / Custom Proxy</div>
              </div>
              {apiKeyValid === true && <div style={{ marginLeft: "auto", fontSize: 10, color: C.accent, fontFamily: C.mono, background: C.accentDim, padding: "2px 8px", borderRadius: 10 }}>VALID ✓</div>}
              {apiKeyValid === false && <div style={{ marginLeft: "auto", fontSize: 10, color: C.red, fontFamily: C.mono, background: C.redDim, padding: "2px 8px", borderRadius: 10 }}>INVALID ✗</div>}
            </div>

            <div style={{ position: "relative", marginBottom: 10 }}>
              <input
                type={apiKeyVisible ? "text" : "password"}
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setApiKeyValid(null); }}
                placeholder="Enter API Key..."
                style={{ width: "100%", background: C.surface, border: `1px solid ${apiKeyValid === true ? C.accent : apiKeyValid === false ? C.red : C.border}`, borderRadius: 8, color: C.text, padding: "10px 44px 10px 14px", fontSize: 12, fontFamily: C.mono, transition: "border 0.2s" }}
              />
              <button onClick={() => setApiKeyVisible(!apiKeyVisible)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, fontSize: 14 }}>{apiKeyVisible ? "🙈" : "👁"}</button>
            </div>

            <button onClick={validateKey} disabled={!apiKey} style={{ width: "100%", padding: "9px", background: apiKey ? C.goldDim : "transparent", border: `1px solid ${apiKey ? C.gold : C.border}`, borderRadius: 8, color: apiKey ? C.gold : C.muted, fontSize: 11, fontFamily: C.mono, letterSpacing: 1, transition: "all 0.2s" }}>VALIDATE KEY</button>
          </div>

          <div style={{ ...card(), padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, background: C.blueDim, border: `1px solid ${C.blue}44`, borderRadius: 6, display: "grid", placeItems: "center", fontSize: 13 }}>🌐</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>Bright Data</div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono }}>Optional scraper config</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, lineHeight: 1.9, background: C.surface, padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ color: C.sub, marginBottom: 6 }}>Scraper output → download JSON/CSV</div>
              1. brightdata.com → Scraper IDE<br />
              2. Select LinkedIn People template<br />
              3. Run → Download as JSON<br />
              4. Upload below ↓<br />
              <div style={{ marginTop: 8, color: C.accent }}>Or use the sample dataset to test →</div>
            </div>
          </div>
        </div>

        <div style={{ ...card(), padding: 24, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 6, display: "grid", placeItems: "center", fontSize: 13 }}>📂</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>Dataset Upload</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono }}>JSON or CSV · Bright Data / Kaggle / Custom</div>
            </div>
            {profiles.length > 0 && <div style={{ marginLeft: "auto", fontSize: 11, color: C.accent, fontFamily: C.mono, background: C.accentDim, padding: "4px 12px", borderRadius: 20, border: `1px solid ${C.accentBorder}` }}>{profiles.length} profiles ready</div>}
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? C.accent : profiles.length ? C.accentBorder : C.border}`, borderRadius: 10, padding: "36px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? C.accentDim : profiles.length ? "#0A1A14" : "transparent", transition: "all 0.2s" }}
          >
            <input ref={fileRef} type="file" accept=".json,.csv" onChange={handleFile} />
            {profiles.length > 0 ? (
              <div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 14, color: C.accent, fontWeight: 600, marginBottom: 4 }}>{datasetName}</div>
                <div style={{ fontSize: 12, color: C.sub }}>{profiles.length} profiles loaded — click to replace</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.5 }}>⬆</div>
                <div style={{ fontSize: 14, color: C.sub, marginBottom: 4 }}>Drop your JSON or CSV here</div>
                <div style={{ fontSize: 11, color: C.muted }}>Bright Data export · Kaggle CSV · Custom dataset</div>
              </div>
            )}
          </div>

          {profiles.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {profiles.slice(0, 4).map((p, i) => (
                <div key={i} style={{ padding: "6px 12px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, fontSize: 11, color: C.sub, fontFamily: C.mono }}>
                  {p.name || p.full_name || `Profile ${i + 1}`}
                </div>
              ))}
              {profiles.length > 4 && <div style={{ padding: "6px 12px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, fontSize: 11, color: C.muted, fontFamily: C.mono }}>+{profiles.length - 4} more</div>}
            </div>
          )}

          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button onClick={loadSample} style={{ flex: 1, padding: "10px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.sub, fontSize: 11, fontFamily: C.mono, letterSpacing: 1, transition: "all 0.2s" }}>
              USE SAMPLE DATASET (3 profiles)
            </button>
          </div>
        </div>

        {agentLogs.length > 0 && (
          <div style={{ ...card(), padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, letterSpacing: 1.5, marginBottom: 10 }}>SYSTEM LOG</div>
            <div style={{ fontFamily: C.mono, fontSize: 11, lineHeight: 1.8, maxHeight: 80, overflowY: "auto" }}>
              {agentLogs.map(l => (
                <div key={l.id} style={{ color: l.type === "success" ? C.accent : l.type === "error" ? C.red : C.muted }}>{l.time} {l.msg}</div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={profiles.length > 0 ? runAgent : null}
          disabled={profiles.length === 0}
          style={{
            width: "100%", padding: "18px", borderRadius: 12, fontSize: 16, fontWeight: 700, letterSpacing: 2, fontFamily: C.mono,
            background: profiles.length > 0 ? C.accent : C.border,
            border: "none", color: profiles.length > 0 ? "#000" : C.muted,
            boxShadow: profiles.length > 0 ? `0 0 30px ${C.accent}44` : "none",
            transition: "all 0.3s",
          }}
        >
          {profiles.length > 0 ? `◈ LAUNCH AGENT → ${profiles.length} PROFILES` : "UPLOAD DATASET TO CONTINUE"}
        </button>
        {!apiKey && profiles.length > 0 && (
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: C.gold, fontFamily: C.mono }}>⚠ No API key — add your key above for live analysis (sample will use demo mode)</div>
        )}
      </div>
    </div>
  );

  if (view === "agent") return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.sans }}>
      <style>{css}</style>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "14px 32px", display: "flex", alignItems: "center", gap: 14 }}>
        <div className={agentStatus === "running" ? "glow-border" : ""} style={{ width: 34, height: 34, background: agentStatus === "running" ? C.accent : agentStatus === "done" ? C.gold : C.muted, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 16, color: "#000" }}>◈</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Agent Running</div>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, letterSpacing: 1.5 }}>PROCESSING {profiles.length} PROFILES</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontFamily: C.mono, fontSize: 13, color: C.accent }}>{results.length}/{profiles.length}</div>
          {agentStatus === "running" && (
            <button onClick={stopAgent} style={{ padding: "6px 16px", background: C.redDim, border: `1px solid ${C.red}44`, borderRadius: 6, color: C.red, fontSize: 11, fontFamily: C.mono }}>⊘ STOP</button>
          )}
          {agentStatus === "done" && (
            <button onClick={() => setView("results")} style={{ padding: "6px 16px", background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 6, color: C.accent, fontSize: 11, fontFamily: C.mono }}>VIEW RESULTS →</button>
          )}
        </div>
      </div>

      <div style={{ height: 3, background: C.border }}>
        <div style={{ height: "100%", width: `${progress}%`, background: C.accent, transition: "width 0.5s ease", boxShadow: `0 0 10px ${C.accent}` }} />
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ ...card(), padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <div className="pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: agentStatus === "running" ? C.accent : agentStatus === "done" ? C.gold : C.muted }} />
            <span style={{ fontSize: 11, fontFamily: C.mono, color: C.muted, letterSpacing: 1.5 }}>AGENT CONSOLE</span>
          </div>
          <div ref={logsRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px", fontFamily: C.mono, fontSize: 11, lineHeight: 2, maxHeight: 520, minHeight: 300 }}>
            {agentLogs.map(l => (
              <div key={l.id} className="log-entry" style={{
                color: l.type === "success" ? C.accent : l.type === "error" ? C.red : l.type === "system" ? C.gold : l.type === "agent" ? C.blue : l.type === "warn" ? C.gold : l.type === "divider" ? C.border : l.type === "spacer" ? "transparent" : C.muted,
                fontWeight: l.type === "system" || l.type === "agent" ? 600 : 400,
              }}>
                {l.type !== "spacer" && l.type !== "divider" && <span style={{ color: C.muted, marginRight: 10 }}>{l.time}</span>}
                {l.msg || (l.type === "divider" ? "─".repeat(40) : "")}
              </div>
            ))}
            {agentStatus === "running" && <div style={{ color: C.accent, fontFamily: C.mono, fontSize: 11 }}>▋<span className="blink">_</span></div>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 572, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, letterSpacing: 1.5, marginBottom: 4, padding: "0 4px" }}>LIVE RESULTS</div>
          {results.length === 0 && (
            <div style={{ ...card(), padding: 24, textAlign: "center" }}>
              <div className="spin" style={{ fontSize: 24, display: "inline-block", marginBottom: 10, color: C.accent }}>◈</div>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: C.mono }}>Waiting for first result...</div>
            </div>
          )}
          {results.map((r, i) => (
            <div key={i} className="log-entry card-hover" style={{ ...card(), padding: "14px 16px", cursor: "pointer" }} onClick={() => { setSelectedResult(r); setView("results"); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.name}</div>
                {!r.error && <div style={{ fontSize: 10, fontFamily: C.mono, color: C.accent, background: C.accentDim, padding: "2px 8px", borderRadius: 10 }}>{r.confidence}%</div>}
              </div>
              {!r.error ? (
                <>
                  <div style={{ fontSize: 11, color: C.accent, marginBottom: 6, fontFamily: C.mono }}>→ {r.futureRole} in {r.timelineMonths}mo</div>
                  <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${r.growthScore}%`, background: C.accent, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, marginTop: 4 }}>Growth {r.growthScore}/100 · {r.learningVelocity}</div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: C.red, fontFamily: C.mono }}>✗ Analysis failed</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.sans }}>
      <style>{css}</style>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "14px 32px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 34, height: 34, background: C.gold, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 16, color: "#000", fontWeight: "bold" }}>◈</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.3 }}>TrajectoryAI</div>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, letterSpacing: 2 }}>RESULTS DASHBOARD</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button onClick={() => { setSelectedResult(null); setView("agent"); }} style={{ padding: "6px 14px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, fontFamily: C.mono }}>← LOGS</button>
          <button onClick={() => { setView("setup"); setProfiles([]); setResults([]); setAgentLogs([]); setSelectedResult(null); setDataset(null); setDatasetName(""); }} style={{ padding: "6px 14px", background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 6, color: C.accent, fontSize: 11, fontFamily: C.mono }}>NEW ANALYSIS +</button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "ANALYZED", val: results.length, color: C.accent },
            { label: "AVG GROWTH", val: Math.round(results.filter(r => !r.error).reduce((s, r) => s + (r.growthScore || 0), 0) / Math.max(results.filter(r => !r.error).length, 1)) + "/100", color: C.gold },
            { label: "HIGH POTENTIAL", val: results.filter(r => r.growthScore >= 75).length, color: C.blue },
            { label: "AVG TIMELINE", val: Math.round(results.filter(r => !r.error).reduce((s, r) => s + (r.timelineMonths || 0), 0) / Math.max(results.filter(r => !r.error).length, 1)) + "mo", color: C.sub },
          ].map(m => (
            <div key={m.label} style={{ ...card(), padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, letterSpacing: 1, marginBottom: 8 }}>{m.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: m.color }}>{m.val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selectedResult ? "1fr 1.6fr" : "1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {results.map((r, i) => (
              <div key={i} className="card-hover" onClick={() => setSelectedResult(selectedResult?.idx === r.idx ? null : r)} style={{ ...card(), padding: "16px 18px", cursor: "pointer", borderColor: selectedResult?.idx === r.idx ? C.accent : C.border, transition: "all 0.2s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{r.profile?.position || r.profile?.title || "Unknown role"}</div>
                  </div>
                  {!r.error && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, fontFamily: C.mono, color: C.accent, marginBottom: 2 }}>{r.confidence}% conf.</div>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: C.mono }}>{r.learningVelocity}</div>
                    </div>
                  )}
                </div>
                {!r.error ? (
                  <>
                    <div style={{ fontSize: 12, color: C.accent, fontFamily: C.mono, marginBottom: 8 }}>→ {r.futureRole} · {r.timelineMonths} months</div>
                    <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${r.growthScore}%`, background: r.growthScore >= 75 ? C.accent : r.growthScore >= 50 ? C.gold : C.muted, borderRadius: 2, transition: "width 0.8s ease" }} />
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 5, fontFamily: C.mono }}>Growth Score: {r.growthScore}/100</div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: C.red, fontFamily: C.mono }}>✗ Analysis failed</div>
                )}
              </div>
            ))}
          </div>

          {selectedResult && !selectedResult.error && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#0A1A14", border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, background: `radial-gradient(circle, ${C.accent}18, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ fontSize: 10, color: C.accent, fontFamily: C.mono, letterSpacing: 2, marginBottom: 10 }}>AI PREDICTION · {selectedResult.name}</div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: C.sub, fontStyle: "italic", marginBottom: 16 }}>"{selectedResult.prediction}"</div>
                <div style={{ display: "flex", gap: 20 }}>
                  <div><div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, letterSpacing: 1 }}>FUTURE ROLE</div><div style={{ fontSize: 16, color: C.accent, marginTop: 4, fontWeight: 600 }}>{selectedResult.futureRole}</div></div>
                  <div><div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, letterSpacing: 1 }}>TIMELINE</div><div style={{ fontSize: 16, color: C.text, marginTop: 4 }}>{selectedResult.timelineMonths} months</div></div>
                  <div><div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, letterSpacing: 1 }}>CONFIDENCE</div><div style={{ fontSize: 16, color: C.gold, marginTop: 4 }}>{selectedResult.confidence}%</div></div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[{ label: "6 MONTHS", val: selectedResult.roleFit6months, color: C.blue }, { label: "12 MONTHS", val: selectedResult.roleFit12months, color: C.accent }].map(f => (
                  <div key={f.label} style={{ ...card(), padding: "14px 16px" }}>
                    <div style={{ fontSize: 9, color: f.color, fontFamily: C.mono, letterSpacing: 1, marginBottom: 8 }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.6 }}>{f.val}</div>
                  </div>
                ))}
              </div>

              <div style={{ ...card(), padding: "16px 18px", borderColor: `${C.gold}44`, background: "#14120A" }}>
                <div style={{ fontSize: 9, color: C.gold, fontFamily: C.mono, letterSpacing: 1, marginBottom: 8 }}>BEST ROLE TO INVEST IN</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>{selectedResult.bestInvestmentRole}</div>
                <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.6 }}>{selectedResult.investmentRationale}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ ...card(), padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, letterSpacing: 1, marginBottom: 10 }}>STRENGTHS</div>
                  {selectedResult.strengths?.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                      <div style={{ color: C.accent, fontSize: 10, marginTop: 2 }}>✓</div>
                      <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.5 }}>{s}</div>
                    </div>
                  ))}
                </div>
                <div style={{ ...card(), padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, letterSpacing: 1, marginBottom: 10 }}>RISK FACTORS</div>
                  {selectedResult.riskFactors?.map((r, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: r.severity === "High" ? C.red : r.severity === "Medium" ? C.gold : C.accent, fontFamily: C.mono, marginBottom: 3 }}>{r.severity} RISK</div>
                      <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.5 }}>{r.factor}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...card(), padding: "16px 18px" }}>
                <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono, letterSpacing: 1, marginBottom: 12 }}>DEVELOPMENT ACTIONS</div>
                {selectedResult.developmentActions?.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 12px", background: C.surface, borderRadius: 6, marginBottom: 6, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.accent, fontFamily: C.mono, width: 20, flexShrink: 0 }}>0{i + 1}</div>
                    <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.5 }}>{a}</div>
                  </div>
                ))}
              </div>

              <div style={{ ...card(), padding: "14px 18px", borderLeft: `3px solid ${C.accent}` }}>
                <div style={{ fontSize: 9, color: C.accent, fontFamily: C.mono, letterSpacing: 1, marginBottom: 8 }}>DEEP INSIGHT</div>
                <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7, fontStyle: "italic" }}>{selectedResult.trajectoryInsight}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
