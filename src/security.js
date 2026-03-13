// ─── Security utilities ────────────────────────────────────────────────────────

/**
 * Sanitiza strings para prevenir XSS antes de guardar en localStorage.
 * Elimina caracteres de control y limita longitud.
 */
export function sanitizeString(value, maxLength = 200) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[<>"'`]/g, "")          // strip HTML/script chars
    .replace(/[\x00-\x1F\x7F]/g, "")  // strip control characters
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitiza un número: asegura que sea finito, no-NaN, no negativo si se requiere.
 */
export function sanitizeNumber(value, { min = 0, max = 1_000_000_000 } = {}) {
  const n = parseFloat(value);
  if (!isFinite(n) || isNaN(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

/**
 * Sanitiza una fecha en formato YYYY-MM-DD.
 * Rechaza fechas inválidas o fuera de rango razonable.
 */
export function sanitizeDate(value) {
  if (typeof value !== "string") return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, y, m, d] = match.map(Number);
  if (y < 2000 || y > 2100) return "";
  if (m < 1 || m > 12) return "";
  if (d < 1 || d > 31) return "";
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

/**
 * Sanitiza un mes en formato YYYY-MM.
 */
export function sanitizeMonth(value) {
  if (typeof value !== "string") return "";
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  const [, y, m] = match.map(Number);
  if (y < 2000 || y > 2100 || m < 1 || m > 12) return "";
  return `${y}-${String(m).padStart(2,"0")}`;
}

/**
 * Valida y sanitiza un objeto de gasto antes de guardarlo.
 */
export function sanitizeExpense(raw) {
  return {
    id:           raw.id || Date.now(),
    cardId:       parseInt(raw.cardId) || 0,
    description:  sanitizeString(raw.description, 150),
    amount:       sanitizeNumber(raw.amount, { min: 0, max: 100_000_000 }),
    installments: Math.min(60, Math.max(1, parseInt(raw.installments) || 1)),
    date:         sanitizeDate(raw.date),
    month:        sanitizeMonth(raw.month),
  };
}

/**
 * Valida y sanitiza un ingreso.
 */
export function sanitizeIncome(raw) {
  return {
    id:          raw.id || Date.now(),
    description: sanitizeString(raw.description, 150),
    amount:      sanitizeNumber(raw.amount, { min: 0, max: 100_000_000 }),
    date:        sanitizeDate(raw.date),
    month:       sanitizeMonth(raw.month),
  };
}

/**
 * Valida y sanitiza un préstamo.
 */
export function sanitizeLoan(raw, bank) {
  const total = sanitizeNumber(raw.totalAmount, { min: 0, max: 1_000_000_000 });
  return {
    id:              raw.id || Date.now(),
    bank:            bank,
    description:     sanitizeString(raw.description, 150),
    totalAmount:     total,
    remainingAmount: sanitizeNumber(raw.remainingAmount ?? total, { min: 0, max: 1_000_000_000 }),
    monthlyPayment:  sanitizeNumber(raw.monthlyPayment, { min: 0, max: 100_000_000 }),
    startDate:       sanitizeDate(raw.startDate),
    endDate:         sanitizeDate(raw.endDate),
    interestRate:    sanitizeNumber(raw.interestRate, { min: 0, max: 10000 }),
  };
}

/**
 * Valida y sanitiza una tarjeta.
 */
export function sanitizeCard(raw, bank) {
  return {
    id:    raw.id || Date.now(),
    bank:  bank,
    name:  sanitizeString(raw.name, 100),
    limit: sanitizeNumber(raw.limit, { min: 0, max: 100_000_000 }),
  };
}

/**
 * Valida la integridad del array cargado desde localStorage.
 * Si el contenido está corrompido o es inesperado, devuelve el fallback.
 */
export function validateStoredArray(data, fallback) {
  if (!Array.isArray(data)) return fallback;
  if (data.length > 10_000) return fallback; // protección contra datos masivos
  return data;
}
