import { useState, useRef } from "react";

const ARS = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n || 0);

function PieChart({ slices, size = 180 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 10;
  let cumAngle = -Math.PI / 2;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;
  const paths = slices.filter(sl => sl.value > 0).map((sl) => {
    const angle = (sl.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { ...sl, d, pct: Math.round((sl.value / total) * 100) };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {paths.map((p, i) => (<path key={i} d={p.d} fill={p.color} stroke="#0a0f1e" strokeWidth={2}><title>{p.label}: {ARS(p.value)} ({p.pct}%)</title></path>))}
      <circle cx={cx} cy={cy} r={r * 0.5} fill="#111827"/>
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight={700} fontFamily="Plus Jakarta Sans,sans-serif">Total</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#818cf8" fontSize={10} fontFamily="DM Sans,sans-serif">{paths.length} items</text>
    </svg>
  );
}

export function DistributionBar({ totIncome, totExp, totLoans, balance }) {
  if (totIncome <= 0) return null;
  const expPct  = Math.min(100, Math.round((totExp   / totIncome) * 100));
  const loanPct = Math.min(100, Math.round((totLoans / totIncome) * 100));
  const totalPct = expPct + loanPct;
  const freePct  = Math.max(0, 100 - totalPct);
  const status = totalPct > 80 ? "critical" : totalPct > 60 ? "warning" : "good";
  const sc = { good:{color:"#10b981",label:"✅ Situación saludable",bg:"#10b98115"}, warning:{color:"#f59e0b",label:"⚠️ Atención requerida",bg:"#f59e0b15"}, critical:{color:"#ef4444",label:"🚨 Situación crítica",bg:"#ef444415"} }[status];
  return (
    <div className="card" style={{ marginBottom:20 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <span style={{ fontWeight:700,fontSize:15 }}>Distribución del ingreso</span>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:12,color:"#475569" }}>{ARS(totIncome)}</span>
          <span style={{ background:sc.bg,color:sc.color,borderRadius:999,padding:"3px 10px",fontSize:12,fontWeight:700 }}>{sc.label}</span>
        </div>
      </div>
      <div style={{ marginBottom:6 }}>
        <div style={{ fontSize:11,color:"#475569",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em" }}>Tu distribución actual</div>
        <div style={{ display:"flex",height:28,borderRadius:12,overflow:"hidden",gap:3,background:"#0f172a",padding:3 }}>
          {expPct>0&&<div style={{ width:`${expPct}%`,background:"linear-gradient(90deg,#f59e0b,#f97316)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white",minWidth:28,transition:"width .6s" }}>{expPct}%</div>}
          {loanPct>0&&<div style={{ width:`${loanPct}%`,background:"linear-gradient(90deg,#ef4444,#dc2626)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white",minWidth:28,transition:"width .6s" }}>{loanPct}%</div>}
          {freePct>0&&<div style={{ flex:1,background:freePct>=20?"linear-gradient(90deg,#10b981,#059669)":"linear-gradient(90deg,#64748b,#475569)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white",minWidth:28 }}>{freePct}% libre</div>}
        </div>
      </div>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11,color:"#475569",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em" }}>Distribución recomendada (50/30/20)</div>
        <div style={{ display:"flex",height:28,borderRadius:12,overflow:"hidden",gap:3,background:"#0f172a",padding:3 }}>
          <div style={{ width:"50%",background:"linear-gradient(90deg,#f59e0b88,#f9731688)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white",border:"1px dashed #f59e0b55" }}>50% gastos</div>
          <div style={{ width:"30%",background:"linear-gradient(90deg,#6366f188,#8b5cf688)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white",border:"1px dashed #6366f155" }}>30% ahorro</div>
          <div style={{ width:"20%",background:"linear-gradient(90deg,#10b98188,#05966988)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white",border:"1px dashed #10b98155" }}>20% inv.</div>
        </div>
      </div>
      <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
        {[["#f59e0b","Tarjetas",totExp,expPct],["#ef4444","Préstamos",totLoans,loanPct],["#10b981","Disponible",Math.max(0,balance),freePct]].map(([c,l,v,p])=>(
          <div key={l} style={{ display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#64748b" }}>
            <div style={{ width:9,height:9,borderRadius:3,background:c,flexShrink:0 }}></div>
            <span>{l}:</span><span style={{ color:c,fontWeight:700 }}>{ARS(v)}</span><span style={{ color:"#334155" }}>({p}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function fetchRecommendations({ totIncome, totExp, totLoans, balance, cards, expByCard, monthLabel }) {
  const totalPct = totIncome > 0 ? Math.round(((totExp + totLoans) / totIncome) * 100) : 0;
  const cardInfo = cards.map(c => `${c.name} (${c.limit ? Math.round(((expByCard[c.id]||0)/c.limit)*100) : 0}% del límite, $${(expByCard[c.id]||0).toLocaleString("es-AR")} gastado)`).join(", ") || "ninguna";
  const prompt = `Sos un asesor financiero personal para Argentina. Analizá estos datos de ${monthLabel} y dá recomendaciones en español argentino informal.
DATOS: Ingreso: $${totIncome.toLocaleString("es-AR")} | Tarjetas: $${totExp.toLocaleString("es-AR")} (${Math.round(totIncome>0?totExp/totIncome*100:0)}%) | Préstamos: $${totLoans.toLocaleString("es-AR")} (${Math.round(totIncome>0?totLoans/totIncome*100:0)}%) | Balance: $${balance.toLocaleString("es-AR")} | Comprometido: ${totalPct}% | Tarjetas: ${cardInfo}
Respondé SOLO con JSON válido sin markdown:
{"estado":"critico|precario|regular|bueno|excelente","resumen":"1 oración","limiteComprasTarjeta":<número>,"recomendaciones":[{"tipo":"ahorro|inversion|gasto|deuda|alerta","titulo":"título","detalle":"detalle con contexto argentino"}],"opcionesAhorro":[{"nombre":"nombre","rendimiento":"rendimiento","riesgo":"bajo|medio|alto","detalle":"detalle"}]}
Incluí 3-4 recomendaciones y 3 opciones (USDT, plazos fijos UVA, FCI, etc.).`;

  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error ${response.status}`);
  }
  const data = await response.json();
  const text = data.content.map(i => i.text || "").join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export function PieSection({ totIncome, totExp, totLoans, balance }) {
  if (totIncome <= 0) return null;
  const slices = [
    { label:"Tarjetas",   value:totExp,              color:"#f59e0b" },
    { label:"Préstamos",  value:totLoans,             color:"#ef4444" },
    { label:"Disponible", value:Math.max(0,balance),  color:"#10b981" },
  ].filter(s => s.value > 0);
  return (
    <div className="card" style={{ marginBottom:20 }}>
      <div style={{ fontWeight:700,fontSize:15,marginBottom:18 }}>¿A dónde va tu ingreso?</div>
      <div style={{ display:"flex",alignItems:"center",gap:24,flexWrap:"wrap" }}>
        <PieChart slices={slices} size={160}/>
        <div style={{ flex:1,minWidth:180 }}>
          {slices.map(s=>(
            <div key={s.label} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ width:12,height:12,borderRadius:4,background:s.color,flexShrink:0 }}></div>
                <span style={{ fontSize:14,color:"#94a3b8" }}>{s.label}</span>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:700,color:s.color,fontSize:14 }}>{ARS(s.value)}</div>
                <div style={{ fontSize:11,color:"#475569" }}>{Math.round((s.value/totIncome)*100)}%</div>
              </div>
            </div>
          ))}
          <div style={{ borderTop:"1px solid #1e293b",paddingTop:10,marginTop:4 }}>
            <div style={{ display:"flex",justifyContent:"space-between" }}>
              <span style={{ fontSize:13,color:"#64748b",fontWeight:600 }}>Total ingreso</span>
              <span style={{ fontWeight:800,color:"#e2e8f0",fontSize:14 }}>{ARS(totIncome)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIAdvisor({ totIncome, totExp, totLoans, balance, cards, expByCard, monthLabel }) {
  const [recs,    setRecs]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [open,    setOpen]    = useState(false);
  const fetched = useRef(false);

  const load = async () => {
    if (fetched.current) { setOpen(true); return; }
    setLoading(true); setError(null); setOpen(true);
    try {
      const data = await fetchRecommendations({ totIncome, totExp, totLoans, balance, cards, expByCard, monthLabel });
      setRecs(data); fetched.current = true;
    } catch (e) {
      setError(e.message || "No se pudieron cargar las recomendaciones.");
    } finally { setLoading(false); }
  };

  const estadoColor = { critico:"#ef4444",precario:"#f97316",regular:"#f59e0b",bueno:"#10b981",excelente:"#818cf8" };
  const tipoConfig  = { ahorro:{icon:"💰",color:"#10b981",bg:"#10b98115"}, inversion:{icon:"📈",color:"#818cf8",bg:"#6366f115"}, gasto:{icon:"💳",color:"#f59e0b",bg:"#f59e0b15"}, deuda:{icon:"🏦",color:"#ef4444",bg:"#ef444415"}, alerta:{icon:"⚠️",color:"#f97316",bg:"#f9731615"} };
  const riesgoColor = { bajo:"#10b981",medio:"#f59e0b",alto:"#ef4444" };

  if (totIncome <= 0) return null;

  return (
    <>
      {!open && (
        <button onClick={load} className="btn btn-v" style={{ width:"100%",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"13px 24px",fontSize:14 }}>
          🤖 Obtener recomendaciones financieras con IA
        </button>
      )}
      {open && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontWeight:700,fontSize:15 }}>🤖 Asesor Financiero IA</div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>{ fetched.current=false; setRecs(null); load(); }} style={{ background:"none",border:"1px solid #1e293b",color:"#64748b",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"DM Sans,sans-serif" }}>↺ Actualizar</button>
              <button onClick={()=>setOpen(false)} style={{ background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:16,padding:0 }}>✕</button>
            </div>
          </div>
          {loading && (
            <div style={{ textAlign:"center",padding:"32px 0" }}>
              <div style={{ width:40,height:40,border:"3px solid #6366f120",borderTop:"3px solid #6366f1",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 12px" }}></div>
              <div style={{ color:"#475569",fontSize:14 }}>Analizando tu situación financiera...</div>
            </div>
          )}
          {error && (
            <div style={{ background:"#ef444415",border:"1px solid #ef444430",borderRadius:10,padding:14,color:"#ef4444",fontSize:14 }}>
              ⚠️ {error}
              <button onClick={()=>{ fetched.current=false; setError(null); load(); }} style={{ marginLeft:12,background:"#ef444420",border:"1px solid #ef444440",color:"#ef4444",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:12,fontFamily:"DM Sans,sans-serif" }}>Reintentar</button>
            </div>
          )}
          {recs && !loading && <>
            <div style={{ background:`${estadoColor[recs.estado]||"#64748b"}15`,border:`1px solid ${estadoColor[recs.estado]||"#64748b"}30`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10 }}>
              <span style={{ fontSize:22 }}>{recs.estado==="excelente"?"🌟":recs.estado==="bueno"?"✅":recs.estado==="regular"?"📊":recs.estado==="precario"?"⚠️":"🚨"}</span>
              <div>
                <div style={{ fontWeight:700,color:estadoColor[recs.estado]||"#64748b",fontSize:14,textTransform:"capitalize" }}>{recs.estado}</div>
                <div style={{ fontSize:13,color:"#94a3b8",marginTop:2 }}>{recs.resumen}</div>
              </div>
            </div>
            {recs.limiteComprasTarjeta>0 && (
              <div style={{ background:"#f59e0b12",border:"1px solid #f59e0b25",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12 }}>
                <span style={{ fontSize:24 }}>💳</span>
                <div>
                  <div style={{ fontWeight:700,color:"#f59e0b",fontSize:13 }}>Límite recomendado en tarjetas el próximo mes</div>
                  <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:22,color:"#fbbf24",letterSpacing:"-0.02em" }}>{ARS(recs.limiteComprasTarjeta)}</div>
                  <div style={{ fontSize:12,color:"#78716c",marginTop:2 }}>Para no superar el 30% del ingreso en gastos de tarjeta</div>
                </div>
              </div>
            )}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:".07em",marginBottom:10 }}>Recomendaciones</div>
              <div style={{ display:"grid",gap:8 }}>
                {(recs.recomendaciones||[]).map((r,i)=>{ const cfg=tipoConfig[r.tipo]||tipoConfig.gasto; return (
                  <div key={i} style={{ background:cfg.bg,border:`1px solid ${cfg.color}25`,borderRadius:12,padding:"12px 14px",display:"flex",gap:10 }}>
                    <span style={{ fontSize:18,flexShrink:0,marginTop:1 }}>{cfg.icon}</span>
                    <div>
                      <div style={{ fontWeight:700,fontSize:13,color:cfg.color,marginBottom:3 }}>{r.titulo}</div>
                      <div style={{ fontSize:13,color:"#94a3b8",lineHeight:1.5 }}>{r.detalle}</div>
                    </div>
                  </div>
                );})}
              </div>
            </div>
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:".07em",marginBottom:10 }}>Opciones de ahorro e inversión 🇦🇷</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10 }}>
                {(recs.opcionesAhorro||[]).map((o,i)=>(
                  <div key={i} style={{ background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:14 }}>
                    <div style={{ fontWeight:700,fontSize:13,marginBottom:4 }}>{o.nombre}</div>
                    <div style={{ fontSize:13,color:"#818cf8",fontWeight:600,marginBottom:4 }}>{o.rendimiento}</div>
                    <span style={{ background:riesgoColor[o.riesgo]+"20",color:riesgoColor[o.riesgo],borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:700 }}>Riesgo {o.riesgo}</span>
                    <div style={{ fontSize:12,color:"#475569",marginTop:8,lineHeight:1.4 }}>{o.detalle}</div>
                  </div>
                ))}
              </div>
            </div>
          </>}
        </div>
      )}
    </>
  );
}
