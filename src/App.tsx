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

interface AdjacentSpace {
  geocode: string;
  suggested_concept: string;
  reasoning: string;
}

interface AdjacentSpaces {
  inner: AdjacentSpace | null;
  outer: AdjacentSpace | null;
  lateral: AdjacentSpace | null;
}

interface Character {
  name: string;
  reasoning: string;
  cambridge_connection?: string;
}

interface Assessment {
  candidate: string;
  test1_granularity: TestResult;
  test2_novelty: TestResult;
  test3_coherence: TestResult;
  test4_systemic_benefit: TestResult;
  test5_placement: Placement | null;
  alternative_placements: any[] | null;
  slot_candidates: any[] | null;
  adjacent_spaces: AdjacentSpaces | null;
  recursive_reach: string | null;
  characters: {
    principal: { primary: Character; alternatives: Character[] };
    amanuensis: { primary: Character; alternatives: Character[] };
  } | null;
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


// ── LOCALISED MAP ──────────────────────────────────────────────────────────────────────

function LocalisedMap({ assessment }: { assessment: Assessment }) {
  if (!assessment.test5_placement || !assessment.adjacent_spaces) return null;

  const p = assessment.test5_placement;
  const adj = assessment.adjacent_spaces;

  const SCOL: Record<string, string> = {
    R: "#c44444", O: "#c77440", Y: "#b89020",
    G: "#2d7a5f", B: "#2255bb", P: "#7755bb",
  };

  const scaleLabel = (geocode: string) => {
    const map: Record<string, string> = {
      T: "Self", H: "Relational", O: "Community", D: "Societal", I: "Civilisational",
    };
    return map[geocode?.[1]?.toUpperCase()] ?? "";
  };

  const col    = SCOL[p.school_code] ?? "#888888";
  const trunc  = (s: string | undefined, n: number) =>
    !s ? "" : s.length > n ? s.slice(0, n - 1) + "…" : s;

  const borderCol = "#2a1f38";
  const dimBg    = "#0f0d14";

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ color: C.subtle, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
        Local map
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1px", padding: "0.5rem 0.5rem 0" }}>
        <svg width="100%" viewBox="0 0 640 196">

          {/* Scale axis */}
          <line x1="20" y1="132" x2="620" y2="132" stroke={borderCol} strokeWidth="0.5" />

          {/* Connector lines */}
          {adj.inner   && <line x1="148" y1="112" x2="228" y2="112" stroke={borderCol} strokeWidth="0.5" strokeDasharray="4 3" />}
          {adj.outer   && <line x1="412" y1="112" x2="492" y2="112" stroke={borderCol} strokeWidth="0.5" strokeDasharray="4 3" />}
          {adj.lateral && <line x1="320" y1="80"  x2="320" y2="44"  stroke={borderCol} strokeWidth="0.5" strokeDasharray="4 3" />}

          {/* ── Inner node ── */}
          {adj.inner && adj.inner.geocode && (
            <g>
              <rect x="18" y="84" width="130" height="56" rx="3" fill={dimBg} stroke={borderCol} strokeWidth="0.5" />
              <text x="83" y="100" textAnchor="middle" fontFamily={mono} fontSize="11" fill={SCOL[adj.inner.geocode[0]] ?? C.muted}>{adj.inner.geocode}</text>
              <text x="83" y="115" textAnchor="middle" fontFamily={sans} fontSize="9"  fill={C.muted}>{trunc(adj.inner.suggested_concept, 16)}</text>
              <text x="83" y="128" textAnchor="middle" fontFamily={sans} fontSize="8"  fill={C.subtle}>{scaleLabel(adj.inner.geocode)}</text>
              <text x="83" y="152" textAnchor="middle" fontFamily={sans} fontSize="7.5" letterSpacing="0.07em" fill={C.subtle}>INNER</text>
            </g>
          )}

          {/* ── Placed (centre) node ── */}
          <g>
            <rect x="228" y="74" width="184" height="72" rx="4" fill={col + "28"} stroke={col} strokeWidth="1" />
            <text x="320" y="96"  textAnchor="middle" fontFamily={mono} fontSize="13" fontWeight="500" fill={col}>{p.geocode}</text>
            <text x="320" y="113" textAnchor="middle" fontFamily={sans} fontSize="10" fill={C.text}>{trunc(assessment.candidate, 22)}</text>
            <text x="320" y="128" textAnchor="middle" fontFamily={sans} fontSize="9"  fill={C.muted}>{p.scale}</text>
            <text x="320" y="157" textAnchor="middle" fontFamily={sans} fontSize="7.5" letterSpacing="0.07em" fill={col}>PLACED</text>
          </g>

          {/* ── Outer node ── */}
          {adj.outer && adj.outer.geocode && (
            <g>
              <rect x="492" y="84" width="130" height="56" rx="3" fill={dimBg} stroke={borderCol} strokeWidth="0.5" />
              <text x="557" y="100" textAnchor="middle" fontFamily={mono} fontSize="11" fill={SCOL[adj.outer.geocode[0]] ?? C.muted}>{adj.outer.geocode}</text>
              <text x="557" y="115" textAnchor="middle" fontFamily={sans} fontSize="9"  fill={C.muted}>{trunc(adj.outer.suggested_concept, 16)}</text>
              <text x="557" y="128" textAnchor="middle" fontFamily={sans} fontSize="8"  fill={C.subtle}>{scaleLabel(adj.outer.geocode)}</text>
              <text x="557" y="152" textAnchor="middle" fontFamily={sans} fontSize="7.5" letterSpacing="0.07em" fill={C.subtle}>OUTER</text>
            </g>
          )}

          {/* ── Lateral node (above) ── */}
          {adj.lateral && adj.lateral.geocode && (
            <g>
              <rect x="255" y="14" width="130" height="50" rx="3" fill={dimBg} stroke={borderCol} strokeWidth="0.5" />
              <text x="320" y="30" textAnchor="middle" fontFamily={mono} fontSize="11" fill={SCOL[adj.lateral.geocode[0]] ?? C.muted}>{adj.lateral.geocode}</text>
              <text x="320" y="46" textAnchor="middle" fontFamily={sans} fontSize="9"  fill={C.muted}>{trunc(adj.lateral.suggested_concept, 16)}</text>
              <text x="320" y="82" textAnchor="middle" fontFamily={sans} fontSize="7.5" letterSpacing="0.07em" fill={C.subtle}>LATERAL</text>
            </g>
          )}

          {/* Scale axis labels */}
          <text x="83"  y="176" textAnchor="middle" fontFamily={sans} fontSize="7" letterSpacing="0.06em" fill={C.subtle}>← INNER SCALE</text>
          <text x="320" y="176" textAnchor="middle" fontFamily={sans} fontSize="7" letterSpacing="0.06em" fill={C.subtle}>PLACED SCALE</text>
          <text x="557" y="176" textAnchor="middle" fontFamily={sans} fontSize="7" letterSpacing="0.06em" fill={C.subtle}>OUTER SCALE →</text>
        </svg>
      </div>
    </div>
  );
}


