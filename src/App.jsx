import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://mdepihsyfholopnvqawe.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZXBpaHN5ZmhvbG9wbnZxYXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NzE4NTgsImV4cCI6MjA5NjQ0Nzg1OH0.pBtGBs1oMeRzK684gX2GRYUTUbDt8xMNITIgzImFww8";

const sb = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  if (res.status === 204) return null;
  return res.json();
};

const api = {
  // Sessions
  getSession: (id, mode) => sb(`sessions?id=eq.${id}&mode=eq.${mode}&select=*`),
  createSession: (data) => sb("sessions", { method: "POST", body: JSON.stringify(data) }),
  endSession: (id) => sb(`sessions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ ended: true, ends_at: Date.now() }) }),
  // Members
  getMembers: (sessionId) => sb(`members?session_id=eq.${sessionId}&select=*`),
  upsertMember: (data) => sb("members", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", headers: { "Prefer": "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(data) }),
  updateMemberScore: (sessionId, name, score) => sb(`members?session_id=eq.${sessionId}&name=eq.${encodeURIComponent(name)}`, { method: "PATCH", body: JSON.stringify({ score }) }),
  // Items
  getItems: (sessionId) => sb(`items?session_id=eq.${sessionId}&select=*&order=logged_at.asc`),
  addItem: (data) => sb("items", { method: "POST", body: JSON.stringify(data) }),
  deleteLastItem: (id) => sb(`items?id=eq.${id}`, { method: "DELETE", prefer: "", headers: { "Prefer": "" } }),
  // Rounds
  getRounds: () => sb("rounds?select=*&order=position.asc"),
  upsertRound: (data) => sb("rounds", { method: "POST", headers: { "Prefer": "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(data) }),
  deleteRound: (id) => sb(`rounds?id=eq.${id}`, { method: "DELETE", prefer: "", headers: { "Prefer": "" } }),
  updateRoundPosition: (id, position) => sb(`rounds?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ position }) }),
};

// ─── CONFIG ──────────────────────────────────────────────────────
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
const SESSION_DURATION = 12 * 60 * 60 * 1000;

