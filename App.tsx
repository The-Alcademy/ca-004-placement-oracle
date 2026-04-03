import { useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   CA-004 — PLACEMENT ORACLE
   Invysible College / The Alcademy

   ENV VARS (Vercel, server-side):
     ANTHROPIC_API_KEY
     SUPABASE_URL
     SUPABASE_ANON_KEY

   SUPABASE — add oracle_note column if not present:
     ALTER TABLE capacity_register
       ADD COLUMN IF NOT EXISTS oracle_note text,
       ADD COLUMN IF NOT EXISTS placement_source text DEFAULT 'manual';
────────────────────────────────────────────────────────────────────────────── */

const serif = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const sans  = "'Gill Sans', Optima, Calibri, 'Trebuchet MS', sans-serif";
const mono  = "'Courier New', monospace";

const C = {
  bg:           "#06040a",
  surface:      "#0c0910",
  surfaceHigh:  "#110e18",
  border:       "#2a1f38",
  borderHigh:   "#3e2f52",
  text:         "#e5ddd0",
  muted:        "#7a7068",
  subtle:       "#3a3030",
  gold:         "#c49a3c",
  goldDim:      "#7a5e24",
  goldFaint:    "#1e1608",
  accept:       "#2d6a4f",
  acceptFaint:  "#0a1c14",
  acceptText:   "#6fcfa0",
  refer:        "#7a5e24",
  referFaint:   "#1a1408",
  referText:    "#c49a3c",
  reject:       "#8a1a2c",
  rejectFaint:  "#1a080c",
  rejectText:   "#e07080",
};

interface TestResult {
  verdict: string;
  reasoning: string;
  similar_capacity?: string | null;
  use_cases_served?: string[];
}

interface Placement {
  school: string;
  school_code: string;
  solid: string;
  solid_code: string;
  scale: string;
  slot: number;
  geocode: string;
  reasoning: string;
}

interface Assessment {
  candidate: string;
  test1_granularity: TestResult;
  test2_novelty: TestResult;
  test3_coherence: TestResult;
  test4_systemic_benefit: TestResult;
  test5_placement: Placement | null;
  recursive_reach: string | null;
  overall: "ACCEPT" | "REFER" | "REJECT";
  rationale: string;
}

interface HistoryEntry {
  id: number;
  candidate: string;
  geocode: string | null;
  overall: string;
  timestamp: string;
  assessment: Assessment;
  disposition: "pending" | "accepted" | "referred" | "rejected";
}

async function db(path: string, method: string, body?: object, prefer?: string) {
  const res = await fetch("/api/supabase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, method, body, prefer }),
  });
  return res.ok ? (await res.text() ? res.json() : null) : null;
}

const SCHOOL_COLOURS: Record<string, string> = {
  R: "#c44", O: "#c74", Y: "#aa8820", G: "#2d6a4f", B: "#2255aa", P: "#6644aa",
};

const VERDICT_COLOUR: Record<string, string> = {
  PASS: C.acceptText, NOVEL: C.acceptText, COHERENT: C.acceptText, STRENGTHENS: C.acceptText,
  TOO_BROAD: C.referText, TOO_NARROW: C.referText, VARIANT: C.referText, NEUTRAL: C.muted,
  DUPLICATE: C.referText, MISALIGNED: C.referText,
  CONTRADICTORY: C.rejectText, WEAKENS: C.rejectText,
};

const OVERALL_CFG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  ACCEPT: { bg: C.acceptFaint,  border: C.accept,  text: C.acceptText,  label: "Accept" },
  REFER:  { bg: C.referFaint,   border: C.refer,   text: C.referText,   label: "Refer" },
  REJECT: { bg: C.rejectFaint,  border: C.reject,  text: C.rejectText,  label: "Reject" },
};

const TEST_LABELS: Record<string, string> = {
  test1_granularity:    "I · Granularity",
  test2_novelty:        "II · Novelty",
  test3_coherence:      "III · Coherence",
  test4_systemic_benefit: "IV · Systemic benefit",
};

