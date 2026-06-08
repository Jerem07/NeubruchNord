import { useState, useEffect } from "react";

const DRINKS = [
  { id: "beer",      emoji: "🍺", name: "Bière",     points: 1 },
  { id: "shot",      emoji: "🥃", name: "Shot",      points: 2 },
  { id: "wine",      emoji: "🍷", name: "Vin",       points: 1.5 },
  { id: "cocktail",  emoji: "🍹", name: "Cocktail",  points: 1.5 },
  { id: "champagne", emoji: "🥂", name: "Champagne", points: 1 },
  { id: "vodka",     emoji: "🍸", name: "Vodka",     points: 2 },
  { id: "rhum",      emoji: "🧉", name: "Rhum",      points: 1.5 },
  { id: "water",     emoji: "💧", name: "Eau",       points: 0 },
];
const DRINK_LEVELS = [
  { min: 0,  label: "Sobre",      color: "#4ade80" },
  { min: 3,  label: "Chaud",      color: "#facc15" },
  { min: 6,  label: "Bien lancé", color: "#fb923c" },
  { min: 10, label: "Défoncé",    color: "#f87171" },
  { min: 15, label: "Légende ☠️", color: "#c084fc" },
];
const FLIRT_ACTIONS = [
  { id: "date",     emoji: "📅", name: "Date",         points: 1 },
  { id: "galoche",  emoji: "💋", name: "Galoche",      points: 2 },
  { id: "dategalo", emoji: "🔥", name: "Date galoche", points: 3 },
  { id: "prepre",   emoji: "👀", name: "Pré préli",    points: 4 },
  { id: "preli",    emoji: "😏", name: "Préli",        points: 6 },
  { id: "bz",       emoji: "🍆", name: "Bz",           points: 8 },
  { id: "dslcul",   emoji: "🍑", name: "Ds le cul",    points: 15 },
];
const FLIRT_LEVELS = [
  { min: 0,  label: "Timide 🫣",   color: "#94a3b8" },
  { min: 2,  label: "En approche", color: "#60a5fa" },
  { min: 5,  label: "Chaud 🔥",   color: "#f472b6" },
  { min: 10, label: "Magnétique",  color: "#e879f9" },
  { min: 18, label: "Légende 👑",  color: "#fbbf24" },
];

const SESSION_DURATION = 12 * 60 * 60 * 1000; // 12h