function getLevel(score, levels) {
  let cur = levels[0];
  for (const l of levels) { if (score >= l.min) cur = l; }
  return cur;
}
function genCode() { return Math.random().toString(36).substring(2, 7).toUpperCase(); }
function genId() { return Math.random().toString(36).substring(2, 10); }
function formatTimeLeft(ms) {
  if (ms <= 0) return "Terminée";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h${m.toString().padStart(2, "0")}`;
}
function getYoutubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return m ? m[1] : null;
}
const PROFILE_KEY = "nightlog_profile_v1";
function loadProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; } catch { return null; } }
function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

export default function App() {
  const [profile, setProfile] = useState(() => loadProfile());
  const [ob, setOb] = useState({ prenom: "", nom: "", age: "", poids: "", taille: "" });
  const [obError, setObError] = useState("");
  const [appMode, setAppMode] = useState(null);
  const [screen, setScreen] = useState("home");

  // drink/flirt
  const [sessionData, setSessionData] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [itemsData, setItemsData] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [sessionNameInput, setSessionNameInput] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showMemberDetail, setShowMemberDetail] = useState(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // game
  const [rounds, setRounds] = useState([]);
  const [gameSession, setGameSession] = useState(null);
  const [gameScreen, setGameScreen] = useState("home");
  const [editingRound, setEditingRound] = useState(null);
  const [roundForm, setRoundForm] = useState({ type: "phrase", prompt: "", media: "" });
  const [myAnswer, setMyAnswer] = useState("");
  const [gameName, setGameName] = useState("");
  const [gamePlayers, setGamePlayers] = useState([""]);

  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());

  const ITEMS  = appMode === "drink" ? DRINKS : FLIRT_ACTIONS;
  const LEVELS = appMode === "drink" ? DRINK_LEVELS : FLIRT_LEVELS;
  const ACCENT = appMode === "drink" ? "#facc15" : "#f472b6";

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (profile) setNameInput(profile.prenom); }, [profile]);

  // Poll session data every 5s when in session
  const pollSession = useCallback(async () => {
    if (!currentSession || !appMode || appMode === "game") return;
    try {
      const [s, m, i] = await Promise.all([
        api.getSession(currentSession, appMode),
        api.getMembers(currentSession),
        api.getItems(currentSession),
      ]);
      if (s && s[0]) setSessionData(s[0]);
      if (m) setMembersData(m);
      if (i) setItemsData(i);
    } catch (e) { console.error(e); }
  }, [currentSession, appMode]);

  useEffect(() => {
    if (!currentSession) return;
    pollSession();
    const t = setInterval(pollSession, 5000);
    return () => clearInterval(t);
  }, [pollSession, currentSession]);

  // Load rounds from Supabase
  useEffect(() => {
    if (appMode === "game") {
      api.getRounds().then(r => { if (r) setRounds(r); }).catch(() => {});
    }
  }, [appMode]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2200); }
  function reset() {
    setScreen("home"); setCurrentSession(null); setCurrentUser(null);
    setSessionData(null); setMembersData([]); setItemsData([]);
    setNameInput(profile ? profile.prenom : ""); setSessionNameInput(""); setJoinCode(""); setError("");
    setShowMenu(false); setShowMemberDetail(null);
  }

  function submitOnboarding() {
    const { prenom, nom, age, poids, taille } = ob;
    if (!prenom.trim() || !nom.trim() || !age || !poids || !taille) { setObError("Remplis tout stp 🙏"); return; }
    const p = { prenom: prenom.trim(), nom: nom.trim(), age: parseInt(age), poids: parseInt(poids), taille: parseInt(taille) };
    saveProfile(p); setProfile(p); setObError("");
  }

  async function createSession() {
    if (!sessionNameInput.trim() || !nameInput.trim()) { setError("Remplis tout stp"); return; }
    setLoading(true);
    try {
      const code = genCode();
      const session = { id: code, mode: appMode, name: sessionNameInput.trim(), creator: nameInput.trim(), created_at: Date.now(), ends_at: Date.now() + SESSION_DURATION, ended: false };
      await api.createSession(session);
      await api.upsertMember({ session_id: code, name: nameInput.trim(), score: 0 });
      const [s, m, i] = await Promise.all([api.getSession(code, appMode), api.getMembers(code), api.getItems(code)]);
      setSessionData(s[0]); setMembersData(m); setItemsData(i);
      setCurrentSession(code); setCurrentUser(nameInput.trim()); setScreen("session"); setError("");
    } catch (e) { setError("Erreur de connexion 😕"); }
    setLoading(false);
  }

  async function joinSession() {
    const code = joinCode.toUpperCase().trim();
    if (!code || !nameInput.trim()) { setError("Remplis tout stp"); return; }
    setLoading(true);
    try {
      const s = await api.getSession(code, appMode);
      if (!s || !s[0]) { setError("Session introuvable"); setLoading(false); return; }
      if (s[0].ended || Date.now() > s[0].ends_at) { setError("Session terminée"); setLoading(false); return; }
      await api.upsertMember({ session_id: code, name: nameInput.trim(), score: 0 });
      const [m, i] = await Promise.all([api.getMembers(code), api.getItems(code)]);
      setSessionData(s[0]); setMembersData(m); setItemsData(i);
      setCurrentSession(code); setCurrentUser(nameInput.trim()); setScreen("session"); setError("");
    } catch (e) { setError("Erreur de connexion 😕"); }
    setLoading(false);
  }

  async function addItem(item) {
    setShowMenu(false);
    const me = membersData.find(m => m.name === currentUser);
    if (!me) return;
    const newScore = parseFloat((me.score + item.points).toFixed(1));
    try {
      await api.addItem({ session_id: currentSession, member_name: currentUser, item_id: item.id, emoji: item.emoji, item_name: item.name, points: item.points, logged_at: Date.now() });
      await api.updateMemberScore(currentSession, currentUser, newScore);
      await pollSession();
      showToast(`${item.emoji} +${item.points} pt${item.points > 1 ? "s" : ""}`);
    } catch (e) { showToast("Erreur 😕"); }
  }

  async function removeLast() {
    const myItems = itemsData.filter(i => i.member_name === currentUser);
    if (!myItems.length) return;
    const last = myItems[myItems.length - 1];
    const me = membersData.find(m => m.name === currentUser);
    const newScore = parseFloat(Math.max(0, me.score - last.points).toFixed(1));
    try {
      await api.deleteLastItem(last.id);
      await api.updateMemberScore(currentSession, currentUser, newScore);
      await pollSession();
      showToast("Annulé ✓");
    } catch (e) { showToast("Erreur 😕"); }
  }

  async function endSessionNow() {
    try {
      await api.endSession(currentSession);
      setSessionData({ ...sessionData, ended: true });
      setShowEndConfirm(false); showToast("Session terminée 🏁");
    } catch (e) { showToast("Erreur 😕"); }
  }

  // Game functions
  async function saveRound() {
    if (!roundForm.prompt.trim()) return;
    const id = editingRound || genId();
    const position = editingRound ? (rounds.find(r => r.id === editingRound)?.position || 0) : rounds.length;
    try {
      await api.upsertRound({ id, ...roundForm, position });
      const r = await api.getRounds();
      setRounds(r);
      setEditingRound(null); setRoundForm({ type: "phrase", prompt: "", media: "" });
      showToast("Round sauvegardé ✓");
    } catch (e) { showToast("Erreur 😕"); }
  }

  async function deleteRound(id) {
    try {
      await api.deleteRound(id);
      setRounds(rounds.filter(r => r.id !== id));
    } catch (e) { showToast("Erreur 😕"); }
  }

  async function moveRound(id, dir) {
    const idx = rounds.findIndex(r => r.id === id);
    const target = idx + dir;
    if (target < 0 || target >= rounds.length) return;
    const newR = [...rounds];
    [newR[idx], newR[target]] = [newR[target], newR[idx]];
    try {
      await Promise.all([
        api.updateRoundPosition(newR[idx].id, idx),
        api.updateRoundPosition(newR[target].id, target),
      ]);
      setRounds(newR.map((r, i) => ({ ...r, position: i })));
    } catch (e) {}
  }

  function startGame() {
    if (!gameName.trim()) return;
    const players = gamePlayers.map(p => p.trim()).filter(Boolean);
    if (players.length < 2) { showToast("Faut au moins 2 joueurs"); return; }
    if (rounds.length === 0) { showToast("Ajoute des rounds d'abord"); return; }
    setGameSession({ name: gameName.trim(), players, roundIndex: 0, phase: "answer", answers: {}, votes: {}, scores: Object.fromEntries(players.map(p => [p, 0])), currentPlayer: players[0] });
    setMyAnswer(""); setGameScreen("playing");
  }

  function submitAnswer(player) {
    if (!myAnswer.trim()) return;
    const gs = { ...gameSession, answers: { ...gameSession.answers, [player]: myAnswer.trim() } };
    setMyAnswer("");
    const allAnswered = gs.players.every(p => gs.answers[p]);
    if (allAnswered) gs.phase = "voting";
    else { const nextIdx = gs.players.indexOf(player) + 1; if (nextIdx < gs.players.length) gs.currentPlayer = gs.players[nextIdx]; }
    setGameSession(gs); showToast("Réponse envoyée ✓");
  }

  function submitVote(voter, chosen) {
    const gs = { ...gameSession, votes: { ...gameSession.votes, [voter]: chosen } };
    setGameSession(gs); showToast("Vote enregistré ✓");
  }

  function goToVoting() { setGameSession({ ...gameSession, phase: "voting" }); }

  function finishVoting() {
    const gs = { ...gameSession };
    const tally = Object.fromEntries(gs.players.map(p => [p, 0]));
    Object.values(gs.votes).forEach(v => { if (tally[v] !== undefined) tally[v]++; });
    gs.players.forEach(p => { gs.scores[p] = (gs.scores[p] || 0) + (tally[p] || 0); });
    gs.lastTally = tally; gs.phase = "roundResult";
    setGameSession(gs);
  }

  function nextRound() {
    const gs = { ...gameSession };
    const next = gs.roundIndex + 1;
    if (next >= rounds.length) { gs.phase = "end"; }
    else { gs.roundIndex = next; gs.phase = "answer"; gs.answers = {}; gs.votes = {}; gs.currentPlayer = gs.players[0]; }
    setMyAnswer(""); setGameSession(gs);
  }

  // Derived state
  const isCreator = sessionData && currentUser === sessionData.creator;
  const sessionExpired = sessionData && (sessionData.ended || Date.now() > sessionData.ends_at);
  const timeLeft = sessionData ? Math.max(0, sessionData.ends_at - now) : 0;
  const sortedMembers = [...membersData].sort((a, b) => b.score - a.score);
  const me = membersData.find(m => m.name === currentUser);
  const myItems = itemsData.filter(i => i.member_name === currentUser);
  const currentRound = gameSession ? rounds[gameSession.roundIndex] : null;

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (!profile) return (
    <div style={S.root}>
      <div style={S.obScreen}>
        <div style={S.obHero}><div style={S.obEmoji}>👋</div><h1 style={S.obTitle}>Bienvenue</h1><p style={S.obSub}>Crée ton profil pour commencer</p></div>
        <div style={S.obRow}>
          <input style={S.obInput} placeholder="Prénom" value={ob.prenom} onChange={e => setOb({ ...ob, prenom: e.target.value })} />
          <input style={S.obInput} placeholder="Nom" value={ob.nom} onChange={e => setOb({ ...ob, nom: e.target.value })} />
        </div>
        <input style={S.input} placeholder="Âge" type="number" inputMode="numeric" value={ob.age} onChange={e => setOb({ ...ob, age: e.target.value })} />
        <div style={S.obRow}>
          <div style={S.obFieldWrap}><input style={S.obInput} placeholder="Poids" type="number" inputMode="numeric" value={ob.poids} onChange={e => setOb({ ...ob, poids: e.target.value })} /><span style={S.obUnit}>kg</span></div>
          <div style={S.obFieldWrap}><input style={S.obInput} placeholder="Taille" type="number" inputMode="numeric" value={ob.taille} onChange={e => setOb({ ...ob, taille: e.target.value })} /><span style={S.obUnit}>cm</span></div>
        </div>
        {obError && <p style={S.error}>{obError}</p>}
        <button style={S.obBtn} onClick={submitOnboarding}>C'est parti 🚀</button>
      </div>
    </div>
  );

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
          <span style={S.modeIcon}>🍺</span><div><p style={S.modeTitle}>NightLog</p><p style={S.modeSub}>Tracker de conso entre potes</p></div>
          <span style={{ ...S.modeArrow, color: "#facc15" }}>→</span>
        </button>
        <button style={{ ...S.modeCard, borderColor: "#f472b6" }} onClick={() => { setAppMode("flirt"); setScreen("home"); }}>
          <span style={S.modeIcon}>💋</span><div><p style={S.modeTitle}>FlirtLog</p><p style={S.modeSub}>Kiss, dates, numéros — qui kiffe le plus</p></div>
          <span style={{ ...S.modeArrow, color: "#f472b6" }}>→</span>
        </button>
        <button style={{ ...S.modeCard, borderColor: "#818cf8" }} onClick={() => { setAppMode("game"); setGameScreen("home"); }}>
          <span style={S.modeIcon}>🎮</span><div><p style={S.modeTitle}>GameLog</p><p style={S.modeSub}>Complète la phrase, finis les paroles</p></div>
          <span style={{ ...S.modeArrow, color: "#818cf8" }}>→</span>
        </button>
      </div>
    </div>
  );

  // ── GAME ────────────────────────────────────────────────────
  if (appMode === "game") {
    if (gameScreen === "home") return (
      <div style={S.root}>
        {toast && <div style={S.toast}>{toast}</div>}
        <div style={S.screen}>
          <button style={S.modeSwitch} onClick={() => setAppMode(null)}>← Changer de mode</button>
          <div style={S.hero}><div style={S.heroIcon}>🎮</div><h1 style={{ ...S.title, WebkitTextFillColor: "#818cf8" }}>GameLog</h1><p style={S.sub}>Complète la phrase, finis les paroles</p></div>
          <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff" }} onClick={() => { setGameScreen("lobby"); setGameName(""); setGamePlayers([profile.prenom, ""]); }}>🕹️ Lancer une partie</button>
          <button style={S.btnSecondary} onClick={() => { setGameScreen("editor"); setEditingRound(null); setRoundForm({ type: "phrase", prompt: "", media: "" }); }}>✏️ Éditeur de rounds ({rounds.length})</button>
        </div>
      </div>
    );

    if (gameScreen === "editor") return (
      <div style={S.root}>
        {toast && <div style={S.toast}>{toast}</div>}
        <div style={S.screen}>
          <button style={S.back} onClick={() => { setGameScreen("home"); setEditingRound(null); }}>← Retour</button>
          <h2 style={S.formTitle}>✏️ Éditeur de rounds</h2>
          <div style={S.editorCard}>
            <p style={S.editorCardTitle}>{editingRound ? "Modifier le round" : "Nouveau round"}</p>
            <div style={S.typeRow}>
              {["phrase", "paroles", "image"].map(t => (
                <button key={t} style={{ ...S.typeBtn, ...(roundForm.type === t ? S.typeBtnActive : {}) }} onClick={() => setRoundForm({ ...roundForm, type: t })}>
                  {t === "phrase" ? "💬 Phrase" : t === "paroles" ? "🎵 Paroles" : "🖼️ Image"}
                </button>
              ))}
            </div>
            <textarea style={S.textarea} placeholder={roundForm.type === "phrase" ? "Ex: La dernière fois que j'ai pleuré c'était..." : "Consigne ou texte"} value={roundForm.prompt} onChange={e => setRoundForm({ ...roundForm, prompt: e.target.value })} rows={3} />
            {(roundForm.type === "paroles" || roundForm.type === "image") && (
              <input style={S.input} placeholder={roundForm.type === "paroles" ? "Lien YouTube" : "URL de l'image"} value={roundForm.media} onChange={e => setRoundForm({ ...roundForm, media: e.target.value })} />
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btnPrimary, flex: 1, background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff", padding: "12px" }} onClick={saveRound}>{editingRound ? "Modifier ✓" : "Ajouter +"}</button>
              {editingRound && <button style={{ ...S.undoBtn, padding: "12px 16px" }} onClick={() => { setEditingRound(null); setRoundForm({ type: "phrase", prompt: "", media: "" }); }}>Annuler</button>}
            </div>
          </div>
          {rounds.length === 0 && <p style={{ color: "rgba(255,200,100,0.35)", textAlign: "center", fontSize: 14 }}>Aucun round — ajoute en un ☝️</p>}
          {rounds.map((r, i) => (
            <div key={r.id} style={S.roundItem}>
              <div style={S.roundItemLeft}><span style={S.roundItemType}>{r.type === "phrase" ? "💬" : r.type === "paroles" ? "🎵" : "🖼️"}</span><span style={S.roundItemPrompt}>{r.prompt}</span></div>
              <div style={S.roundItemActions}>
                <button style={S.iconBtn} onClick={() => moveRound(r.id, -1)}>↑</button>
                <button style={S.iconBtn} onClick={() => moveRound(r.id, 1)}>↓</button>
                <button style={S.iconBtn} onClick={() => { setEditingRound(r.id); setRoundForm({ type: r.type, prompt: r.prompt, media: r.media || "" }); }}>✏️</button>
                <button style={{ ...S.iconBtn, color: "#f87171" }} onClick={() => deleteRound(r.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    if (gameScreen === "lobby") return (
      <div style={S.root}>
        {toast && <div style={S.toast}>{toast}</div>}
        <div style={S.screen}>
          <button style={S.back} onClick={() => setGameScreen("home")}>← Retour</button>
          <h2 style={S.formTitle}>🕹️ Nouvelle partie</h2>
          <input style={S.input} placeholder="Nom de la partie" value={gameName} onChange={e => setGameName(e.target.value)} />
          <p style={S.recentLabel}>Joueurs (max 6)</p>
          {gamePlayers.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <input style={{ ...S.input, flex: 1 }} placeholder={`Joueur ${i + 1}`} value={p} onChange={e => { const arr = [...gamePlayers]; arr[i] = e.target.value; setGamePlayers(arr); }} />
              {gamePlayers.length > 1 && <button style={{ ...S.iconBtn, fontSize: 18, padding: "0 12px" }} onClick={() => setGamePlayers(gamePlayers.filter((_, j) => j !== i))}>×</button>}
            </div>
          ))}
          {gamePlayers.length < 6 && <button style={S.btnSecondary} onClick={() => setGamePlayers([...gamePlayers, ""])}>+ Ajouter un joueur</button>}
          <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff" }} onClick={startGame}>C'est parti 🚀 ({rounds.length} rounds)</button>
        </div>
      </div>
    );

    if (gameScreen === "playing" && gameSession && currentRound) {
      const allAnswered = gameSession.players.every(p => gameSession.answers[p]);
      const ytId = currentRound.media ? getYoutubeId(currentRound.media) : null;

      if (gameSession.phase === "answer") return (
        <div style={S.root}>
          {toast && <div style={S.toast}>{toast}</div>}
          <div style={S.sessionRoot}>
            <div style={S.sessionHeader}>
              <div><p style={S.sessionName}>{gameSession.name}</p><p style={{ ...S.sessionCode, color: "#818cf8" }}>Round {gameSession.roundIndex + 1}/{rounds.length}</p></div>
              <button style={S.leaveBtn} onClick={() => { setGameSession(null); setGameScreen("home"); }}>Quitter</button>
            </div>
            <div style={S.gameRoundCard}>
              <span style={S.gameRoundType}>{currentRound.type === "phrase" ? "💬 Complète la phrase" : currentRound.type === "paroles" ? "🎵 Finis les paroles" : "🖼️ Légende cette image"}</span>
              <p style={S.gamePrompt}>{currentRound.prompt}</p>
              {ytId && <div style={S.ytWrap}><iframe style={S.ytFrame} src={`https://www.youtube.com/embed/${ytId}`} allowFullScreen /></div>}
              {currentRound.type === "image" && currentRound.media && !ytId && <img src={currentRound.media} style={S.gameImg} alt="" />}
            </div>
            <div style={S.gameAnswerSection}>
              <p style={S.recentLabel}>À toi — {gameSession.currentPlayer}</p>
              {gameSession.answers[gameSession.currentPlayer]
                ? <div style={S.answeredBadge}>✓ Réponse envoyée</div>
                : <><textarea style={S.textarea} placeholder="Ta réponse..." value={myAnswer} onChange={e => setMyAnswer(e.target.value)} rows={3} />
                  <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff" }} onClick={() => submitAnswer(gameSession.currentPlayer)}>Envoyer</button></>
              }
              <div style={S.playerStatusList}>
                {gameSession.players.map(p => (
                  <span key={p} style={{ ...S.playerStatusBadge, background: gameSession.answers[p] ? "rgba(129,140,248,0.2)" : "rgba(255,255,255,0.05)", color: gameSession.answers[p] ? "#818cf8" : "#555", border: `1px solid ${gameSession.answers[p] ? "rgba(129,140,248,0.4)" : "rgba(255,255,255,0.08)"}` }}>
                    {gameSession.answers[p] ? "✓" : "…"} {p}
                  </span>
                ))}
              </div>
            </div>
            {allAnswered && <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff" }} onClick={goToVoting}>Voter maintenant 🗳️</button>}
          </div>
        </div>
      );

      if (gameSession.phase === "voting") {
        const currentVoter = gameSession.players.find(p => !gameSession.votes[p]);
        const allVoted = !currentVoter;
        return (
          <div style={S.root}>
            {toast && <div style={S.toast}>{toast}</div>}
            <div style={S.sessionRoot}>
              <div style={S.sessionHeader}><p style={S.sessionName}>🗳️ Phase de vote</p><button style={S.leaveBtn} onClick={() => { setGameSession(null); setGameScreen("home"); }}>Quitter</button></div>
              <div style={{ ...S.gameRoundCard, marginBottom: 4 }}><p style={S.gamePrompt}>{currentRound.prompt}</p></div>
              {!allVoted && currentVoter && (
                <div style={S.gameAnswerSection}>
                  <p style={S.recentLabel}>Qui vote : {currentVoter}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {gameSession.players.filter(p => p !== currentVoter).map(p => (
                      <button key={p} style={S.voteOption} onClick={() => submitVote(currentVoter, p)}>
                        <span style={S.votePlayerName}>{p}</span>
                        <span style={S.voteAnswerPreview}>"{gameSession.answers[p]}"</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={S.playerStatusList}>
                {gameSession.players.map(p => (
                  <span key={p} style={{ ...S.playerStatusBadge, background: gameSession.votes[p] ? "rgba(129,140,248,0.2)" : "rgba(255,255,255,0.05)", color: gameSession.votes[p] ? "#818cf8" : "#555", border: `1px solid ${gameSession.votes[p] ? "rgba(129,140,248,0.4)" : "rgba(255,255,255,0.08)"}` }}>
                    {gameSession.votes[p] ? "✓" : "…"} {p}
                  </span>
                ))}
              </div>
              {allVoted && <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff" }} onClick={finishVoting}>Voir les résultats 🏆</button>}
            </div>
          </div>
        );
      }

      if (gameSession.phase === "roundResult") {
        const tally = gameSession.lastTally || {};
        const sorted = [...gameSession.players].sort((a, b) => (tally[b] || 0) - (tally[a] || 0));
        return (
          <div style={S.root}>
            {toast && <div style={S.toast}>{toast}</div>}
            <div style={S.sessionRoot}>
              <div style={S.sessionHeader}><p style={S.sessionName}>🏅 Round {gameSession.roundIndex + 1}</p></div>
              <div style={S.gameRoundCard}><p style={S.gamePrompt}>{currentRound.prompt}</p></div>
              {sorted.map((p, i) => (
                <div key={p} style={{ ...S.lbRow, background: i === 0 ? "rgba(129,140,248,0.1)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(129,140,248,0.15)", borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                  <div style={{ flex: 1, marginLeft: 10 }}>
                    <p style={{ fontWeight: 800, margin: 0, fontSize: 15 }}>{p}</p>
                    <p style={{ color: "rgba(255,220,150,0.5)", fontSize: 13, margin: "2px 0 0" }}>"{gameSession.answers[p]}"</p>
                  </div>
                  <span style={{ color: "#818cf8", fontWeight: 800 }}>{tally[p] || 0} vote{(tally[p] || 0) > 1 ? "s" : ""}</span>
                </div>
              ))}
              <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff" }} onClick={nextRound}>
                {gameSession.roundIndex + 1 >= rounds.length ? "Classement final 🏆" : "Round suivant →"}
              </button>
            </div>
          </div>
        );
      }

      if (gameSession.phase === "end") {
        const sorted = [...gameSession.players].sort((a, b) => (gameSession.scores[b] || 0) - (gameSession.scores[a] || 0));
        return (
          <div style={S.root}>
            {toast && <div style={S.toast}>{toast}</div>}
            <div style={S.sessionRoot}>
              <div style={{ textAlign: "center", padding: "20px 0 10px" }}><div style={{ fontSize: 52 }}>🏆</div><h2 style={{ fontSize: 26, fontWeight: 900, margin: "8px 0 4px" }}>Classement final</h2><p style={{ color: "rgba(255,220,150,0.5)", fontSize: 14 }}>{gameSession.name}</p></div>
              {sorted.map((p, i) => (
                <div key={p} style={{ ...S.lbRow, background: i === 0 ? "rgba(129,140,248,0.12)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(129,140,248,0.15)", borderRadius: 14, padding: "14px 16px", marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                  <span style={{ flex: 1, fontWeight: 800, fontSize: 16, marginLeft: 10 }}>{p}</span>
                  <span style={{ color: "#818cf8", fontWeight: 800, fontSize: 18 }}>{gameSession.scores[p] || 0} pts</span>
                </div>
              ))}
              <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff" }} onClick={() => { setGameSession(null); setGameScreen("home"); }}>Retour à l'accueil</button>
            </div>
          </div>
        );
      }
    }
  }

  // ── DRINK / FLIRT ────────────────────────────────────────────
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
          <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #ff9a3c, #ff6b6b)", color: "#fff" }} onClick={() => { setScreen("create"); setError(""); setSessionNameInput(""); }}>+ Créer une session</button>
          <button style={S.btnSecondary} onClick={() => { setScreen("join"); setError(""); setJoinCode(""); }}>Rejoindre</button>
        </div>
      </div>
    </div>
  );

  if (screen === "create") return (
    <div style={S.root}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.screen}>
        <button style={S.back} onClick={() => setScreen("home")}>← Retour</button>
        <h2 style={S.formTitle}>Nouvelle session</h2>
        <p style={S.formSub}>Durée automatique : 12h ⏱️</p>
        <input style={S.input} placeholder="Nom de la soirée" value={sessionNameInput} onChange={e => setSessionNameInput(e.target.value)} />
        <div style={S.profileHint}><span style={S.profileHintTxt}>Tu rejoins en tant que</span><span style={S.profileHintName}>{profile.prenom}</span></div>
        {error && <p style={S.error}>{error}</p>}
        <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #ff9a3c, #ff6b6b)", color: "#fff", opacity: loading ? 0.6 : 1 }} onClick={createSession} disabled={loading}>
          {loading ? "Création..." : "Créer 🚀"}
        </button>
      </div>
    </div>
  );

  if (screen === "join") return (
    <div style={S.root}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.screen}>
        <button style={S.back} onClick={() => setScreen("home")}>← Retour</button>
        <h2 style={S.formTitle}>Rejoindre</h2>
        <input style={{ ...S.input, textTransform: "uppercase", letterSpacing: 4, fontWeight: 700 }} placeholder="CODE" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={5} />
        <div style={S.profileHint}><span style={S.profileHintTxt}>Tu rejoins en tant que</span><span style={S.profileHintName}>{profile.prenom}</span></div>
        {error && <p style={S.error}>{error}</p>}
        <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg, #ff9a3c, #ff6b6b)", color: "#fff", opacity: loading ? 0.6 : 1 }} onClick={joinSession} disabled={loading}>
          {loading ? "Connexion..." : "Rejoindre"}
        </button>
      </div>
    </div>
  );

  if (screen === "session" && sessionData && me) return (
    <div style={S.root}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.sessionRoot}>
        <div style={S.sessionHeader}>
          <div>
            <p style={S.sessionName}>{sessionData.name}</p>
            <div style={S.sessionMeta}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{currentSession}</span>
              <span style={S.sessionTimer}>{sessionExpired ? "⏹ Terminée" : `⏱ ${formatTimeLeft(timeLeft)}`}</span>
            </div>
          </div>
          <button style={S.leaveBtn} onClick={reset}>Quitter</button>
        </div>

        {sessionExpired && <div style={S.expiredBanner}>🏁 La soirée est terminée — scores figés</div>}

        {!sessionExpired && (
          <div style={{ ...S.myCard, borderColor: getLevel(me.score, LEVELS).color }}>
            <div style={S.myName}>{currentUser}</div>
            <div style={{ ...S.myLevel, color: getLevel(me.score, LEVELS).color }}>{getLevel(me.score, LEVELS).label}</div>
            <div style={S.myItems}>
              {myItems.length === 0 ? <span style={{ opacity: 0.3, fontSize: 13 }}>Rien encore…</span>
                : myItems.slice(-8).map((d, i) => <span key={i} style={S.itemChip}>{d.emoji}</span>)}
            </div>
            <div style={S.myScore}>
              <span style={{ color: ACCENT, fontWeight: 800, fontSize: 22 }}>{me.score}</span>
              <span style={{ color: "rgba(255,200,100,0.4)", fontSize: 13, marginLeft: 4 }}>pts · {myItems.length} action{myItems.length > 1 ? "s" : ""}</span>
            </div>
            <div style={S.cardActions}>
              <button style={{ ...S.addBtn, background: "linear-gradient(135deg, #ff9a3c, #ff6b6b)", color: "#fff" }} onClick={() => setShowMenu(true)}>+ Ajouter</button>
              {myItems.length > 0 && <button style={S.undoBtn} onClick={removeLast}>↩</button>}
            </div>
          </div>
        )}

        <div style={S.leaderboard}>
          <p style={S.lbTitle}>🏆 Classement — appuie pour voir le détail</p>
          {sortedMembers.map((member, i) => {
            const level = getLevel(member.score, LEVELS);
            const isMe = member.name === currentUser;
            return (
              <div key={member.name} style={{ ...S.lbRow, background: isMe ? "rgba(255,200,100,0.08)" : "transparent", cursor: "pointer" }} onClick={() => setShowMemberDetail(member.name)}>
                <span style={{ ...S.lbRank, color: i === 0 ? "#fbbf24" : "rgba(255,200,100,0.4)" }}>#{i + 1}</span>
                <span style={S.lbName}>{member.name}{isMe ? " (moi)" : ""}</span>
                <span style={{ ...S.lbLevel, color: level.color }}>{level.label}</span>
                <span style={{ ...S.lbCount, color: ACCENT }}>{member.score}pts</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>›</span>
              </div>
            );
          })}
        </div>

        {isCreator && !sessionExpired && <button style={S.endSessionBtn} onClick={() => setShowEndConfirm(true)}>🏁 Terminer la session maintenant</button>}

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

        {showMemberDetail && (
          <div style={S.overlay} onClick={() => setShowMemberDetail(null)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <p style={S.modalTitle}>{showMemberDetail} 👀</p>
              <div style={S.detailScroll}>
                {itemsData.filter(i => i.member_name === showMemberDetail).length === 0
                  ? <p style={{ color: "rgba(255,200,100,0.4)", textAlign: "center", fontSize: 14 }}>Rien encore…</p>
                  : [...itemsData.filter(i => i.member_name === showMemberDetail)].reverse().map((item, i) => (
                    <div key={i} style={S.detailRow}>
                      <span style={S.detailEmoji}>{item.emoji}</span>
                      <span style={S.detailItemName}>{item.item_name}</span>
                      <span style={{ ...S.detailPts, color: ACCENT }}>+{item.points}pts</span>
                      <span style={S.detailTime}>{new Date(item.logged_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
              </div>
              <button style={S.cancelBtn} onClick={() => setShowMemberDetail(null)}>Fermer</button>
            </div>
          </div>
        )}

        {showEndConfirm && (
          <div style={S.overlay} onClick={() => setShowEndConfirm(false)}>
            <div style={{ ...S.modal, padding: "28px 20px 40px" }} onClick={e => e.stopPropagation()}>
              <p style={S.modalTitle}>Terminer la session ?</p>
              <p style={{ color: "rgba(255,220,150,0.6)", textAlign: "center", fontSize: 14, margin: "0 0 24px" }}>Les scores seront figés pour tout le monde</p>
              <button style={{ ...S.btnPrimary, background: "#f87171", color: "#fff", width: "100%", marginBottom: 10 }} onClick={endSessionNow}>Oui, terminer 🏁</button>
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
  root: { minHeight: "100vh", background: "linear-gradient(160deg, #1a0533 0%, #0d1f3c 40%, #0a2e1a 100%)", color: "#fff", fontFamily: "'Trebuchet MS', 'Gill Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0 60px", position: "relative", backgroundAttachment: "fixed" },
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
  modeTitle: { fontSize: 18, fontWeight: 800, margin: 0 },
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
  recentLabel: { color: "rgba(255,200,100,0.4)", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 8px" },
  back: { background: "none", border: "none", color: "rgba(255,200,100,0.45)", fontSize: 14, cursor: "pointer", padding: 0, alignSelf: "flex-start" },
  formTitle: { fontSize: 26, fontWeight: 900, margin: "4px 0 0", letterSpacing: "-0.5px" },
  formSub: { color: "rgba(255,220,150,0.5)", fontSize: 13, margin: 0 },
  input: { background: "rgba(255,255,255,0.09)", border: "1.5px solid rgba(255,200,100,0.2)", borderRadius: 16, padding: "14px 16px", fontSize: 16, color: "#fff", outline: "none", width: "100%", boxSizing: "border-box" },
  textarea: { background: "rgba(255,255,255,0.09)", border: "1.5px solid rgba(255,200,100,0.2)", borderRadius: 16, padding: "14px 16px", fontSize: 15, color: "#fff", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", fontFamily: "inherit" },
  profileHint: { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,200,100,0.08)", border: "1px solid rgba(255,200,100,0.2)", borderRadius: 12, padding: "10px 14px" },
  profileHintTxt: { fontSize: 13, color: "rgba(255,220,150,0.55)" },
  profileHintName: { fontSize: 14, fontWeight: 700, color: "#ffe066" },
  error: { color: "#ff6b6b", fontSize: 13, margin: 0 },
  sessionRoot: { width: "100%", maxWidth: 420, padding: "20px 20px 60px", display: "flex", flexDirection: "column", gap: 14 },
  sessionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 4px" },
  sessionName: { fontSize: 18, fontWeight: 800, margin: 0 },
  sessionMeta: { display: "flex", gap: 10, alignItems: "center", marginTop: 4 },
  sessionTimer: { fontSize: 12, color: "rgba(255,220,150,0.5)" },
  sessionCode: { fontSize: 12, margin: "4px 0 0" },
  leaveBtn: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,200,100,0.2)", borderRadius: 12, color: "rgba(255,220,150,0.6)", fontSize: 13, padding: "8px 14px", cursor: "pointer" },
  expiredBanner: { background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 14, padding: "12px 16px", textAlign: "center", fontSize: 14, color: "#f87171", fontWeight: 700 },
  myCard: { background: "rgba(255,255,255,0.07)", backdropFilter: "blur(16px)", border: "2px solid", borderRadius: 24, padding: "18px 18px 14px", display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" },
  myName: { fontSize: 20, fontWeight: 900 },
  myLevel: { fontSize: 13, fontWeight: 800 },
  myItems: { display: "flex", flexWrap: "wrap", gap: 4, minHeight: 30, alignItems: "center" },
  itemChip: { fontSize: 22 },
  myScore: { display: "flex", alignItems: "baseline" },
  cardActions: { display: "flex", gap: 10, marginTop: 2 },
  addBtn: { flex: 1, border: "none", borderRadius: 14, padding: "13px", fontSize: 15, fontWeight: 800, cursor: "pointer" },
  undoBtn: { background: "rgba(255,255,255,0.09)", color: "#fff", border: "none", borderRadius: 14, padding: "13px 16px", fontSize: 15, cursor: "pointer" },
  leaderboard: { background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,200,100,0.15)", borderRadius: 22, padding: "16px" },
  lbTitle: { fontSize: 12, fontWeight: 700, color: "rgba(255,200,100,0.45)", margin: "0 0 10px" },
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
  editorCard: { background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: 20, padding: "16px", display: "flex", flexDirection: "column", gap: 12 },
  editorCardTitle: { fontSize: 14, fontWeight: 700, color: "#818cf8", margin: 0 },
  typeRow: { display: "flex", gap: 8 },
  typeBtn: { flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 4px", fontSize: 12, fontWeight: 700, color: "#888", cursor: "pointer" },
  typeBtnActive: { background: "rgba(129,140,248,0.2)", border: "1px solid rgba(129,140,248,0.5)", color: "#818cf8" },
  roundItem: { display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(129,140,248,0.15)", borderRadius: 14, padding: "12px 14px" },
  roundItemLeft: { flex: 1, display: "flex", gap: 8, alignItems: "center", overflow: "hidden" },
  roundItemType: { fontSize: 18, flexShrink: 0 },
  roundItemPrompt: { fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  roundItemActions: { display: "flex", gap: 4, flexShrink: 0 },
  iconBtn: { background: "none", border: "none", color: "#aaa", fontSize: 14, cursor: "pointer", padding: "4px 6px" },
  gameRoundCard: { background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.25)", borderRadius: 20, padding: "18px" },
  gameRoundType: { fontSize: 12, fontWeight: 700, color: "#818cf8", letterSpacing: "0.5px", textTransform: "uppercase" },
  gamePrompt: { fontSize: 18, fontWeight: 800, margin: "8px 0 0", lineHeight: 1.4 },
  ytWrap: { marginTop: 12, borderRadius: 12, overflow: "hidden" },
  ytFrame: { width: "100%", height: 200, border: "none" },
  gameImg: { width: "100%", borderRadius: 12, marginTop: 12 },
  gameAnswerSection: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "16px", display: "flex", flexDirection: "column", gap: 10 },
  answeredBadge: { background: "rgba(129,140,248,0.15)", border: "1px solid rgba(129,140,248,0.3)", borderRadius: 10, padding: "10px 14px", color: "#818cf8", fontSize: 14, fontWeight: 700, textAlign: "center" },
  playerStatusList: { display: "flex", flexWrap: "wrap", gap: 6 },
  playerStatusBadge: { fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 20 },
  voteOption: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: 14, padding: "14px 16px", textAlign: "left", color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 },
  votePlayerName: { fontSize: 15, fontWeight: 800 },
  voteAnswerPreview: { fontSize: 13, color: "rgba(255,220,150,0.6)", fontStyle: "italic" },
};