export default function App() {
  const [candidate,    setCandidate]    = useState("");
  const [description,  setDescription]  = useState("");
  const [consulting,   setConsulting]   = useState(false);
  const [assessment,   setAssessment]   = useState<Assessment | null>(null);
  const [error,        setError]        = useState("");
  const [history,      setHistory]      = useState<HistoryEntry[]>([]);
  const [nextId,       setNextId]       = useState(1);
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState("");
  const [selected,     setSelected]     = useState<HistoryEntry | null>(null);

  const consult = async () => {
    if (!candidate.trim()) return;
    setConsulting(true);
    setAssessment(null);
    setError("");
    setSaveMsg("");

    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: candidate.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Oracle error");

      const a: Assessment = data.assessment;
      setAssessment(a);

      const entry: HistoryEntry = {
        id: nextId,
        candidate: a.candidate,
        geocode: a.test5_placement?.geocode ?? null,
        overall: a.overall,
        timestamp: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        assessment: a,
        disposition: "pending",
      };
      setHistory(prev => [entry, ...prev]);
      setNextId(n => n + 1);
    } catch (err: any) {
      setError(err.message || "The Oracle is silent. Please try again.");
    } finally {
      setConsulting(false);
    }
  };

  const updateDisposition = (id: number, disposition: HistoryEntry["disposition"]) => {
    setHistory(prev => prev.map(e => e.id === id ? { ...e, disposition } : e));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, disposition } : null);
  };

  const accept = async (a: Assessment, entryId: number) => {
    if (!a.test5_placement) return;
    setSaving(true);
    setSaveMsg("");
    try {
      await db("capacity_register", "POST", {
        geocode:          a.test5_placement.geocode,
        name:             a.candidate,
        school_code:      a.test5_placement.school_code,
        solid_code:       a.test5_placement.solid_code,
        slot:             a.test5_placement.slot,
        oracle_note:      JSON.stringify({
          rationale:       a.rationale,
          recursive_reach: a.recursive_reach,
          placement_reasoning: a.test5_placement.reasoning,
        }),
        placement_source: "oracle",
      }, "return=minimal");
      updateDisposition(entryId, "accepted");
      setSaveMsg(`Placed at ${a.test5_placement.geocode}`);
    } catch {
      setSaveMsg("Write failed — check Supabase connection.");
    } finally {
      setSaving(false);
    }
  };

  const activeAssessment = selected?.assessment ?? assessment;
  const activeEntry      = selected ?? history[0] ?? null;

  const page: React.CSSProperties = {
    minHeight: "100vh", background: C.bg, color: C.text,
    fontFamily: sans, fontSize: "0.85rem",
    display: "grid", gridTemplateColumns: "1fr 280px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: C.surfaceHigh, border: `1px solid ${C.border}`,
    borderRadius: "1px", color: C.text, fontFamily: sans, fontSize: "0.88rem",
    padding: "0.6rem 0.75rem", boxSizing: "border-box", outline: "none",
  };

  return (
    <div style={page}>

      {/* ── Main column ── */}
      <div style={{ padding: "2rem 2.5rem", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ color: C.goldDim, fontFamily: sans, fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.4rem" }}>
            CA-004 · Invysible College
          </div>
          <h1 style={{ fontFamily: serif, fontWeight: 300, fontSize: "2rem", color: C.text, margin: 0, letterSpacing: "0.04em" }}>
            Placement Oracle
          </h1>
          <p style={{ color: C.muted, fontSize: "0.78rem", marginTop: "0.4rem", lineHeight: 1.6 }}>
            Submit a candidate concept. The Oracle applies the Psycho-Immunity Filter and recommends a placement within the BedePlex — or rejection.
          </p>
        </div>

        {/* Input */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "2px", padding: "1.75rem", marginBottom: "1.75rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", color: C.muted, fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.4rem" }}>
              Candidate concept
            </label>
            <input
              style={inputStyle}
              value={candidate}
              onChange={e => setCandidate(e.target.value)}
              placeholder="e.g. 0th Principle Thinking"
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && consult()}
              onFocus={e => e.target.style.borderColor = C.goldDim}
              onBlur={e  => e.target.style.borderColor = C.border}
            />
          </div>
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", color: C.muted, fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.4rem" }}>
              Description <span style={{ color: C.subtle, textTransform: "none", letterSpacing: 0 }}>(optional — helps the Oracle)</span>
            </label>
            <textarea
              style={{ ...inputStyle, minHeight: "80px", resize: "vertical", lineHeight: 1.55, fontFamily: sans }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description, examples, or context…"
              onFocus={e => e.target.style.borderColor = C.goldDim}
              onBlur={e  => e.target.style.borderColor = C.border}
            />
          </div>
          <button
            onClick={consult}
            disabled={consulting || !candidate.trim()}
            style={{
              background: "transparent", border: `1px solid ${C.gold}`,
              color: C.gold, fontFamily: serif, fontSize: "1rem",
              letterSpacing: "0.1em", padding: "0.65rem 2rem",
              cursor: consulting || !candidate.trim() ? "not-allowed" : "pointer",
              borderRadius: "1px", opacity: consulting || !candidate.trim() ? 0.45 : 1,
            }}
          >
            {consulting ? "Consulting the Oracle…" : "Consult the Oracle"}
          </button>
          {error && <p style={{ color: C.rejectText, fontFamily: sans, fontSize: "0.78rem", marginTop: "0.75rem" }}>{error}</p>}
        </div>

        {/* Assessment */}
        {activeAssessment && (
          <div>
            {/* Candidate name */}
            <div style={{ marginBottom: "1.25rem" }}>
              <span style={{ color: C.muted, fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>Candidate — </span>
              <span style={{ fontFamily: serif, fontSize: "1.1rem", color: C.text }}>{activeAssessment.candidate}</span>
            </div>

            {/* Five tests */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {(["test1_granularity", "test2_novelty", "test3_coherence", "test4_systemic_benefit"] as const).map(key => {
                const t = activeAssessment[key] as TestResult;
                const vc = VERDICT_COLOUR[t.verdict] ?? C.muted;
                return (
                  <div key={key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1px", padding: "0.9rem 1.1rem" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.3rem" }}>
                      <span style={{ color: C.muted, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>
                        {TEST_LABELS[key]}
                      </span>
                      <span style={{ color: vc, fontSize: "0.7rem", letterSpacing: "0.08em", fontFamily: mono }}>
                        {t.verdict}
                      </span>
                      {t.similar_capacity && (
                        <span style={{ color: C.subtle, fontSize: "0.68rem" }}>→ {t.similar_capacity}</span>
                      )}
                      {t.use_cases_served && t.use_cases_served.length > 0 && (
                        <span style={{ color: C.subtle, fontSize: "0.65rem" }}>{t.use_cases_served.join(", ")}</span>
                      )}
                    </div>
                    <p style={{ color: C.muted, fontSize: "0.78rem", margin: 0, lineHeight: 1.6 }}>{t.reasoning}</p>
                  </div>
                );
              })}
            </div>

            {/* Placement */}
            {activeAssessment.test5_placement && (
              <div style={{ background: C.surfaceHigh, border: `1px solid ${C.borderHigh}`, borderRadius: "1px", padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
                  <span style={{ color: C.muted, fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    V · Placement
                  </span>
                  <span style={{
                    fontFamily: mono, fontSize: "1.1rem", color: C.gold,
                    border: `1px solid ${C.goldDim}`, padding: "0.15rem 0.65rem",
                    borderRadius: "1px", letterSpacing: "0.1em",
                  }}>
                    {activeAssessment.test5_placement.geocode}
                  </span>
                  <span style={{ color: SCHOOL_COLOURS[activeAssessment.test5_placement.school_code] ?? C.muted, fontSize: "0.78rem" }}>
                    {activeAssessment.test5_placement.school}
                  </span>
                  <span style={{ color: C.muted, fontSize: "0.78rem" }}>
                    {activeAssessment.test5_placement.solid}
                  </span>
                  <span style={{ color: C.subtle, fontSize: "0.72rem" }}>
                    {activeAssessment.test5_placement.scale}
                  </span>
                </div>
                <p style={{ color: C.muted, fontSize: "0.78rem", margin: 0, lineHeight: 1.6 }}>
                  {activeAssessment.test5_placement.reasoning}
                </p>
              </div>
            )}

            {/* Recursive reach */}
            {activeAssessment.recursive_reach && (
              <div style={{ borderLeft: `2px solid ${C.border}`, paddingLeft: "1rem", marginBottom: "1rem" }}>
                <span style={{ color: C.subtle, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>
                  Recursive reach
                </span>
                <p style={{ color: C.muted, fontSize: "0.76rem", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
                  {activeAssessment.recursive_reach}
                </p>
              </div>
            )}

            {/* Overall verdict + actions */}
            {activeEntry && (() => {
              const cfg = OVERALL_CFG[activeAssessment.overall];
              const isPending = activeEntry.disposition === "pending";
              return (
                <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: "1px", padding: "1.1rem 1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: isPending ? "0.75rem" : 0 }}>
                    <span style={{ color: cfg.text, fontFamily: mono, fontSize: "0.8rem", letterSpacing: "0.1em" }}>
                      {activeAssessment.overall}
                    </span>
                    <span style={{ color: cfg.text, fontSize: "0.78rem", opacity: 0.85 }}>
                      {activeAssessment.rationale}
                    </span>
                  </div>

                  {isPending && (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      {activeAssessment.overall === "ACCEPT" && activeAssessment.test5_placement && (
                        <button
                          onClick={() => accept(activeAssessment, activeEntry.id)}
                          disabled={saving}
                          style={{ background: C.accept, border: "none", color: "#fff", fontFamily: sans, fontSize: "0.72rem", letterSpacing: "0.06em", padding: "0.35rem 0.9rem", cursor: "pointer", borderRadius: "1px", opacity: saving ? 0.55 : 1 }}
                        >
                          {saving ? "Placing…" : `Accept → ${activeAssessment.test5_placement.geocode}`}
                        </button>
                      )}
                      <button
                        onClick={() => updateDisposition(activeEntry.id, "referred")}
                        style={{ background: "transparent", border: `1px solid ${C.refer}`, color: C.referText, fontFamily: sans, fontSize: "0.72rem", letterSpacing: "0.06em", padding: "0.35rem 0.9rem", cursor: "pointer", borderRadius: "1px" }}
                      >
                        Refer
                      </button>
                      <button
                        onClick={() => updateDisposition(activeEntry.id, "rejected")}
                        style={{ background: "transparent", border: `1px solid ${C.reject}`, color: C.rejectText, fontFamily: sans, fontSize: "0.72rem", letterSpacing: "0.06em", padding: "0.35rem 0.9rem", cursor: "pointer", borderRadius: "1px" }}
                      >
                        Reject
                      </button>
                      {saveMsg && <span style={{ color: C.acceptText, fontSize: "0.72rem" }}>{saveMsg}</span>}
                    </div>
                  )}

                  {!isPending && (
                    <div style={{ color: C.muted, fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {activeEntry.disposition}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── History sidebar ── */}
      <div style={{ background: C.surface, borderLeft: `1px solid ${C.border}`, padding: "1.5rem 1rem", overflowY: "auto" }}>
        <div style={{ color: C.muted, fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
          Session log
        </div>

        {history.length === 0 && (
          <p style={{ color: C.subtle, fontSize: "0.72rem", lineHeight: 1.6 }}>
            No consultations yet this session.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {history.map(entry => {
            const cfg = OVERALL_CFG[entry.overall];
            const isActive = (selected?.id ?? history[0]?.id) === entry.id;
            return (
              <div
                key={entry.id}
                onClick={() => setSelected(entry)}
                style={{
                  background: isActive ? C.surfaceHigh : "transparent",
                  border: `1px solid ${isActive ? C.borderHigh : C.border}`,
                  borderRadius: "1px", padding: "0.6rem 0.75rem",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ color: C.text, fontSize: "0.78rem", fontFamily: serif }}>
                    {entry.candidate}
                  </span>
                  <span style={{ color: cfg.text, fontSize: "0.6rem", fontFamily: mono, letterSpacing: "0.06em", flexShrink: 0 }}>
                    {entry.overall}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {entry.geocode && (
                    <span style={{ color: C.goldDim, fontFamily: mono, fontSize: "0.68rem" }}>{entry.geocode}</span>
                  )}
                  <span style={{ color: C.subtle, fontSize: "0.65rem", marginLeft: "auto" }}>{entry.timestamp}</span>
                </div>
                {entry.disposition !== "pending" && (
                  <div style={{ color: C.subtle, fontSize: "0.6rem", letterSpacing: "0.05em", marginTop: "0.15rem" }}>
                    {entry.disposition}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
