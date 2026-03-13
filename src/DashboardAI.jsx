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