// ── BEDEPLEX MAP ───────────────────────────────────────────────────────────────────────
// Renders the full BedePlex radial structure with pulsing dots for placed rooms.
// Design spec: 680×640 viewBox, centre (340,320), 6 spokes at 60° from -90° (Purple).

function BedePlexMap({ newGeocode, filledGeocodes }: { newGeocode: string; filledGeocodes: string[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const CX = 340, CY = 320;

  const SCHOOLS: Record<string, { angle: number; color: string }> = {
    P: { angle: -90, color: "#8855cc" },
    R: { angle: -30, color: "#cc3333" },
    O: { angle:  30, color: "#cc6622" },
    Y: { angle:  90, color: "#aaaa22" },
    G: { angle: 150, color: "#33aa44" },
    B: { angle: 210, color: "#3355cc" },
  };

  const SOLIDS: Record<string, { r: number; arm: number; rays: number }> = {
    T: { r: 52,  arm: 13, rays: 4  },
    H: { r: 90,  arm: 16, rays: 6  },
    O: { r: 133, arm: 20, rays: 8  },
    D: { r: 195, arm: 26, rays: 12 },
    I: { r: 265, arm: 34, rays: 20 },
  };

  const SCHOOL_ORDER = ["P", "R", "O", "Y", "G", "B"];
  const SOLID_ORDER  = ["T", "H", "O", "D", "I"];
  const rad = (d: number) => d * Math.PI / 180;
  const filledSet = new Set(filledGeocodes);

  const lines: React.ReactNode[]   = [];
  const dots: React.ReactNode[]    = [];
  const glows: React.ReactNode[]   = [];

  // Centre starburst (gold, 24 rays)
  for (let i = 0; i < 24; i++) {
    const a = (2 * Math.PI * i) / 24;
    lines.push(<line key={`cr${i}`} x1={CX} y1={CY} x2={CX + 9*Math.cos(a)} y2={CY + 9*Math.sin(a)} stroke="#c49a3c" strokeWidth="0.7" opacity="0.7" />);
    dots.push(<circle key={`cd${i}`} cx={CX + 12*Math.cos(a)} cy={CY + 12*Math.sin(a)} r="1.5" fill="#c49a3c" opacity="0.9" />);
  }
  dots.push(<circle key="cen" cx={CX} cy={CY} r="4.5" fill="#c49a3c" opacity="1" />);

  for (const sc of SCHOOL_ORDER) {
    const school = SCHOOLS[sc];
    const sa = rad(school.angle);
    const col = school.color;

    // Spoke backbone
    const fr = SOLIDS["I"].r + SOLIDS["I"].arm + 6;
    lines.push(<line key={`sp-${sc}`}
      x1={CX + 13*Math.cos(sa)} y1={CY + 13*Math.sin(sa)}
      x2={CX + fr*Math.cos(sa)} y2={CY + fr*Math.sin(sa)}
      stroke={col} strokeWidth="0.4" opacity="0.25"
    />);

    for (const soc of SOLID_ORDER) {
      const solid = SOLIDS[soc];
      const fx = CX + solid.r * Math.cos(sa);
      const fy = CY + solid.r * Math.sin(sa);

      dots.push(<circle key={`fac-${sc}${soc}`} cx={fx} cy={fy} r="2" fill={col} opacity="0.6" />);

      for (let ray = 0; ray < solid.rays; ray++) {
        const ra = sa + (2 * Math.PI * ray) / solid.rays;
        const ix = fx + solid.arm * 0.48 * Math.cos(ra);
        const iy = fy + solid.arm * 0.48 * Math.sin(ra);
        const ox = fx + solid.arm * Math.cos(ra);
        const oy = fy + solid.arm * Math.sin(ra);

        lines.push(<line key={`ray-${sc}${soc}-${ray}`} x1={fx} y1={fy} x2={ox} y2={oy} stroke={col} strokeWidth="0.5" opacity="0.35" />);
        dots.push(<circle  key={`in-${sc}${soc}-${ray}`}  cx={ix} cy={iy} r="1.5" fill={col} opacity="0.45" />);

        const geocode = `${sc}${soc}-R${ray + 1}`;
        const isNew    = geocode === newGeocode;
        const isFilled = !isNew && filledSet.has(geocode);
        const delay    = ((ray * 0.3 + SCHOOL_ORDER.indexOf(sc) * 1.1) % 5).toFixed(1);

        const onEnter = () => setHovered(geocode);
        const onLeave = () => setHovered(null);
        const isHov = hovered === geocode;

        if (isNew) {
          glows.push(<circle key={`glow-${geocode}`} cx={ox} cy={oy} r="5" fill={col} className="glow-new" />);
          dots.push(<circle key={`room-${geocode}`} cx={ox} cy={oy} r={isHov ? 4.5 : 3}
            fill={col} className="pulse-new" style={{ cursor: "pointer" }}
            onMouseEnter={onEnter} onMouseLeave={onLeave} />);
        } else if (isFilled) {
          dots.push(<circle key={`room-${geocode}`} cx={ox} cy={oy} r={isHov ? 4 : 2.5} fill={col}
            className="pulse-filled" style={{ animationDelay: `${delay}s`, cursor: "pointer" }}
            opacity={isHov ? 1 : 0.85} onMouseEnter={onEnter} onMouseLeave={onLeave} />);
        } else {
          dots.push(<circle key={`room-${geocode}`} cx={ox} cy={oy} r={isHov ? 3 : 2} fill={col}
            opacity={isHov ? 0.7 : 0.3} style={{ cursor: "pointer" }}
            onMouseEnter={onEnter} onMouseLeave={onLeave} />);
        }
      }
    }
  }

  return (
    <div style={{ marginTop: "1.75rem" }}>
      <div style={{ color: C.subtle, fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.6rem" }}>
        BedePlex map — {newGeocode} placed
      </div>
      <div style={{ background: "#050307", border: `1px solid ${C.border}`, borderRadius: "2px" }}>
        <svg width="100%" viewBox="0 0 680 640">
          <style>{`
            @keyframes pulseNew {
              0%,100% { opacity:1; }
              50%      { opacity:0.1; }
            }
            @keyframes glowNew {
              0%,100% { opacity:0; transform:scale(1); }
              50%      { opacity:0.45; transform:scale(2.2); }
            }
            @keyframes pulseFilled {
              0%,100% { opacity:0.85; }
              50%      { opacity:0.2; }
            }
            .pulse-new    { animation: pulseNew    1.5s ease-in-out infinite; }
            .glow-new     { animation: glowNew     1.5s ease-in-out infinite;
                            transform-box:fill-box; transform-origin:center; }
            .pulse-filled { animation: pulseFilled 5s   ease-in-out infinite; }
          `}</style>
          <rect width="680" height="640" fill="#050307" />
          {lines}
          {glows}
          {dots}

          {/* Hover tooltip */}
          {hovered && (() => {
            const sc = hovered[0];
            const so = hovered[1];
            const slot = parseInt(hovered.split("-R")[1]);
            const school = SCHOOLS[sc];
            const solid  = SOLIDS[so];
            if (!school || !solid) return null;
            const sa = rad(school.angle);
            const fx = CX + solid.r * Math.cos(sa);
            const fy = CY + solid.r * Math.sin(sa);
            const ra = sa + (2 * Math.PI * (slot - 1)) / solid.rays;
            const tx = fx + solid.arm * Math.cos(ra);
            const ty = fy + solid.arm * Math.sin(ra);
            const flip = tx > 420;
            const bx = flip ? tx - 130 : tx + 8;
            const by = Math.max(14, Math.min(ty - 16, 600));
            const isNew    = hovered === newGeocode;
            const isFilled = !isNew && filledSet.has(hovered);
            const status   = isNew ? "just placed" : isFilled ? "placed" : "empty";
            return (
              <g key="tooltip">
                <rect x={bx} y={by} width="122" height="32" rx="2"
                  fill="#0c0910" stroke={school.color} strokeWidth="0.5" opacity="0.97" />
                <text x={bx + 6} y={by + 13} fontFamily={mono} fontSize="10" fill={school.color}>{hovered}</text>
                <text x={bx + 6} y={by + 24} fontFamily={sans} fontSize="8.5" fill="#7a7068">{status}</text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}

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
  const [confidence,   setConfidence]   = useState(3);
  const [notes,        setNotes]        = useState("");
  const [showMapFor,   setShowMapFor]   = useState<{ geocode: string; filledGeocodes: string[] } | null>(null);
  const [loadingMap,   setLoadingMap]   = useState(false);
  const [selected,     setSelected]     = useState<HistoryEntry | null>(null);

  const reset = () => {
    setCandidate("");
    setDescription("");
    setAssessment(null);
    setError("");
    setSaveMsg("");
    setSelected(null);
    setConfidence(3);
    setNotes("");
    setShowMapFor(null);
  };

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
        geocode:           a.test5_placement.geocode,
        name:              a.candidate,
        school_code:       a.test5_placement.school_code,
        solid_code:        a.test5_placement.solid_code,
        slot:              a.test5_placement.slot,
        confidence,
        placement_notes:   notes.trim() || null,
        oracle_note:       JSON.stringify({
          rationale:           a.rationale,
          recursive_reach:     a.recursive_reach,
          placement_reasoning: a.test5_placement.reasoning,
        }),
        placement_source:  "oracle",
      }, "return=minimal");
      updateDisposition(entryId, "accepted");
      setSaveMsg(`Placed at ${a.test5_placement.geocode}`);

      // Load all filled geocodes to show pulsing map
      setLoadingMap(true);
      try {
        const filled = await db("capacity_register?select=geocode&geocode=not.is.null", "GET");
        const geocodes: string[] = (filled ?? []).map((r: any) => r.geocode).filter(Boolean);
        setShowMapFor({ geocode: a.test5_placement.geocode, filledGeocodes: geocodes });
      } catch { /* map loading is non-critical */ }
      setLoadingMap(false);
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

            {/* Localised map */}
            {activeAssessment.test5_placement && activeAssessment.adjacent_spaces && (
              <LocalisedMap assessment={activeAssessment} />
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


            {/* Alternative placements */}
            {activeAssessment.alternative_placements && activeAssessment.alternative_placements.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: C.subtle, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Alternative placements
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {activeAssessment.alternative_placements.map((alt: any, i: number) => (
                    <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1px", padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
                        <span style={{ fontFamily: mono, fontSize: "0.82rem", color: C.goldDim, border: `1px solid ${C.goldDim}`, padding: "0.1rem 0.4rem", borderRadius: "1px" }}>
                          {alt.geocode}
                        </span>
                        <span style={{ color: SCHOOL_COLOURS[alt.school_code] ?? C.muted, fontSize: "0.75rem" }}>{alt.school}</span>
                        <span style={{ color: C.subtle, fontSize: "0.72rem" }}>{alt.scale}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        <div>
                          <span style={{ color: C.acceptText, fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "0.15rem" }}>Strong</span>
                          <p style={{ color: C.muted, fontSize: "0.74rem", margin: 0, lineHeight: 1.55 }}>{alt.strength}</p>
                        </div>
                        <div>
                          <span style={{ color: C.referText, fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "0.15rem" }}>Weak</span>
                          <p style={{ color: C.muted, fontSize: "0.74rem", margin: 0, lineHeight: 1.55 }}>{alt.weakness}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slot candidates */}
            {activeAssessment.slot_candidates && activeAssessment.slot_candidates.length > 0 && activeAssessment.test5_placement && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: C.subtle, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Other candidates for {activeAssessment.test5_placement.geocode}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  {activeAssessment.slot_candidates.map((sc: any, i: number) => (
                    <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1px", padding: "0.55rem 1rem", display: "flex", gap: "0.75rem", alignItems: "baseline" }}>
                      <span style={{ color: C.text, fontFamily: serif, fontSize: "0.88rem", flexShrink: 0 }}>{sc.name}</span>
                      <span style={{ color: C.muted, fontSize: "0.74rem", lineHeight: 1.5 }}>{sc.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Characters */}
            {activeAssessment.characters && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: C.subtle, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Characters
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {/* Principal */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1px", padding: "0.85rem 1rem" }}>
                    <div style={{ color: C.subtle, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Principal</div>
                    <div style={{ color: C.text, fontFamily: serif, fontSize: "1rem", fontWeight: 300, marginBottom: "0.25rem" }}>
                      {activeAssessment.characters.principal.primary.name}
                    </div>
                    <p style={{ color: C.muted, fontSize: "0.74rem", margin: "0 0 0.6rem", lineHeight: 1.55 }}>
                      {activeAssessment.characters.principal.primary.reasoning}
                    </p>
                    {activeAssessment.characters.principal.alternatives.map((a: Character, i: number) => (
                      <div key={i} style={{ color: C.subtle, fontSize: "0.72rem", display: "flex", gap: "0.4rem", marginBottom: "0.2rem" }}>
                        <span style={{ color: C.goldDim, flexShrink: 0 }}>·</span>
                        <span>{a.name} — {a.reasoning}</span>
                      </div>
                    ))}
                  </div>
                  {/* Amanuensis */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1px", padding: "0.85rem 1rem" }}>
                    <div style={{ color: C.subtle, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Cambridge amanuensis</div>
                    <div style={{ color: C.text, fontFamily: serif, fontSize: "1rem", fontWeight: 300, marginBottom: "0.15rem" }}>
                      {activeAssessment.characters.amanuensis.primary.name}
                    </div>
                    {activeAssessment.characters.amanuensis.primary.cambridge_connection && (
                      <div style={{ color: C.goldDim, fontSize: "0.68rem", fontFamily: sans, marginBottom: "0.25rem", fontStyle: "italic" }}>
                        {activeAssessment.characters.amanuensis.primary.cambridge_connection}
                      </div>
                    )}
                    <p style={{ color: C.muted, fontSize: "0.74rem", margin: "0 0 0.6rem", lineHeight: 1.55 }}>
                      {activeAssessment.characters.amanuensis.primary.reasoning}
                    </p>
                    {activeAssessment.characters.amanuensis.alternatives.map((a: Character, i: number) => (
                      <div key={i} style={{ color: C.subtle, fontSize: "0.72rem", display: "flex", gap: "0.4rem", marginBottom: "0.2rem" }}>
                        <span style={{ color: C.goldDim, flexShrink: 0 }}>·</span>
                        <span>{a.name}{a.cambridge_connection ? ` (${a.cambridge_connection})` : ""} — {a.reasoning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Adjacent spaces */}
            {activeAssessment.adjacent_spaces && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: C.subtle, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Adjacent spaces
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
                  {[
                    { key: "inner", label: "Inner", desc: "prerequisite" },
                    { key: "lateral", label: "Lateral", desc: "alongside" },
                    { key: "outer", label: "Outer", desc: "extension" },
                  ].map(({ key, label, desc }) => {
                    const adj = (activeAssessment.adjacent_spaces as any)[key];
                    if (!adj) return null;
                    return (
                      <div key={key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1px", padding: "0.75rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.35rem" }}>
                          <span style={{ color: C.muted, fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
                          <span style={{ fontFamily: mono, fontSize: "0.72rem", color: C.goldDim }}>{adj.geocode}</span>
                        </div>
                        <div style={{ color: C.text, fontFamily: serif, fontSize: "0.84rem", marginBottom: "0.25rem" }}>{adj.suggested_concept}</div>
                        <div style={{ color: C.subtle, fontSize: "0.7rem", lineHeight: 1.5 }}>{adj.reasoning}</div>
                      </div>
                    );
                  })}
                </div>
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
                        <div style={{ width: "100%", marginBottom: "0.75rem" }}>
                          {/* Confidence rating */}
                          <div style={{ marginBottom: "0.6rem" }}>
                            <div style={{ color: C.muted, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                              Your confidence in this placement
                            </div>
                            <div style={{ display: "flex", gap: "0.3rem" }}>
                              {[1,2,3,4,5].map(n => (
                                <button key={n} onClick={() => setConfidence(n)} style={{
                                  width: "32px", height: "32px", borderRadius: "1px",
                                  background: n <= confidence ? C.goldFaint : "transparent",
                                  border: `1px solid ${n <= confidence ? C.gold : C.inputBorder}`,
                                  color: n <= confidence ? C.gold : C.muted,
                                  fontFamily: serif, fontSize: "1rem", cursor: "pointer",
                                }}>
                                  {n}
                                </button>
                              ))}
                              <span style={{ color: C.muted, fontSize: "0.72rem", alignSelf: "center", marginLeft: "0.5rem" }}>
                                {["","uncertain","possible","likely","confident","certain"][confidence]}
                              </span>
                            </div>
                          </div>
                          {/* Notes */}
                          <div style={{ marginBottom: "0.75rem" }}>
                            <div style={{ color: C.muted, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                              Notes <span style={{ color: C.subtle, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                            </div>
                            <textarea
                              value={notes}
                              onChange={e => setNotes(e.target.value)}
                              placeholder="Reasoning, reservations, context for this placement…"
                              style={{
                                width: "100%", background: C.inputBg, border: `1px solid ${C.inputBorder}`,
                                borderRadius: "1px", color: C.text, fontFamily: sans, fontSize: "0.78rem",
                                padding: "0.5rem 0.7rem", boxSizing: "border-box", outline: "none",
                                minHeight: "68px", resize: "vertical", lineHeight: 1.5,
                              }}
                              onFocus={e => e.target.style.borderColor = C.goldDim}
                              onBlur={e  => e.target.style.borderColor = C.inputBorder}
                            />
                          </div>
                          <button
                            onClick={() => accept(activeAssessment, activeEntry.id)}
                            disabled={saving}
                            style={{ background: C.accept, border: "none", color: "#fff", fontFamily: sans, fontSize: "0.72rem", letterSpacing: "0.06em", padding: "0.35rem 0.9rem", cursor: "pointer", borderRadius: "1px", opacity: saving ? 0.55 : 1 }}
                          >
                            {saving ? "Placing…" : `Accept & place → ${activeAssessment.test5_placement.geocode}`}
                          </button>
                        </div>
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

            {/* BedePlex map post-acceptance */}
            {showMapFor && (
              <BedePlexMap newGeocode={showMapFor.geocode} filledGeocodes={showMapFor.filledGeocodes} />
            )}
            {loadingMap && (
              <p style={{ color: C.muted, fontSize: "0.75rem", marginTop: "1rem" }}>Loading BedePlex…</p>
            )}

            <button
              onClick={reset}
              style={{
                marginTop: "1.25rem", background: "transparent",
                border: `1px solid ${C.border}`, color: C.muted,
                fontFamily: sans, fontSize: "0.75rem", letterSpacing: "0.08em",
                padding: "0.5rem 1.25rem", cursor: "pointer", borderRadius: "1px",
              }}
            >
              ← New candidate
            </button>
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
