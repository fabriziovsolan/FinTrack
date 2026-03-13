import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import { sanitizeExpense, sanitizeIncome, sanitizeLoan, sanitizeCard } from "./security.js";
import { DistributionBar, PieSection } from "./DashboardAI.jsx";

// ─── Bank detection ────────────────────────────────────────────────────────────
const BANKS = [
  { name: "Santander",    color: "#EC0000", icon: "🏦", kw: ["santander"] },
  { name: "BBVA",         color: "#004481", icon: "🏛️", kw: ["bbva", "francés", "frances"] },
  { name: "Galicia",      color: "#E8302A", icon: "🏢", kw: ["galicia"] },
  { name: "Macro",        color: "#006CB5", icon: "🔵", kw: ["macro"] },
  { name: "Nación",       color: "#009B3A", icon: "🌿", kw: ["nación", "nacion", "bna"] },
  { name: "Ciudad",       color: "#F5A623", icon: "🌆", kw: ["ciudad", "gcba"] },
  { name: "Provincia",    color: "#0055A5", icon: "🏗️", kw: ["provincia", "bapro"] },
  { name: "ICBC",         color: "#CC0000", icon: "🔴", kw: ["icbc"] },
  { name: "Patagonia",    color: "#006B5C", icon: "🌊", kw: ["patagonia"] },
  { name: "Naranja X",    color: "#FF5F00", icon: "🟠", kw: ["naranja"] },
  { name: "Ualá",         color: "#7B2FBE", icon: "💜", kw: ["uala", "ualá"] },
  { name: "Mercado Pago", color: "#00B1EA", icon: "💙", kw: ["mercado pago"] },
  { name: "Personal Pay", color: "#6236FF", icon: "💳", kw: ["personal pay"] },
  { name: "Brubank",      color: "#1B1464", icon: "🟣", kw: ["brubank"] },
  { name: "Lemon",        color: "#F7D22D", icon: "🍋", kw: ["lemon"] },
];
const BANK_OTHER = { name: "Otro", color: "#64748b", icon: "💳" };
function detectBank(text) {
  if (!text) return BANK_OTHER;
  const lower = text.toLowerCase();
  return BANKS.find((b) => b.kw.some((k) => lower.includes(k))) || BANK_OTHER;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const ARS = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n || 0);

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const now = new Date();
const todayStr = now.toISOString().split("T")[0];
const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

const MONTH_OPTS = Array.from({ length: 19 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - 12 + i, 1);
  const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  return { val, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
});

const mLabel = (m) => { if (!m) return ""; const [y, mo] = m.split("-"); return `${MONTHS[+mo-1]} ${y}`; };

// Supabase row → local object
const rowToCard    = (r) => ({ id:r.id, name:r.name, limit:r.limit_amount, bank:detectBank(r.bank_name) });
const rowToExpense = (r) => ({ id:r.id, cardId:r.card_id, description:r.description, amount:r.amount, installments:r.installments, date:r.date, month:r.month });
const rowToIncome  = (r) => ({ id:r.id, description:r.description, amount:r.amount, date:r.date, month:r.month });
const rowToLoan    = (r) => ({ id:r.id, description:r.description, bank:detectBank(r.bank_name), totalAmount:r.total_amount, remainingAmount:r.remaining_amount, monthlyPayment:r.monthly_payment, startDate:r.start_date, endDate:r.end_date, interestRate:r.interest_rate });

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type = "success", onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [onDone]);
  const bg = type === "error" ? "#ef4444" : "#10b981";
  return (
    <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", background:bg, color:"white", padding:"12px 28px", borderRadius:12, fontWeight:600, fontSize:14, zIndex:9999, boxShadow:`0 8px 32px ${bg}55`, whiteSpace:"nowrap", animation:"slideUp .25s ease" }}>
      {msg}
    </div>
  );
}

