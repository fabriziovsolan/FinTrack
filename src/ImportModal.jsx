import { useState, useRef } from "react";
import * as XLSX from "xlsx";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const ARS = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n || 0);

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
const MONTH_OPTS = Array.from({ length: 19 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - 12 + i, 1);
  const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  return { val, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
});

// ─── PDF → base64 ─────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}

// ─── Excel → texto plano ──────────────────────────────────────────────────────
function excelToText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        let text = "";
        wb.SheetNames.forEach(name => {
          const ws = wb.Sheets[name];
          text += `\n--- Hoja: ${name} ---\n`;
          text += XLSX.utils.sheet_to_csv(ws);
        });
        res(text);
      } catch (err) { rej(err); }
    };
    r.onerror = () => rej(new Error("No se pudo leer el Excel"));
    r.readAsArrayBuffer(file);
  });
}

// ─── Call Claude API ──────────────────────────────────────────────────────────
async function analyzeWithClaude(file, cardName) {
  const isPDF = file.type === "application/pdf";
  const isExcel = file.name.match(/\.(xlsx|xls|csv)$/i);

  let messages;

  const systemPrompt = `Sos un experto en análisis de resúmenes de tarjetas de crédito argentinas.
Tu tarea es extraer TODOS los consumos/compras del resumen y devolverlos en JSON.

Reglas:
- Extraé solo consumos/compras, NO pagos, NO saldos anteriores, NO intereses, NO comisiones fijas del banco
- Si hay cuotas, detectá el formato "X/Y" (ej: 3/12 = cuota 3 de 12) y usá el total original si está, sino el monto de la cuota
- Las fechas en formato YYYY-MM-DD
- Los montos siempre positivos en números (sin símbolos de moneda)
- Si no podés determinar un campo, usá valores razonables por defecto
- Respondé ÚNICAMENTE con el JSON, sin texto adicional, sin markdown

Formato de respuesta:
{
  "banco": "nombre del banco detectado",
  "periodo": "YYYY-MM",
  "consumos": [
    {
      "descripcion": "nombre del comercio o servicio",
      "monto": 12500,
      "cuotas": 1,
      "fecha": "2025-03-15"
    }
  ]
}`;

  if (isPDF) {
    const base64 = await fileToBase64(file);
    messages = [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: `Analizá este resumen de tarjeta de crédito${cardName ? ` de ${cardName}` : ""} y extraé todos los consumos en el formato JSON indicado.` }
      ]
    }];
  } else if (isExcel) {
    const text = await excelToText(file);
    messages = [{
      role: "user",
      content: `Analizá este resumen de tarjeta de crédito${cardName ? ` de ${cardName}` : ""}:\n\n${text}\n\nExtraé todos los consumos en el formato JSON indicado.`
    }];
  } else {
    throw new Error("Formato no soportado. Usá PDF o Excel.");
  }

  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_tokens: 4000,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) throw new Error(`Error de API: ${response.status}`);
  const data = await response.json();
  const text = data.content.map(i => i.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ─── ImportModal Component ────────────────────────────────────────────────────
export default function ImportModal({ cards, selMonth, onImport, onClose }) {
  const [step, setStep]         = useState("upload"); // upload | analyzing | preview | importing
  const [file, setFile]         = useState(null);
  const [cardId, setCardId]     = useState(cards[0]?.id || "");
  const [targetMonth, setMonth] = useState(selMonth || currentMonth);
  const [result, setResult]     = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError]       = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const card = cards.find(c => c.id === +cardId);

  const handleFile = (f) => {
    if (!f) return;
    const ok = f.type === "application/pdf" || f.name.match(/\.(xlsx|xls|csv)$/i);
    if (!ok) { setError("Solo se aceptan archivos PDF o Excel (.xlsx, .xls, .csv)"); return; }
    if (f.size > 20 * 1024 * 1024) { setError("El archivo no puede superar 20MB"); return; }
    setFile(f); setError(null);
  };

  const analyze = async () => {
    if (!file || !cardId) { setError("Seleccioná un archivo y una tarjeta"); return; }
    setStep("analyzing"); setError(null);
    try {
      const data = await analyzeWithClaude(file, card?.name);
      // Auto-assign month from result if available, else use selected
      const month = data.periodo || targetMonth;
      const consumos = (data.consumos || []).map((c, i) => ({
        ...c,
        id: i,
        month,
        cardId: +cardId,
        selected: true,
      }));
      setResult({ ...data, consumos, month });
      setSelected(consumos.map(c => c.id));
      setStep("preview");
    } catch (err) {
      setError(err.message || "Error al analizar el archivo");
      setStep("upload");
    }
  };

  const toggleAll = () => {
    if (selected.length === result.consumos.length) setSelected([]);
    else setSelected(result.consumos.map(c => c.id));
  };

  const toggle = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const confirmImport = async () => {
    const toImport = result.consumos.filter(c => selected.includes(c.id));
    if (!toImport.length) return;
    setStep("importing");
    try {
      await onImport(toImport, targetMonth);
    } catch (err) {
      setError(err.message);
      setStep("preview");
    }
  };

  const totalSelected = result?.consumos
    .filter(c => selected.includes(c.id))
    .reduce((s, c) => s + (c.monto || 0), 0) || 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:620 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
          <div>
            <h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:21, fontWeight:800, marginBottom:4 }}>
              📄 Importar resumen
            </h2>
            <p style={{ color:"#475569", fontSize:13 }}>
              {step==="upload" && "Subí el PDF o Excel de tu tarjeta"}
              {step==="analyzing" && "Claude AI está analizando tu resumen..."}
              {step==="preview" && `${result?.consumos?.length} consumos detectados — revisá antes de importar`}
              {step==="importing" && "Guardando consumos..."}
            </p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", fontSize:20, cursor:"pointer", padding:0 }}>✕</button>
        </div>

        {/* ── STEP: UPLOAD ── */}
        {step==="upload" && <>
          {/* Dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current.click()}
            style={{ border:`2px dashed ${dragOver?"#6366f1":"#1e293b"}`, borderRadius:16, padding:"36px 24px", textAlign:"center", cursor:"pointer", transition:"all .2s", background:dragOver?"#6366f108":"transparent", marginBottom:20 }}
          >
            <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" style={{ display:"none" }} onChange={e => handleFile(e.target.files[0])}/>
            {file ? (
              <div>
                <div style={{ fontSize:36, marginBottom:8 }}>{file.name.endsWith(".pdf") ? "📄" : "📊"}</div>
                <div style={{ fontWeight:700, color:"#e2e8f0", marginBottom:4 }}>{file.name}</div>
                <div style={{ fontSize:13, color:"#475569" }}>{(file.size/1024).toFixed(0)} KB · click para cambiar</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize:48, marginBottom:12 }}>📂</div>
                <div style={{ fontWeight:600, color:"#94a3b8", marginBottom:6 }}>Arrastrá tu resumen acá</div>
                <div style={{ fontSize:13, color:"#475569" }}>o hacé click para seleccionar</div>
                <div style={{ marginTop:12, display:"flex", gap:8, justifyContent:"center" }}>
                  {["PDF","XLSX","XLS","CSV"].map(f => <span key={f} className="badge" style={{ background:"#1e293b", color:"#64748b" }}>{f}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* Card selector */}
          <div className="field">
            <div className="lbl">Tarjeta *</div>
            <select value={cardId} onChange={e => setCardId(e.target.value)}>
              {cards.length === 0
                ? <option value="">Primero agregá una tarjeta</option>
                : cards.map(c => <option key={c.id} value={c.id}>{c.bank.icon} {c.name}</option>)
              }
            </select>
          </div>

          <div className="field">
            <div className="lbl">Mes del resumen</div>
            <select value={targetMonth} onChange={e => setMonth(e.target.value)}>
              {MONTH_OPTS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>

          {error && <div style={{ background:"#ef444415", border:"1px solid #ef444430", borderRadius:10, padding:12, marginBottom:16, fontSize:13, color:"#ef4444" }}>⚠️ {error}</div>}

          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-v" style={{ flex:1 }} onClick={analyze} disabled={!file || !cardId}>
              🔍 Analizar con IA
            </button>
            <button className="btn btn-g" onClick={onClose}>Cancelar</button>
          </div>

          <p style={{ fontSize:12, color:"#334155", marginTop:12, textAlign:"center" }}>
            El archivo se procesa de forma segura y no se almacena
          </p>
        </>}

        {/* ── STEP: ANALYZING ── */}
        {step==="analyzing" && (
          <div style={{ textAlign:"center", padding:"40px 20px" }}>
            <div style={{ width:64, height:64, border:"4px solid #6366f120", borderTop:"4px solid #6366f1", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 24px" }}></div>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Analizando {file?.name}</div>
            <div style={{ color:"#475569", fontSize:14 }}>Claude AI está leyendo tu resumen y detectando consumos...</div>
          </div>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step==="preview" && result && <>
          {/* Summary bar */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
            {[
              ["Banco detectado", result.banco || card?.bank?.name || "—", "#818cf8"],
              ["Consumos", `${selected.length} / ${result.consumos.length} seleccionados`, "#f59e0b"],
              ["Total seleccionado", ARS(totalSelected), "#10b981"],
            ].map(([l,v,c]) => (
              <div key={l} style={{ background:"#0f172a", borderRadius:12, padding:12 }}>
                <div style={{ fontSize:11, color:"#475569", marginBottom:4, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em" }}>{l}</div>
                <div style={{ fontWeight:700, color:c, fontSize:14 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Month override */}
          <div className="field">
            <div className="lbl">Asignar al mes</div>
            <select value={targetMonth} onChange={e => setMonth(e.target.value)}>
              {MONTH_OPTS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>

          {/* Table */}
          <div style={{ overflowY:"auto", maxHeight:320, borderRadius:12, border:"1px solid #1e293b", marginBottom:16 }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead style={{ position:"sticky", top:0, background:"#0f172a" }}>
                <tr>
                  <th style={{ padding:"10px 12px", textAlign:"left", width:36 }}>
                    <input type="checkbox" checked={selected.length===result.consumos.length} onChange={toggleAll} style={{ width:16, height:16, cursor:"pointer" }}/>
                  </th>
                  {["Descripción","Monto","Cuotas","Fecha"].map(h => (
                    <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:11, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:".07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.consumos.map((c) => (
                  <tr key={c.id} style={{ borderTop:"1px solid #0f172a", opacity:selected.includes(c.id)?1:0.4, transition:"opacity .15s" }}>
                    <td style={{ padding:"10px 12px" }}>
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} style={{ width:16, height:16, cursor:"pointer" }}/>
                    </td>
                    <td style={{ padding:"10px 12px", fontWeight:600, fontSize:13 }}>{c.descripcion}</td>
                    <td style={{ padding:"10px 12px", fontWeight:700, color:"#10b981", fontSize:13 }}>{ARS(c.monto)}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span className="badge" style={{ background:c.cuotas>1?"#6366f120":"#1e293b", color:c.cuotas>1?"#818cf8":"#64748b" }}>{c.cuotas}x</span>
                    </td>
                    <td style={{ padding:"10px 12px", color:"#475569", fontSize:12 }}>{c.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <div style={{ background:"#ef444415", border:"1px solid #ef444430", borderRadius:10, padding:12, marginBottom:16, fontSize:13, color:"#ef4444" }}>⚠️ {error}</div>}

          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-v" style={{ flex:1 }} onClick={confirmImport} disabled={!selected.length}>
              ✅ Importar {selected.length} consumo{selected.length!==1?"s":""}
            </button>
            <button className="btn btn-g" onClick={() => setStep("upload")}>← Volver</button>
          </div>
        </>}

        {/* ── STEP: IMPORTING ── */}
        {step==="importing" && (
          <div style={{ textAlign:"center", padding:"40px 20px" }}>
            <div style={{ width:64, height:64, border:"4px solid #10b98120", borderTop:"4px solid #10b981", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 24px" }}></div>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Guardando consumos...</div>
            <div style={{ color:"#475569", fontSize:14 }}>Estamos registrando {selected.length} consumo{selected.length!==1?"s":""} en tu cuenta</div>
          </div>
        )}

      </div>
    </div>
  );
}