function getLevel(score, levels) {
  let cur = levels[0];
  for (const l of levels) { if (score >= l.min) cur = l; }
  return cur;
}
function genCode() { return Math.random().toString(36).substring(2, 7).toUpperCase(); }
function formatTimeLeft(ms) {
  if (ms <= 0) return "Terminée";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h${m.toString().padStart(2, "0")}`;
}
const SK = (mode) => `nightlog_${mode}_v1`;
function loadSessions(mode) { try { return JSON.parse(localStorage.getItem(SK(mode))) || {}; } catch { return {}; } }
function saveSessions(mode, data) { localStorage.setItem(SK(mode), JSON.stringify(data)); }
const PROFILE_KEY = "nightlog_profile_v1";
function loadProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; } catch { return null; } }
function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

export default function App() {
  const [profile, setProfile] = useState(() => loadProfile());
  const [ob, setOb] = useState({ prenom: "", nom: "", age: "", poids: "", taille: "" });
  const [obError, setObError] = useState("");
  const [appMode, setAppMode] = useState(null);
  const [screen, setScreen] = useState("home");
  const [sessions, setSessions] = useState({});
  const [currentSession, setCurrentSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [sessionNameInput, setSessionNameInput] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showMemberDetail, setShowMemberDetail] = useState(null); // name of member to show
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const ITEMS  = appMode === "drink" ? DRINKS : FLIRT_ACTIONS;
  const LEVELS = appMode === "drink" ? DRINK_LEVELS : FLIRT_LEVELS;
  const ACCENT = appMode === "drink" ? "#facc15" : "#f472b6";

  // Tick every 30s for timer
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (appMode) setSessions(loadSessions(appMode)); }, [appMode]);
  useEffect(() => { if (appMode) saveSessions(appMode, sessions); }, [sessions, appMode]);
  useEffect(() => { if (profile && screen !== "session") setNameInput(profile.prenom); }, [profile, screen]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2200); }
  function reset() { setScreen("home"); setCurrentSession(null); setCurrentUser(null); setNameInput(profile ? profile.prenom : ""); setSessionNameInput(""); setJoinCode(""); setError(""); setShowMenu(false); setShowMemberDetail(null); }

  function submitOnboarding() {
    const { prenom, nom, age, poids, taille } = ob;
    if (!prenom.trim() || !nom.trim() || !age || !poids || !taille) { setObError("Remplis tout stp 🙏"); return; }
    if (isNaN(age) || isNaN(poids) || isNaN(taille)) { setObError("Âge, poids et taille = chiffres stp"); return; }
    const p = { prenom: prenom.trim(), nom: nom.trim(), age: parseInt(age), poids: parseInt(poids), taille: parseInt(taille) };
    saveProfile(p); setProfile(p); setObError("");
  }

  function createSession() {
    if (!sessionNameInput.trim() || !nameInput.trim()) { setError("Remplis tout stp"); return; }
    const code = genCode();
    const session = {
      code, name: sessionNameInput.trim(), createdAt: Date.now(),
      endsAt: Date.now() + SESSION_DURATION,
      creator: nameInput.trim(),
      ended: false,
      members: { [nameInput.trim()]: { items: [], score: 0 } }
    };
    const updated = { ...sessions, [code]: session };
    setSessions(updated); setCurrentSession(code); setCurrentUser(nameInput.trim()); setScreen("session"); setError("");
  }

  function joinSession() {
    const code = joinCode.toUpperCase().trim();
    if (!sessions[code]) { setError("Session introuvable"); return; }
    const s = sessions[code];
    if (s.ended || Date.now() > s.endsAt) { setError("Cette session est terminée"); return; }
    if (!nameInput.trim()) { setError("Entre ton prénom"); return; }
    const updated = { ...sessions };
    if (!updated[code].members[nameInput.trim()]) updated[code].members[nameInput.trim()] = { items: [], score: 0 };
    setSessions(updated); setCurrentSession(code); setCurrentUser(nameInput.trim()); setScreen("session"); setError("");
  }

  function addItem(item) {
    const updated = { ...sessions };
    const member = updated[currentSession].members[currentUser];
    member.items.push({ ...item, time: Date.now() });
    member.score = parseFloat((member.score + item.points).toFixed(1));
    setSessions(updated); setShowMenu(false);
    showToast(`${item.emoji} +${item.points} pt${item.points > 1 ? "s" : ""}`);
  }

  function removeLast() {
    const updated = { ...sessions };
    const member = updated[currentSession].members[currentUser];
    if (!member.items.length) return;
    const last = member.items.pop();
    member.score = parseFloat(Math.max(0, member.score - last.points).toFixed(1));
    setSessions(updated); showToast("Annulé ✓");
  }

  function endSessionNow() {
    const updated = { ...sessions };
    updated[currentSession].ended = true;
    updated[currentSession].endsAt = Date.now();
    setSessions(updated); setShowEndConfirm(false); showToast("Session terminée 🏁");
  }

  const session = currentSession ? sessions[currentSession] : null;
  const isCreator = session && currentUser === session.creator;
  const sessionExpired = session && (session.ended || Date.now() > session.endsAt);
  const timeLeft = session ? Math.max(0, session.endsAt - now) : 0;
  const members = session ? Object.entries(session.members).sort((a, b) => b[1].score - a[1].score) : [];
  const me = session && currentUser ? session.members[currentUser] : null;

  // ── ONBOARDING ──────────────────────────────────────────────
  if (!profile) return (
    <div style={S.root}>
      <div style={S.obScreen}>
        <div style={S.obHero}>
          <div style={S.obEmoji}>👋</div>
          <h1 style={S.obTitle}>Bienvenue</h1>
          <p style={S.obSub}>Crée ton profil pour commencer</p>
        </div>
        <div style={S.obRow}>
          <input style={S.obInput} placeholder="Prénom" value={ob.prenom} onChange={e => setOb({ ...ob, prenom: e.target.value })} />
          <input style={S.obInput} placeholder="Nom" value={ob.nom} onChange={e => setOb({ ...ob, nom: e.target.value })} />
        </div>
        <input style={S.input} placeholder="Âge" type="number" inputMode="numeric" value={ob.age} onChange={e => setOb({ ...ob, age: e.target.value })} />
        <div style={S.obRow}>
          <div style={S.obFieldWrap}>
            <input style={S.obInput} placeholder="Poids" type="number" inputMode="numeric" value={ob.poids} onChange={e => setOb({ ...ob, poids: e.target.value })} />
            <span style={S.obUnit}>kg</span>
          </div>
          <div style={S.obFieldWrap}>
            <input style={S.obInput} placeholder="Taille" type="number" inputMode="numeric" value={ob.taille} onChange={e => setOb({ ...ob, taille: e.target.value })} />
            <span style={S.obUnit}>cm</span>
          </div>
        </div>
        {obError && <p style={S.error}>{obError}</p>}
        <button style={S.obBtn} onClick={submitOnboarding}>C'est parti 🚀</button>
      </div>
    </div>
  );

  // ── CHOOSE MODE ─────────────────────────────────────────────
  if (!appMode) return (
    <div style={S.root}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.modeScreen}>
        <div style={S.modeHero}>
          <button style={S.editProfileBtn} onClick={() => { localStorage.removeItem(PROFILE_KEY); setProfile(null); }}>✏️ Modifier mon profil</button>
          <p style={S.modeTagline}>Neubruch Nord</p>
          <p style={S.modeWelcome}>Hello my friends 🤝</p>
        </div>
        <button style={{ ...S.modeCard, borderColor: "#facc15" }} onClick={() => { setAppMode("drink"); setScreen("home"); }}>
          <span style={S.modeIcon}>🍺</span>
          <div><p style={S.modeTitle}>NightLog</p><p style={S.modeSub}>Tracker de conso entre potes</p></div>
          <span style={{ ...S.modeArrow, color: "#facc15" }}>→</span>
        </button>
        <button style={{ ...S.modeCard, borderColor: "#f472b6" }} onClick={() => { setAppMode("flirt"); setScreen("home"); }}>
          <span style={S.modeIcon}>💋</span>
          <div><p style={S.modeTitle}>FlirtLog</p><p style={S.modeSub}>Kiss, dates, numéros — qui kiffe le plus</p></div>
          <span style={{ ...S.modeArrow, color: "#f472b6" }}>→</span>
        </button>
      </div>
    </div>
  );

  // ── HOME ────────────────────────────────────────────────────
  if (screen === "home") return (
    <div style={S.root}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.screen}>
        <button style={S.modeSwitch} onClick={() => setAppMode(null)}>← Changer de mode</button>
        <div style={S.hero}>
          <div style={S.heroIcon}>{appMode === "drink" ? "🍺" : "💋"}</div>
          <h1 style={S.title}>{appMode === "drink" ? "NightLog" : "FlirtLog"}</h1>
          <p style={S.sub}>{appMode === "drink" ? "Track la conso de ta soirée" : "Compte tes conquêtes de la nuit"}</p>
        </div>
        <div style={S.btnGroup}>
          <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #ff9a3c, #ff6b6b)", color: "#fff" }}
            onClick={() => { setScreen("create"); setError(""); setSessionNameInput(""); }}>
            + Créer une session
          </button>
          <button style={S.btnSecondary} onClick={() => { setScreen("join"); setError(""); setJoinCode(""); }}>Rejoindre</button>
        </div>
        {Object.keys(sessions).length > 0 && (
          <div style={S.recentBlock}>
            <p style={S.recentLabel}>Sessions récentes</p>
            {Object.entries(sessions).slice(-3).reverse().map(([code, s]) => (
              <button key={code} style={S.recentItem} onClick={() => { setJoinCode(code); setScreen("join"); setError(""); }}>
                <span style={S.recentName}>{s.name}</span>
                <span style={{ ...S.recentCode, color: s.ended || Date.now() > s.endsAt ? "#f87171" : "rgba(255,200,100,0.5)" }}>
                  {s.ended || Date.now() > s.endsAt ? "Terminée" : code}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── CREATE ──────────────────────────────────────────────────
  if (screen === "create") return (
    <div style={S.root}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.screen}>
        <button style={S.back} onClick={() => setScreen("home")}>← Retour</button>
        <h2 style={S.formTitle}>Nouvelle session</h2>
        <p style={S.formSub}>Durée automatique : 12h ⏱️</p>
        <input style={S.input} placeholder={appMode === "drink" ? "Nom de la soirée (ex: Chez Hugo)" : "Nom de la session"}
          value={sessionNameInput} onChange={e => setSessionNameInput(e.target.value)} />
        <div style={S.profileHint}>
          <span style={S.profileHintTxt}>Tu rejoins en tant que</span>
          <span style={S.profileHintName}>{profile.prenom}</span>
        </div>
        {error && <p style={S.error}>{error}</p>}
        <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #ff9a3c, #ff6b6b)", color: "#fff" }} onClick={createSession}>Créer 🚀</button>
      </div>
    </div>
  );

  // ── JOIN ────────────────────────────────────────────────────
  if (screen === "join") return (
    <div style={S.root}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.screen}>
        <button style={S.back} onClick={() => setScreen("home")}>← Retour</button>
        <h2 style={S.formTitle}>Rejoindre</h2>
        <input style={{ ...S.input, textTransform: "uppercase", letterSpacing: 4, fontWeight: 700 }}
          placeholder="CODE" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={5} />
        <div style={S.profileHint}>
          <span style={S.profileHintTxt}>Tu rejoins en tant que</span>
          <span style={S.profileHintName}>{profile.prenom}</span>
        </div>
        {error && <p style={S.error}>{error}</p>}
        <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #ff9a3c, #ff6b6b)", color: "#fff" }} onClick={joinSession}>Rejoindre</button>
      </div>
    </div>
  );

  // ── SESSION ─────────────────────────────────────────────────
  if (screen === "session" && session && me) return (
    <div style={S.root}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.sessionRoot}>

        {/* Header */}
        <div style={S.sessionHeader}>
          <div>
            <p style={S.sessionName}>{session.name}</p>
            <div style={S.sessionMeta}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{currentSession}</span>
              <span style={S.sessionTimer}>
                {sessionExpired ? "⏹ Terminée" : `⏱ ${formatTimeLeft(timeLeft)}`}
              </span>
            </div>
          </div>
          <button style={S.leaveBtn} onClick={reset}>Quitter</button>
        </div>

        {/* Expired banner */}
        {sessionExpired && (
          <div style={S.expiredBanner}>🏁 La soirée est terminée — scores figés</div>
        )}

        {/* My card */}
        {!sessionExpired && (
          <div style={{ ...S.myCard, borderColor: getLevel(me.score, LEVELS).color }}>
            <div style={S.myName}>{currentUser}</div>
            <div style={{ ...S.myLevel, color: getLevel(me.score, LEVELS).color }}>{getLevel(me.score, LEVELS).label}</div>
            <div style={S.myItems}>
              {me.items.length === 0
                ? <span style={{ opacity: 0.3, fontSize: 13 }}>Rien encore…</span>
                : me.items.slice(-8).map((d, i) => <span key={i} style={S.itemChip}>{d.emoji}</span>)}
            </div>
            <div style={S.myScore}>
              <span style={{ color: ACCENT, fontWeight: 800, fontSize: 22 }}>{me.score}</span>
              <span style={{ color: "rgba(255,200,100,0.4)", fontSize: 13, marginLeft: 4 }}>pts · {me.items.length} action{me.items.length > 1 ? "s" : ""}</span>
            </div>
            <div style={S.cardActions}>
              <button style={{ ...S.addBtn, background: "linear-gradient(135deg, #ff9a3c, #ff6b6b)", color: "#fff" }} onClick={() => setShowMenu(true)}>+ Ajouter</button>
              {me.items.length > 0 && <button style={S.undoBtn} onClick={removeLast}>↩</button>}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div style={S.leaderboard}>
          <p style={S.lbTitle}>🏆 Classement — appuie pour voir le détail</p>
          {members.map(([name, data], i) => {
            const level = getLevel(data.score, LEVELS);
            const isMe = name === currentUser;
            return (
              <div key={name} style={{ ...S.lbRow, background: isMe ? "rgba(255,200,100,0.08)" : "transparent", cursor: "pointer" }}
                onClick={() => setShowMemberDetail(name)}>
                <span style={{ ...S.lbRank, color: i === 0 ? "#fbbf24" : "rgba(255,200,100,0.4)" }}>#{i + 1}</span>
                <span style={S.lbName}>{name}{isMe ? " (moi)" : ""}</span>
                <span style={{ ...S.lbLevel, color: level.color }}>{level.label}</span>
                <span style={{ ...S.lbCount, color: ACCENT }}>{data.score}pts</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>›</span>
              </div>
            );
          })}
        </div>

        {/* Creator: end session button */}
        {isCreator && !sessionExpired && (
          <button style={S.endSessionBtn} onClick={() => setShowEndConfirm(true)}>
            🏁 Terminer la session maintenant
          </button>
        )}

        {/* Drink/action menu */}
        {showMenu && (
          <div style={S.overlay} onClick={() => setShowMenu(false)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <p style={S.modalTitle}>{appMode === "drink" ? "Qu'est-ce que tu bois ?" : "Qu'est-ce qui s'est passé ? 👀"}</p>
              <div style={S.itemGrid}>
                {ITEMS.map(item => (
                  <button key={item.id} style={S.itemOption} onClick={() => addItem(item)}>
                    <span style={S.itemEmoji}>{item.emoji}</span>
                    <span style={S.itemName}>{item.name}</span>
                    <span style={{ ...S.itemPts, color: ACCENT }}>+{item.points}pt{item.points > 1 ? "s" : ""}</span>
                  </button>
                ))}
              </div>
              <button style={S.cancelBtn} onClick={() => setShowMenu(false)}>Annuler</button>
            </div>
          </div>
        )}

        {/* Member detail modal */}
        {showMemberDetail && session.members[showMemberDetail] && (
          <div style={S.overlay} onClick={() => setShowMemberDetail(null)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <p style={S.modalTitle}>{showMemberDetail} 👀</p>
              <div style={S.detailScroll}>
                {session.members[showMemberDetail].items.length === 0
                  ? <p style={{ color: "rgba(255,200,100,0.4)", textAlign: "center", fontSize: 14 }}>Rien encore…</p>
                  : [...session.members[showMemberDetail].items].reverse().map((item, i) => (
                    <div key={i} style={S.detailRow}>
                      <span style={S.detailEmoji}>{item.emoji}</span>
                      <span style={S.detailItemName}>{item.name}</span>
                      <span style={{ ...S.detailPts, color: ACCENT }}>+{item.points}pts</span>
                      <span style={S.detailTime}>{new Date(item.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))
                }
              </div>
              <button style={S.cancelBtn} onClick={() => setShowMemberDetail(null)}>Fermer</button>
            </div>
          </div>
        )}

        {/* End session confirm */}
        {showEndConfirm && (
          <div style={S.overlay} onClick={() => setShowEndConfirm(false)}>
            <div style={{ ...S.modal, padding: "28px 20px 40px" }} onClick={e => e.stopPropagation()}>
              <p style={S.modalTitle}>Terminer la session ?</p>
              <p style={{ color: "rgba(255,220,150,0.6)", textAlign: "center", fontSize: 14, margin: "0 0 24px" }}>
                Les scores seront figés pour tout le monde
              </p>
              <button style={{ ...S.btnPrimary, background: "#f87171", color: "#fff", width: "100%", marginBottom: 10 }} onClick={endSessionNow}>
                Oui, terminer 🏁
              </button>
              <button style={S.cancelBtn} onClick={() => setShowEndConfirm(false)}>Annuler</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  return null;
}

const S = {
  root: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #1a0533 0%, #0d1f3c 40%, #0a2e1a 100%)",
    color: "#fff",
    fontFamily: "'Trebuchet MS', 'Gill Sans', sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "0 0 60px", position: "relative",
    backgroundAttachment: "fixed",
  },
  obScreen: { width: "100%", maxWidth: 420, padding: "70px 24px 40px", display: "flex", flexDirection: "column", gap: 14 },
  obHero: { textAlign: "center", marginBottom: 10 },
  obEmoji: { fontSize: 52, marginBottom: 6 },
  obTitle: { fontSize: 34, fontWeight: 900, margin: 0, letterSpacing: "-1px" },
  obSub: { color: "rgba(255,220,150,0.7)", fontSize: 15, margin: "6px 0 0" },
  obRow: { display: "flex", gap: 10 },
  obFieldWrap: { flex: 1, position: "relative" },
  obInput: { background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,200,100,0.25)", borderRadius: 16, padding: "14px 16px", fontSize: 16, color: "#fff", outline: "none", width: "100%", boxSizing: "border-box" },
  obUnit: { position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,200,100,0.5)", fontSize: 13, pointerEvents: "none" },
  obBtn: { background: "linear-gradient(135deg, #ff9a3c, #ff6b6b)", color: "#fff", border: "none", borderRadius: 18, padding: "16px 24px", fontSize: 16, fontWeight: 800, cursor: "pointer", marginTop: 4, boxShadow: "0 4px 20px rgba(255,100,60,0.4)" },
  modeScreen: { width: "100%", maxWidth: 420, padding: "70px 24px 40px", display: "flex", flexDirection: "column", gap: 14 },
  modeHero: { marginBottom: 12, textAlign: "center" },
  modeTagline: { fontSize: 36, fontWeight: 900, margin: 0, letterSpacing: "-1px", background: "linear-gradient(135deg, #ffe066, #ff9a3c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  modeWelcome: { color: "rgba(255,220,150,0.65)", fontSize: 15, margin: "6px 0 0" },
  modeCard: { display: "flex", alignItems: "center", gap: 16, background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1.5px solid", borderRadius: 22, padding: "20px", cursor: "pointer", textAlign: "left", color: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.25)" },
  modeIcon: { fontSize: 38 },
  modeTitle: { fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: "-0.3px" },
  modeSub: { fontSize: 13, color: "rgba(255,220,150,0.6)", margin: "3px 0 0" },
  modeArrow: { fontSize: 22, fontWeight: 900, marginLeft: "auto" },
  editProfileBtn: { background: "none", border: "none", color: "rgba(255,200,100,0.35)", fontSize: 13, cursor: "pointer", padding: "6px 0", alignSelf: "center" },
  screen: { width: "100%", maxWidth: 420, padding: "60px 24px 40px", display: "flex", flexDirection: "column", gap: 14 },
  modeSwitch: { background: "none", border: "none", color: "rgba(255,200,100,0.4)", fontSize: 14, cursor: "pointer", padding: 0, alignSelf: "flex-start" },
  hero: { textAlign: "center", marginBottom: 8 },
  heroIcon: { fontSize: 56, marginBottom: 4 },
  title: { fontSize: 38, fontWeight: 900, margin: 0, letterSpacing: "-1px", background: "linear-gradient(135deg, #ffe066, #ff9a3c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  sub: { color: "rgba(255,220,150,0.55)", margin: "6px 0 0", fontSize: 15 },
  btnGroup: { display: "flex", flexDirection: "column", gap: 10, marginTop: 4 },
  btnPrimary: { border: "none", borderRadius: 18, padding: "16px 24px", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(255,100,60,0.35)" },
  btnSecondary: { background: "rgba(255,255,255,0.09)", color: "#fff", border: "1px solid rgba(255,200,100,0.2)", borderRadius: 18, padding: "16px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer" },
  recentBlock: { marginTop: 16 },
  recentLabel: { color: "rgba(255,200,100,0.4)", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 8px" },
  recentItem: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,200,100,0.15)", borderRadius: 14, padding: "12px 16px", marginBottom: 8, cursor: "pointer", width: "100%", color: "#fff" },
  recentName: { fontSize: 14, fontWeight: 700 },
  recentCode: { fontSize: 12, fontFamily: "monospace", letterSpacing: 2 },
  back: { background: "none", border: "none", color: "rgba(255,200,100,0.45)", fontSize: 14, cursor: "pointer", padding: 0, alignSelf: "flex-start" },
  formTitle: { fontSize: 26, fontWeight: 900, margin: "4px 0 0", letterSpacing: "-0.5px" },
  formSub: { color: "rgba(255,220,150,0.5)", fontSize: 13, margin: 0 },
  input: { background: "rgba(255,255,255,0.09)", border: "1.5px solid rgba(255,200,100,0.2)", borderRadius: 16, padding: "14px 16px", fontSize: 16, color: "#fff", outline: "none", width: "100%", boxSizing: "border-box" },
  profileHint: { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,200,100,0.08)", border: "1px solid rgba(255,200,100,0.2)", borderRadius: 12, padding: "10px 14px" },
  profileHintTxt: { fontSize: 13, color: "rgba(255,220,150,0.55)" },
  profileHintName: { fontSize: 14, fontWeight: 700, color: "#ffe066" },
  error: { color: "#ff6b6b", fontSize: 13, margin: 0 },
  sessionRoot: { width: "100%", maxWidth: 420, padding: "20px 20px 60px", display: "flex", flexDirection: "column", gap: 14 },
  sessionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 4px" },
  sessionName: { fontSize: 18, fontWeight: 800, margin: 0 },
  sessionMeta: { display: "flex", gap: 10, alignItems: "center", marginTop: 4 },
  sessionTimer: { fontSize: 12, color: "rgba(255,220,150,0.5)" },
  leaveBtn: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,200,100,0.2)", borderRadius: 12, color: "rgba(255,220,150,0.6)", fontSize: 13, padding: "8px 14px", cursor: "pointer" },
  expiredBanner: { background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 14, padding: "12px 16px", textAlign: "center", fontSize: 14, color: "#f87171", fontWeight: 700 },
  myCard: { background: "rgba(255,255,255,0.07)", backdropFilter: "blur(16px)", border: "2px solid", borderRadius: 24, padding: "18px 18px 14px", display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" },
  myName: { fontSize: 20, fontWeight: 900, letterSpacing: "-0.5px" },
  myLevel: { fontSize: 13, fontWeight: 800, letterSpacing: "0.5px" },
  myItems: { display: "flex", flexWrap: "wrap", gap: 4, minHeight: 30, alignItems: "center" },
  itemChip: { fontSize: 22 },
  myScore: { display: "flex", alignItems: "baseline" },
  cardActions: { display: "flex", gap: 10, marginTop: 2 },
  addBtn: { flex: 1, border: "none", borderRadius: 14, padding: "13px", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(255,100,60,0.3)" },
  undoBtn: { background: "rgba(255,255,255,0.09)", color: "#fff", border: "none", borderRadius: 14, padding: "13px 16px", fontSize: 15, cursor: "pointer" },
  leaderboard: { background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,200,100,0.15)", borderRadius: 22, padding: "16px" },
  lbTitle: { fontSize: 12, fontWeight: 700, color: "rgba(255,200,100,0.45)", margin: "0 0 10px", letterSpacing: "0.3px" },
  lbRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 12 },
  lbRank: { fontSize: 13, width: 24 },
  lbName: { flex: 1, fontSize: 14, fontWeight: 700 },
  lbLevel: { fontSize: 11, fontWeight: 800 },
  lbCount: { fontSize: 13, fontWeight: 800 },
  endSessionBtn: { background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 14, color: "#f87171", fontSize: 14, fontWeight: 700, padding: "13px", cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(10,5,30,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" },
  modal: { background: "linear-gradient(160deg, #1a0a2e, #0d1f3c)", borderRadius: "26px 26px 0 0", padding: "22px 18px 48px", width: "100%", maxWidth: 420, border: "1px solid rgba(255,200,100,0.15)", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" },
  modalTitle: { fontSize: 16, fontWeight: 800, margin: "0 0 18px", textAlign: "center", color: "#ffe066" },
  itemGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 },
  itemOption: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,200,100,0.2)", borderRadius: 18, padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", color: "#fff" },
  itemEmoji: { fontSize: 32 },
  itemName: { fontSize: 13, fontWeight: 700 },
  itemPts: { fontSize: 12, fontWeight: 800 },
  detailScroll: { maxHeight: 280, overflowY: "auto", marginBottom: 16 },
  detailRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderBottom: "1px solid rgba(255,200,100,0.08)" },
  detailEmoji: { fontSize: 22, width: 30 },
  detailItemName: { flex: 1, fontSize: 14, fontWeight: 600 },
  detailPts: { fontSize: 13, fontWeight: 800 },
  detailTime: { fontSize: 12, color: "rgba(255,200,100,0.4)" },
  cancelBtn: { width: "100%", background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 16, color: "rgba(255,220,150,0.7)", fontSize: 16, padding: "14px", cursor: "pointer", fontWeight: 600 },
  toast: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg, rgba(255,154,60,0.9), rgba(255,107,107,0.9))", backdropFilter: "blur(12px)", borderRadius: 50, padding: "10px 22px", fontSize: 14, fontWeight: 700, zIndex: 200, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(255,100,60,0.4)", color: "#fff" },
};