// ─── Login Screen ──────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ─── Landing Screen ────────────────────────────────────────────────────────────
function LandingScreen({ onLogin, onGuest, loading }) {
  const features = [
    { icon:"💳", title:"Tarjetas de crédito", desc:"Controlá el consumo mensual y cuotas de cada tarjeta" },
    { icon:"🏦", title:"Préstamos", desc:"Seguí el progreso de cancelación y cuotas mensuales" },
    { icon:"💵", title:"Ingresos", desc:"Registrá tus entradas y visualizá tu balance real" },
    { icon:"📄", title:"Importar resúmenes", desc:"Subí tu PDF o Excel y la IA detecta todos tus consumos" },
  ];
  return (
    <div style={{ minHeight:"100vh", background:"#0a0f1e", fontFamily:"'DM Sans',sans-serif", color:"#e2e8f0" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Nav */}
      <nav style={{ padding:"20px 40px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #0f172a" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>💰</div>
          <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:20, fontWeight:800, background:"linear-gradient(135deg,#818cf8,#c084fc)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", letterSpacing:"-0.02em" }}>FinTrack</span>
        </div>
        <button onClick={onLogin} disabled={loading} style={{ display:"flex", alignItems:"center", gap:8, background:"#111827", border:"1px solid #1e293b", color:"#e2e8f0", borderRadius:10, padding:"9px 18px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .2s" }}>
          {loading ? <div style={{ width:16, height:16, border:"2px solid #6366f130", borderTop:"2px solid #6366f1", borderRadius:"50%", animation:"spin 1s linear infinite" }}></div> : <GoogleIcon/>}
          {loading ? "Conectando..." : "Iniciar sesión"}
        </button>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth:900, margin:"0 auto", padding:"80px 40px 60px", textAlign:"center", animation:"fadeUp .6s ease" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#6366f115", border:"1px solid #6366f130", borderRadius:999, padding:"6px 16px", marginBottom:28, fontSize:13, color:"#818cf8", fontWeight:600 }}>
          ✨ Gratis · Sin publicidad · Tus datos son tuyos
        </div>
        <h1 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:"clamp(32px,6vw,58px)", fontWeight:800, lineHeight:1.1, letterSpacing:"-0.03em", marginBottom:20 }}>
          Tomá el control de<br/>
          <span style={{ background:"linear-gradient(135deg,#818cf8,#c084fc)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>tus finanzas personales</span>
        </h1>
        <p style={{ fontSize:18, color:"#64748b", maxWidth:560, margin:"0 auto 48px", lineHeight:1.6 }}>
          Organizá tarjetas, préstamos e ingresos en un solo lugar. Importá tus resúmenes con IA y siempre sabé cuánto te queda.
        </p>
        <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={onLogin} disabled={loading} style={{ display:"flex", alignItems:"center", gap:10, background:"white", color:"#0f172a", border:"none", borderRadius:12, padding:"14px 28px", fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 24px rgba(0,0,0,0.4)", transition:"all .2s" }}>
            {loading ? <div style={{ width:20, height:20, border:"2px solid #0f172a30", borderTop:"2px solid #6366f1", borderRadius:"50%", animation:"spin 1s linear infinite" }}></div> : <GoogleIcon/>}
            {loading ? "Conectando..." : "Empezar con Google"}
          </button>
          <button onClick={onGuest} style={{ display:"flex", alignItems:"center", gap:8, background:"#111827", color:"#94a3b8", border:"1px solid #1e293b", borderRadius:12, padding:"14px 28px", fontSize:16, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .2s" }}>
            👀 Ver la app primero
          </button>
        </div>
        <p style={{ color:"#334155", fontSize:13, marginTop:16 }}>Sin tarjeta de crédito · Cuenta Google · 2 minutos</p>
      </div>

      {/* Features */}
      <div style={{ maxWidth:900, margin:"0 auto", padding:"0 40px 80px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16 }}>
          {features.map(f => (
            <div key={f.title} style={{ background:"#111827", border:"1px solid #1e293b", borderRadius:18, padding:24, transition:"border-color .2s" }}>
              <div style={{ fontSize:32, marginBottom:12 }}>{f.icon}</div>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:15, marginBottom:6 }}>{f.title}</div>
              <div style={{ color:"#475569", fontSize:13, lineHeight:1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sign-up nudge modal ───────────────────────────────────────────────────────
export function SignupNudge({ onLogin, onClose, loading }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20, backdropFilter:"blur(4px)" }}>
      <div style={{ background:"#111827", border:"1px solid #1e293b", borderRadius:22, padding:36, maxWidth:400, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
        <h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:22, fontWeight:800, marginBottom:10, letterSpacing:"-0.02em" }}>Guardá tus datos</h2>
        <p style={{ color:"#64748b", fontSize:14, marginBottom:28, lineHeight:1.6 }}>
          Para guardar tarjetas, consumos e ingresos necesitás iniciar sesión. Es gratis y tarda 10 segundos.
        </p>
        <button onClick={onLogin} disabled={loading} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10, background:"white", color:"#0f172a", border:"none", borderRadius:12, padding:"13px 24px", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 20px rgba(0,0,0,0.3)", marginBottom:10 }}>
          {loading ? <div style={{ width:18, height:18, border:"2px solid #0f172a30", borderTop:"2px solid #6366f1", borderRadius:"50%", animation:"spin 1s linear infinite" }}></div> : <GoogleIcon/>}
          {loading ? "Conectando..." : "Continuar con Google"}
        </button>
        <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          Seguir explorando
        </button>
      </div>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [session,      setSession]      = useState(null);
  const [authLoading,  setAuthLoading]  = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [guestMode,    setGuestMode]    = useState(false);
  const [showNudge,    setShowNudge]    = useState(false);
  const [cards,    setCards]    = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [income,   setIncome]   = useState([]);
  const [loans,    setLoans]    = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [tab,      setTab]      = useState("dashboard");
  const [modal,    setModal]    = useState(null);
  const [toast,    setToast]    = useState(null);

  const blankE = { cardId:"", description:"", amount:"", date:todayStr, installments:1, month:currentMonth };
  const blankI = { description:"", amount:"", date:todayStr, month:currentMonth };
  const blankL = { description:"", totalAmount:"", monthlyPayment:"", startDate:todayStr, endDate:"", interestRate:"" };
  const blankC = { name:"", limit:"" };
  const [fE, setFE] = useState(blankE);
  const [fI, setFI] = useState(blankI);
  const [fL, setFL] = useState(blankL);
  const [fC, setFC] = useState(blankC);

  const shout = useCallback((msg, type="success") => setToast({ msg, type }), []);

  // Auth — maneja tanto sesión existente como redirect de OAuth
  useEffect(() => {
    // El listener se dispara también cuando Supabase procesa el hash de la URL
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Verificar sesión activa (por si ya estaba logueado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo: window.location.origin } });
    if (error) { shout("Error al iniciar sesión", "error"); setLoginLoading(false); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setCards([]); setExpenses([]); setIncome([]); setLoans([]); };

  // Load data when session is ready (not in guest mode)
  useEffect(() => { if (session) loadAll(); }, [session]); // eslint-disable-line

  const loadAll = async () => {
    setDbLoading(true);
    try {
      const [c, e, i, l] = await Promise.all([
        supabase.from("cards").select("*").order("created_at"),
        supabase.from("expenses").select("*").order("date", { ascending:false }),
        supabase.from("income").select("*").order("date", { ascending:false }),
        supabase.from("loans").select("*").order("created_at"),
      ]);
      if (c.error || e.error || i.error || l.error) throw new Error("Error cargando datos");
      setCards(c.data.map(rowToCard));
      setExpenses(e.data.map(rowToExpense));
      setIncome(i.data.map(rowToIncome));
      setLoans(l.data.map(rowToLoan));
    } catch (err) { shout("Error al cargar datos", "error"); console.error(err); }
    finally { setDbLoading(false); }
  };

  // Computed
  const monthExp  = useMemo(() => expenses.filter(e => e.month === selMonth), [expenses, selMonth]);
  const monthInc  = useMemo(() => income.filter(i => i.month === selMonth),   [income,   selMonth]);
  const totIncome = useMemo(() => monthInc.reduce((s,i) => s+(i.amount||0), 0), [monthInc]);
  const totExp    = useMemo(() => monthExp.reduce((s,e) => s+(e.amount||0)/(e.installments||1), 0), [monthExp]);
  const totLoans  = useMemo(() => loans.reduce((s,l) => s+(l.monthlyPayment||0), 0), [loans]);
  const balance   = totIncome - totExp - totLoans;
  const expByCard = useMemo(() => { const m={}; monthExp.forEach(e => { m[e.cardId]=(m[e.cardId]||0)+(e.amount||0)/(e.installments||1); }); return m; }, [monthExp]);

  const openModal = useCallback((type) => {
    if (!session) { setShowNudge(true); return; }
    if (type==="expense") setFE({...blankE, month:selMonth});
    if (type==="income")  setFI({...blankI, month:selMonth});
    if (type==="loan")    setFL(blankL);
    if (type==="card")    setFC(blankC);
    setModal(type);
  }, [selMonth, session]); // eslint-disable-line

  // CRUD
  const addExpense = async () => {
    if (!fE.cardId || !fE.description.trim() || !fE.amount) return;
    const clean = sanitizeExpense({...fE, id:Date.now()});
    if (!clean.description || clean.amount <= 0) return;
    const { data, error } = await supabase.from("expenses").insert({ user_id:session.user.id, card_id:clean.cardId, description:clean.description, amount:clean.amount, installments:clean.installments, date:clean.date, month:clean.month }).select().single();
    if (error) { shout("Error al guardar", "error"); return; }
    setExpenses(p => [rowToExpense(data), ...p]); setModal(null); shout("✅ Consumo agregado");
  };
  const addIncome = async () => {
    if (!fI.description.trim() || !fI.amount) return;
    const clean = sanitizeIncome({...fI, id:Date.now()});
    if (!clean.description || clean.amount <= 0) return;
    const { data, error } = await supabase.from("income").insert({ user_id:session.user.id, description:clean.description, amount:clean.amount, date:clean.date, month:clean.month }).select().single();
    if (error) { shout("Error al guardar", "error"); return; }
    setIncome(p => [rowToIncome(data), ...p]); setModal(null); shout("✅ Ingreso registrado");
  };
  const addLoan = async () => {
    if (!fL.description.trim() || !fL.totalAmount || !fL.monthlyPayment) return;
    const bank = detectBank(fL.description);
    const clean = sanitizeLoan({...fL, id:Date.now()}, bank);
    if (!clean.description || clean.totalAmount <= 0) return;
    const { data, error } = await supabase.from("loans").insert({ user_id:session.user.id, bank_name:bank.name, description:clean.description, total_amount:clean.totalAmount, remaining_amount:clean.totalAmount, monthly_payment:clean.monthlyPayment, start_date:clean.startDate||null, end_date:clean.endDate||null, interest_rate:clean.interestRate }).select().single();
    if (error) { shout("Error al guardar", "error"); return; }
    setLoans(p => [...p, rowToLoan(data)]); setModal(null); shout("✅ Préstamo agregado");
  };
  const addCard = async () => {
    if (!fC.name.trim() || !fC.limit) return;
    const bank = detectBank(fC.name);
    const clean = sanitizeCard({...fC, id:Date.now()}, bank);
    if (!clean.name || clean.limit <= 0) return;
    const { data, error } = await supabase.from("cards").insert({ user_id:session.user.id, bank_name:bank.name, name:clean.name, limit_amount:clean.limit }).select().single();
    if (error) { shout("Error al guardar", "error"); return; }
    setCards(p => [...p, rowToCard(data)]); setModal(null); shout("✅ Tarjeta agregada");
  };


  const delExpense = async (id) => { const {error}=await supabase.from("expenses").delete().eq("id",id); if(error){shout("Error","error");return;} setExpenses(p=>p.filter(e=>e.id!==id)); shout("🗑️ Eliminado"); };
  const delIncome  = async (id) => { const {error}=await supabase.from("income").delete().eq("id",id);   if(error){shout("Error","error");return;} setIncome(p=>p.filter(i=>i.id!==id));   shout("🗑️ Eliminado"); };
  const delLoan    = async (id) => { const {error}=await supabase.from("loans").delete().eq("id",id);    if(error){shout("Error","error");return;} setLoans(p=>p.filter(l=>l.id!==id));    shout("🗑️ Eliminado"); };
  const delCard    = async (id) => { const {error}=await supabase.from("cards").delete().eq("id",id);    if(error){shout("Error","error");return;} setCards(p=>p.filter(c=>c.id!==id));    shout("🗑️ Eliminado"); };

  // CSS
  const S = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
    @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    input,select{background:#0f172a!important;border:1px solid #1e293b!important;color:#e2e8f0!important;border-radius:10px!important;padding:11px 14px!important;font-family:'DM Sans',sans-serif!important;font-size:14px!important;width:100%;outline:none!important;transition:border-color .15s,box-shadow .15s;appearance:auto}
    input:focus,select:focus{border-color:#6366f1!important;box-shadow:0 0 0 3px #6366f118!important}
    input::placeholder{color:#334155!important}
    select option{background:#0f172a}
    .tab{background:none;border:none;cursor:pointer;padding:8px 16px;border-radius:9px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;transition:all .15s;color:#64748b;white-space:nowrap}
    .tab.on{background:#6366f1;color:white;box-shadow:0 4px 14px #6366f145}
    .tab:hover:not(.on){background:#111827;color:#cbd5e1}
    .card{background:#111827;border:1px solid #1e293b;border-radius:18px;padding:24px}
    .btn{border:none;border-radius:10px;padding:11px 22px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;font-size:14px;transition:all .15s;white-space:nowrap}
    .btn-v{background:#6366f1;color:white}.btn-v:hover{background:#4f46e5;transform:translateY(-1px);box-shadow:0 4px 14px #6366f155}
    .btn-g{background:#1e293b;color:#94a3b8}.btn-g:hover{background:#273549;color:#e2e8f0}
    .btn-x{background:transparent;color:#ef4444;border:1px solid #ef444425;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:600;transition:all .15s;font-family:'DM Sans',sans-serif}
    .btn-x:hover{background:#ef444415;border-color:#ef444466}
    .pbar{background:#0f172a;border-radius:999px;height:8px;overflow:hidden}
    .pfill{height:100%;border-radius:999px;transition:width .7s cubic-bezier(.4,0,.2,1)}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px;backdrop-filter:blur(4px)}
    .modal{background:#111827;border:1px solid #1e293b;border-radius:22px;padding:32px;width:100%;max-width:460px;animation:fadeIn .2s ease;max-height:90vh;overflow-y:auto}
    .lbl{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px}
    .field{margin-bottom:16px}
    .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700}
    .scard{background:#111827;border:1px solid #1e293b;border-radius:18px;padding:22px}
    tr:hover td{background:#0f172a55}
    td{transition:background .1s}
    .empty{text-align:center;padding:56px 20px;color:#475569}
    h1,h2{letter-spacing:-0.02em;line-height:1.15}
  `;

  // ── Guards ──
  if (authLoading) return (
    <div style={{ background:"#0a0f1e",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:36,height:36,border:"3px solid #6366f120",borderTop:"3px solid #6366f1",borderRadius:"50%",animation:"spin 1s linear infinite" }}></div>
    </div>
  );

  if (!session && !guestMode) return (
    <LandingScreen
      onLogin={handleLogin}
      onGuest={() => setGuestMode(true)}
      loading={loginLoading}
    />
  );

  const user = session?.user;

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif",background:"#0a0f1e",minHeight:"100vh",color:"#e2e8f0" }}>
      <style>{S}</style>

      {/* ── Guest banner ── */}
      {!session && guestMode && (
        <div style={{ background:"linear-gradient(90deg,#6366f115,#8b5cf615)", borderBottom:"1px solid #6366f130", padding:"10px 24px", textAlign:"center", fontSize:13, color:"#818cf8" }}>
          <span style={{ marginRight:12 }}>👀 Estás en modo vista — los datos no se guardan</span>
          <button onClick={handleLogin} style={{ background:"#6366f1", color:"white", border:"none", borderRadius:8, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            Iniciar sesión para guardar
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ background:"#060d1b",borderBottom:"1px solid #0f172a",padding:"0 24px",position:"sticky",top:0,zIndex:50 }}>
        <div style={{ maxWidth:1160,margin:"0 auto",display:"flex",alignItems:"center",gap:20,height:62 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
            <div style={{ width:34,height:34,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>💰</div>
            <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:19,fontWeight:800,background:"linear-gradient(135deg,#818cf8,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"-0.02em" }}>FinTrack</span>
          </div>
          <nav style={{ display:"flex",gap:2,flex:1 }}>
            {[["dashboard","📊 Dashboard"],["tarjetas","💳 Tarjetas"],["prestamos","🏦 Préstamos"],["ingresos","💵 Ingresos"]].map(([id,lbl]) => (
              <button key={id} className={`tab ${tab===id?"on":""}`} onClick={() => setTab(id)}>{lbl}</button>
            ))}
          </nav>
          <div style={{ display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
            <select value={selMonth} onChange={e => setSelMonth(e.target.value)} style={{ width:148 }}>
              {MONTH_OPTS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
            {/* User badge */}
            <div style={{ display:"flex",alignItems:"center",gap:8,background:"#111827",border:"1px solid #1e293b",borderRadius:10,padding:"5px 10px 5px 6px" }}>
              {user?.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="" style={{ width:26,height:26,borderRadius:"50%",flexShrink:0 }} referrerPolicy="no-referrer"/>
                : <div style={{ width:26,height:26,borderRadius:"50%",background:"#6366f1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"white",flexShrink:0 }}>{(user.user_metadata?.full_name||user.email||"U")[0].toUpperCase()}</div>
              }
              <span style={{ fontSize:12,color:"#94a3b8",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                {user?.user_metadata?.full_name || user?.email || 'Invitado'}
              </span>
              {session
                ? <button onClick={handleLogout} title="Cerrar sesión" style={{ background:"none",border:"none",cursor:"pointer",color:"#475569",fontSize:15,padding:"0 0 0 4px",lineHeight:1,transition:"color .15s" }} onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color="#475569"}>⏏</button>
                : <button onClick={handleLogin} title="Iniciar sesión" style={{ background:"none",border:"none",cursor:"pointer",color:"#6366f1",fontSize:12,fontWeight:700,padding:"0 0 0 4px",lineHeight:1,fontFamily:"DM Sans,sans-serif" }}>Login</button>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Loading bar */}
      {dbLoading && <div style={{ height:2,background:"#1e293b" }}><div style={{ height:"100%",width:"70%",background:"linear-gradient(90deg,#6366f1,#8b5cf6)",animation:"slideRight 1.2s ease infinite",borderRadius:999 }}></div></div>}

      <div style={{ maxWidth:1160,margin:"0 auto",padding:"32px 24px 64px" }}>

        {/* ══ DASHBOARD ══ */}
        {tab==="dashboard" && <>
          <div style={{ marginBottom:28 }}>
            <h1 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:26,fontWeight:800,marginBottom:4 }}>Resumen — {mLabel(selMonth)}</h1>
            <p style={{ color:"#475569",fontSize:14 }}>Panorama financiero del mes</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22 }}>
            {[["Ingresos",totIncome,"#10b981","↑"],["Gastos tarjetas",totExp,"#f59e0b","💳"],["Cuotas préstamos",totLoans,"#ef4444","🏦"],["Balance neto",balance,balance>=0?"#10b981":"#ef4444",balance>=0?"✅":"⚠️"]].map(([lbl,val,color,icon]) => (
              <div key={lbl} className="scard" style={{ borderTop:`3px solid ${color}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                  <span style={{ fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:".06em" }}>{lbl}</span>
                  <div style={{ width:30,height:30,background:color+"18",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>{icon}</div>
                </div>
                <div style={{ fontSize:21,fontWeight:800,fontFamily:"'Plus Jakarta Sans',sans-serif",color,letterSpacing:"-0.01em" }}>{ARS(val)}</div>
              </div>
            ))}
          </div>
          <DistributionBar totIncome={totIncome} totExp={totExp} totLoans={totLoans} balance={balance}/>
          <PieSection totIncome={totIncome} totExp={totExp} totLoans={totLoans} balance={balance}/>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            <div className="card">
              <div style={{ fontWeight:700,marginBottom:18,fontSize:15 }}>Consumo por tarjeta</div>
              {cards.length===0?<div className="empty"><div style={{ fontSize:36,marginBottom:8 }}>💳</div><p>Sin tarjetas</p></div>
              :cards.map(c=>{const spent=expByCard[c.id]||0,pct=c.limit?Math.min(100,spent/c.limit*100):0,bc=pct>80?"#ef4444":pct>55?"#f59e0b":c.bank.color;return<div key={c.id} style={{ marginBottom:18 }}><div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7 }}><div style={{ display:"flex",alignItems:"center",gap:9 }}><span style={{ fontSize:20 }}>{c.bank.icon}</span><div><div style={{ fontSize:14,fontWeight:600 }}>{c.name}</div><div style={{ fontSize:12,color:"#475569" }}>{ARS(spent)} / {ARS(c.limit)}</div></div></div><span style={{ fontSize:14,fontWeight:700,color:bc }}>{Math.round(pct)}%</span></div><div className="pbar"><div className="pfill" style={{ width:`${pct}%`,background:bc }}></div></div></div>;})}
            </div>
            <div className="card">
              <div style={{ fontWeight:700,marginBottom:18,fontSize:15 }}>Préstamos activos</div>
              {loans.length===0?<div className="empty"><div style={{ fontSize:36,marginBottom:8 }}>🏦</div><p>Sin préstamos</p></div>
              :loans.map(l=>{const pct=l.totalAmount?Math.round((1-l.remainingAmount/l.totalAmount)*100):0;return<div key={l.id} style={{ marginBottom:18 }}><div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7 }}><div style={{ display:"flex",alignItems:"center",gap:9 }}><span style={{ fontSize:20 }}>{l.bank.icon}</span><div><div style={{ fontSize:14,fontWeight:600 }}>{l.description}</div><div style={{ fontSize:12,color:"#475569" }}>Cuota: {ARS(l.monthlyPayment)}/mes</div></div></div><span className="badge" style={{ background:"#6366f120",color:"#818cf8" }}>{pct}%</span></div><div className="pbar"><div className="pfill" style={{ width:`${pct}%`,background:"linear-gradient(90deg,#6366f1,#8b5cf6)" }}></div></div><div style={{ fontSize:12,color:"#475569",marginTop:4 }}>Saldo: {ARS(l.remainingAmount)}</div></div>;})}
            </div>
          </div>
        </>}

        {/* ══ TARJETAS ══ */}
        {tab==="tarjetas" && <>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28 }}>
            <div><h1 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:26,fontWeight:800,marginBottom:4 }}>Tarjetas de Crédito</h1><p style={{ color:"#475569",fontSize:14 }}>{mLabel(selMonth)} · {monthExp.length} consumo{monthExp.length!==1?"s":""} · {ARS(totExp)} total</p></div>
            <div style={{ display:"flex",gap:10 }}><button className="btn btn-g" onClick={()=>openModal("card")}>+ Nueva tarjeta</button><button className="btn btn-v" onClick={()=>openModal("expense")}>+ Agregar consumo</button></div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14,marginBottom:24 }}>
            {cards.length===0?<div className="card empty" style={{ gridColumn:"1/-1" }}><div style={{ fontSize:40,marginBottom:12 }}>💳</div><p style={{ marginBottom:16 }}>No tenés tarjetas</p><button className="btn btn-v" onClick={()=>openModal("card")}>Agregar tarjeta</button></div>
            :cards.map(c=>{const spent=expByCard[c.id]||0,pct=c.limit?Math.min(100,spent/c.limit*100):0,bc=pct>80?"#ef4444":pct>55?"#f59e0b":c.bank.color;return<div key={c.id} style={{ background:`linear-gradient(145deg,${c.bank.color}18 0%,#111827 60%)`,border:`1px solid ${c.bank.color}30`,borderRadius:18,padding:20 }}><div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18 }}><div><div style={{ fontSize:26,marginBottom:6 }}>{c.bank.icon}</div><div style={{ fontWeight:700,fontSize:15 }}>{c.name}</div><span className="badge" style={{ background:c.bank.color+"25",color:c.bank.color,marginTop:4 }}>{c.bank.name}</span></div><button className="btn-x" onClick={()=>delCard(c.id)}>✕</button></div><div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}><span style={{ fontSize:13,color:"#64748b" }}>Consumido</span><span style={{ fontWeight:700,color:bc }}>{ARS(spent)}</span></div><div className="pbar"><div className="pfill" style={{ width:`${pct}%`,background:bc }}></div></div><div style={{ display:"flex",justifyContent:"space-between",marginTop:5 }}><span style={{ fontSize:12,color:"#475569" }}>{Math.round(pct)}% usado</span><span style={{ fontSize:12,color:"#475569" }}>Límite {ARS(c.limit)}</span></div></div>;})}
          </div>
          <div className="card">
            <div style={{ fontWeight:700,marginBottom:18,fontSize:15 }}>Detalle de consumos — {mLabel(selMonth)}</div>
            {monthExp.length===0?<div className="empty"><div style={{ fontSize:40,marginBottom:12 }}>🛍️</div><p style={{ marginBottom:16 }}>Sin consumos este mes</p><button className="btn btn-v" onClick={()=>openModal("expense")}>Agregar consumo</button></div>
            :<div style={{ overflowX:"auto" }}><table style={{ width:"100%",borderCollapse:"collapse" }}>
              <thead><tr style={{ borderBottom:"1px solid #1e293b" }}>{["Descripción","Tarjeta","Monto total","Cuotas","Cuota mensual","Fecha",""].map(h=><th key={h} style={{ textAlign:"left",padding:"8px 14px",fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",whiteSpace:"nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>{[...monthExp].map(e=>{const card=cards.find(c=>c.id===e.cardId),bank=card?.bank||detectBank(e.description);return<tr key={e.id} style={{ borderBottom:"1px solid #0f172a" }}><td style={{ padding:"13px 14px",fontWeight:600 }}>{e.description}</td><td style={{ padding:"13px 14px" }}><div style={{ display:"flex",alignItems:"center",gap:7 }}><span style={{ fontSize:16 }}>{bank.icon}</span><span style={{ fontSize:13,color:"#94a3b8" }}>{card?.name||"—"}</span></div></td><td style={{ padding:"13px 14px",fontWeight:700 }}>{ARS(e.amount)}</td><td style={{ padding:"13px 14px" }}><span className="badge" style={{ background:e.installments>1?"#6366f120":"#1e293b",color:e.installments>1?"#818cf8":"#64748b" }}>{e.installments}x</span></td><td style={{ padding:"13px 14px",color:"#10b981",fontWeight:600 }}>{ARS((e.amount||0)/(e.installments||1))}</td><td style={{ padding:"13px 14px",color:"#475569",fontSize:13 }}>{e.date}</td><td style={{ padding:"13px 14px" }}><button className="btn-x" onClick={()=>delExpense(e.id)}>✕</button></td></tr>;})}
              </tbody>
              <tfoot><tr style={{ borderTop:"2px solid #1e293b" }}><td colSpan={4} style={{ padding:"12px 14px",fontSize:13,color:"#64748b" }}>Total a pagar este mes</td><td style={{ padding:"12px 14px",fontWeight:800,fontSize:15,color:"#f59e0b" }}>{ARS(totExp)}</td><td colSpan={2}></td></tr></tfoot>
            </table></div>}
          </div>
        </>}

        {/* ══ PRÉSTAMOS ══ */}
        {tab==="prestamos" && <>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28 }}>
            <div><h1 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:26,fontWeight:800,marginBottom:4 }}>Préstamos</h1><p style={{ color:"#475569",fontSize:14 }}>{loans.length} préstamo{loans.length!==1?"s":""} · {ARS(totLoans)}/mes</p></div>
            <button className="btn btn-v" onClick={()=>openModal("loan")}>+ Nuevo préstamo</button>
          </div>
          {loans.length===0?<div className="card empty"><div style={{ fontSize:40,marginBottom:12 }}>🏦</div><p style={{ marginBottom:16 }}>Sin préstamos</p><button className="btn btn-v" onClick={()=>openModal("loan")}>Agregar préstamo</button></div>
          :<div style={{ display:"grid",gap:16 }}>{loans.map(l=>{const pct=l.totalAmount?Math.round((1-l.remainingAmount/l.totalAmount)*100):0;return<div key={l.id} className="card" style={{ borderLeft:`4px solid ${l.bank.color}` }}><div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}><div style={{ display:"flex",gap:14,alignItems:"center" }}><div style={{ width:50,height:50,background:l.bank.color+"20",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0 }}>{l.bank.icon}</div><div><div style={{ fontWeight:800,fontSize:17,marginBottom:5 }}>{l.description}</div><span className="badge" style={{ background:l.bank.color+"20",color:l.bank.color }}>{l.bank.name}</span></div></div><button className="btn-x" onClick={()=>delLoan(l.id)}>✕ Eliminar</button></div><div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20 }}>{[["Monto original",ARS(l.totalAmount)],["Saldo restante",ARS(l.remainingAmount)],["Cuota mensual",ARS(l.monthlyPayment)],["TNA",`${l.interestRate}%`]].map(([lb,v])=><div key={lb} style={{ background:"#0a0f1e",borderRadius:12,padding:14 }}><div style={{ fontSize:11,color:"#475569",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em" }}>{lb}</div><div style={{ fontWeight:800,fontSize:17 }}>{v}</div></div>)}</div><div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}><span style={{ fontSize:13,color:"#94a3b8" }}>Progreso de cancelación</span><span style={{ fontWeight:700,color:"#818cf8" }}>{pct}% pagado</span></div><div className="pbar" style={{ height:10 }}><div className="pfill" style={{ width:`${pct}%`,background:`linear-gradient(90deg,${l.bank.color},#8b5cf6)` }}></div></div><div style={{ display:"flex",justifyContent:"space-between",marginTop:7,fontSize:12,color:"#475569" }}><span>📅 Inicio: {l.startDate}</span>{l.endDate&&<span>🏁 Fin: {l.endDate}</span>}</div></div>;})}</div>}
        </>}

        {/* ══ INGRESOS ══ */}
        {tab==="ingresos" && <>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28 }}>
            <div><h1 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:26,fontWeight:800,marginBottom:4 }}>Ingresos</h1><p style={{ color:"#475569",fontSize:14 }}>Historial de entradas de dinero</p></div>
            <button className="btn btn-v" onClick={()=>openModal("income")}>+ Agregar ingreso</button>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:24 }}>
            {[["Ingreso de "+mLabel(selMonth),ARS(totIncome),"#10b981"],["Registros este mes",monthInc.length,"#818cf8"],["Total histórico",ARS(income.reduce((s,i)=>s+(i.amount||0),0)),"#f59e0b"]].map(([lb,v,color])=><div key={lb} className="scard" style={{ borderTop:`3px solid ${color}` }}><div style={{ fontSize:11,color:"#475569",marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em" }}>{lb}</div><div style={{ fontSize:24,fontWeight:800,fontFamily:"'Plus Jakarta Sans',sans-serif",color,letterSpacing:"-0.01em" }}>{v}</div></div>)}
          </div>
          <div className="card">
            {income.length===0?<div className="empty"><div style={{ fontSize:40,marginBottom:12 }}>💵</div><p style={{ marginBottom:16 }}>Sin ingresos</p><button className="btn btn-v" onClick={()=>openModal("income")}>Agregar ingreso</button></div>
            :<table style={{ width:"100%",borderCollapse:"collapse" }}><thead><tr style={{ borderBottom:"1px solid #1e293b" }}>{["Descripción","Mes","Monto","Fecha",""].map(h=><th key={h} style={{ textAlign:"left",padding:"8px 14px",fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:".07em" }}>{h}</th>)}</tr></thead><tbody>{[...income].map(i=><tr key={i.id} style={{ borderBottom:"1px solid #0f172a" }}><td style={{ padding:"14px",fontWeight:600 }}>{i.description}</td><td style={{ padding:"14px" }}><span className="badge" style={{ background:"#1e293b",color:"#94a3b8" }}>{mLabel(i.month)}</span></td><td style={{ padding:"14px",fontWeight:800,color:"#10b981",fontSize:16 }}>{ARS(i.amount)}</td><td style={{ padding:"14px",color:"#475569",fontSize:13 }}>{i.date}</td><td style={{ padding:"14px" }}><button className="btn-x" onClick={()=>delIncome(i.id)}>✕</button></td></tr>)}</tbody></table>}
          </div>
        </>}
      </div>

      {/* ══ MODALS ══ */}
      {modal && <div className="overlay" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>

        {modal==="expense"&&<><h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:21,fontWeight:800,marginBottom:22 }}>Nuevo consumo</h2>
          <div className="field"><div className="lbl">Tarjeta *</div><select value={fE.cardId} onChange={e=>setFE({...fE,cardId:e.target.value})}><option value="">Seleccionar tarjeta...</option>{cards.map(c=><option key={c.id} value={c.id}>{c.bank.icon} {c.name}</option>)}</select></div>
          <div className="field"><div className="lbl">Descripción *</div><input placeholder="Supermercado, Netflix, Nafta..." value={fE.description} onChange={e=>setFE({...fE,description:e.target.value})} onKeyDown={e=>e.key==="Enter"&&addExpense()}/></div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div className="field"><div className="lbl">Monto total ($) *</div><input type="number" min="0" placeholder="0" value={fE.amount} onChange={e=>setFE({...fE,amount:e.target.value})}/></div>
            <div className="field"><div className="lbl">Cuotas</div><input type="number" min="1" max="60" value={fE.installments} onChange={e=>setFE({...fE,installments:e.target.value})}/></div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div className="field"><div className="lbl">Fecha</div><input type="date" value={fE.date} onChange={e=>setFE({...fE,date:e.target.value})}/></div>
            <div className="field"><div className="lbl">Mes del resumen</div><select value={fE.month} onChange={e=>setFE({...fE,month:e.target.value})}>{MONTH_OPTS.map(o=><option key={o.val} value={o.val}>{o.label}</option>)}</select></div>
          </div>
          {fE.amount&&+fE.installments>1&&<div style={{ background:"#6366f115",border:"1px solid #6366f130",borderRadius:10,padding:12,marginBottom:16,fontSize:14,color:"#818cf8",fontWeight:600 }}>💡 {fE.installments} cuotas de {ARS(+fE.amount/+fE.installments)} c/u</div>}
          <div style={{ display:"flex",gap:10 }}><button className="btn btn-v" style={{ flex:1 }} onClick={addExpense}>Agregar consumo</button><button className="btn btn-g" onClick={()=>setModal(null)}>Cancelar</button></div>
        </>}

        {modal==="income"&&<><h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:21,fontWeight:800,marginBottom:22 }}>Nuevo ingreso</h2>
          <div className="field"><div className="lbl">Descripción *</div><input placeholder="Sueldo, Freelance, Alquiler..." value={fI.description} onChange={e=>setFI({...fI,description:e.target.value})} onKeyDown={e=>e.key==="Enter"&&addIncome()}/></div>
          <div className="field"><div className="lbl">Monto ($) *</div><input type="number" min="0" placeholder="0" value={fI.amount} onChange={e=>setFI({...fI,amount:e.target.value})}/></div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div className="field"><div className="lbl">Fecha</div><input type="date" value={fI.date} onChange={e=>setFI({...fI,date:e.target.value})}/></div>
            <div className="field"><div className="lbl">Mes</div><select value={fI.month} onChange={e=>setFI({...fI,month:e.target.value})}>{MONTH_OPTS.map(o=><option key={o.val} value={o.val}>{o.label}</option>)}</select></div>
          </div>
          <div style={{ display:"flex",gap:10 }}><button className="btn btn-v" style={{ flex:1 }} onClick={addIncome}>Agregar ingreso</button><button className="btn btn-g" onClick={()=>setModal(null)}>Cancelar</button></div>
        </>}

        {modal==="loan"&&<><h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:21,fontWeight:800,marginBottom:22 }}>Nuevo préstamo</h2>
          <div className="field"><div className="lbl">Descripción * (detecta el banco)</div>
            <input placeholder="Ej: Préstamo Personal Santander..." value={fL.description} onChange={e=>setFL({...fL,description:e.target.value})}/>
            {fL.description&&(()=>{const b=detectBank(fL.description);return b.name!=="Otro"?<div style={{ marginTop:7,fontSize:13,color:b.color,fontWeight:600 }}>{b.icon} Detectado: {b.name}</div>:null;})()}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div className="field"><div className="lbl">Monto total ($) *</div><input type="number" min="0" placeholder="0" value={fL.totalAmount} onChange={e=>setFL({...fL,totalAmount:e.target.value})}/></div>
            <div className="field"><div className="lbl">Cuota mensual ($) *</div><input type="number" min="0" placeholder="0" value={fL.monthlyPayment} onChange={e=>setFL({...fL,monthlyPayment:e.target.value})}/></div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
            <div className="field"><div className="lbl">Fecha inicio</div><input type="date" value={fL.startDate} onChange={e=>setFL({...fL,startDate:e.target.value})}/></div>
            <div className="field"><div className="lbl">Fecha fin</div><input type="date" value={fL.endDate} onChange={e=>setFL({...fL,endDate:e.target.value})}/></div>
            <div className="field"><div className="lbl">TNA (%)</div><input type="number" min="0" placeholder="0" value={fL.interestRate} onChange={e=>setFL({...fL,interestRate:e.target.value})}/></div>
          </div>
          <div style={{ display:"flex",gap:10 }}><button className="btn btn-v" style={{ flex:1 }} onClick={addLoan}>Agregar préstamo</button><button className="btn btn-g" onClick={()=>setModal(null)}>Cancelar</button></div>
        </>}

        {modal==="card"&&<><h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:21,fontWeight:800,marginBottom:22 }}>Nueva tarjeta</h2>
          <div className="field"><div className="lbl">Nombre * (detecta el banco)</div>
            <input placeholder="Ej: Santander Visa, BBVA Mastercard..." value={fC.name} onChange={e=>setFC({...fC,name:e.target.value})} onKeyDown={e=>e.key==="Enter"&&addCard()}/>
            {fC.name&&(()=>{const b=detectBank(fC.name);return b.name!=="Otro"?<div style={{ marginTop:7,fontSize:13,color:b.color,fontWeight:600 }}>{b.icon} Detectado: {b.name}</div>:null;})()}
          </div>
          <div className="field"><div className="lbl">Límite de crédito ($) *</div><input type="number" min="0" placeholder="0" value={fC.limit} onChange={e=>setFC({...fC,limit:e.target.value})}/></div>
          <div style={{ display:"flex",gap:10 }}><button className="btn btn-v" style={{ flex:1 }} onClick={addCard}>Agregar tarjeta</button><button className="btn btn-g" onClick={()=>setModal(null)}>Cancelar</button></div>
        </>}

      </div></div>}

      {showNudge && <SignupNudge onLogin={handleLogin} onClose={()=>setShowNudge(false)} loading={loginLoading}/>}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </div>
  );
}
