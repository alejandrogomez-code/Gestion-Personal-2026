"use client";

/* ============================================================================
 *  GESTOR PERSONAL — App de gestión personal modular (single-file)
 *  Stack: Next.js (App Router) + React + Supabase + Vercel
 *
 *  Todo el código de la app vive en este archivo. Usa componentes internos
 *  reutilizables y un enfoque "schema-driven": cada entidad define sus campos
 *  en FIELD_SCHEMAS y los formularios/tablas se generan automáticamente.
 *
 *  Módulos:
 *    1. Objetivos
 *    2. Economía (Situación / Movimientos / Informes)
 *    3. Buenos Hábitos (Comida / Actividad / Resumen diario / Peso e IMC / Libros)
 *    4. Tenis
 *    5. Diario Personal  (ánimo, energía, estrés, notas, logros, mejoras)
 *    6. Configuración
 * ==========================================================================*/

import { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";
import Chart from "chart.js/auto";
import {
  Target, Wallet, HeartPulse, Trophy, NotebookPen, Settings as SettingsIcon,
  Plus, X, Pencil, Trash2, Check, ChevronLeft, Sun, Moon, LogOut, Sparkles,
  TrendingUp, TrendingDown, Calendar, BookOpen, Activity, Utensils, Scale,
} from "lucide-react";

/* ----------------------------------------------------------------------------
 * 1) CLIENTE SUPABASE
 *    Se inicializa desde variables de entorno. Si faltan, la app muestra una
 *    pantalla de configuración en lugar de romperse.
 * --------------------------------------------------------------------------*/
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/* ----------------------------------------------------------------------------
 * 2) PALETAS Y TEMA
 *    Cada paleta define variables CSS. El modo claro/oscuro y la paleta activa
 *    se aplican seteando estas variables en el contenedor raíz.
 * --------------------------------------------------------------------------*/
const PALETTES = {
  pro_claro: {
    label: "Claro profesional",
    dark: false,
    vars: {
      "--bg": "#f5f6f8", "--surface": "#ffffff", "--surface-2": "#f0f2f5",
      "--text": "#1c2230", "--muted": "#6b7280", "--border": "#e3e6ec",
      "--primary": "#3b5bdb", "--accent": "#7048e8",
      "--success": "#2f9e44", "--warning": "#f59f00", "--danger": "#e03131",
    },
  },
  oscuro_moderno: {
    label: "Oscuro moderno",
    dark: true,
    vars: {
      "--bg": "#0f1115", "--surface": "#181b22", "--surface-2": "#21252e",
      "--text": "#e8eaf0", "--muted": "#9aa3b2", "--border": "#2a2f3a",
      "--primary": "#5c7cfa", "--accent": "#9775fa",
      "--success": "#51cf66", "--warning": "#ffd43b", "--danger": "#ff6b6b",
    },
  },
  verde_salud: {
    label: "Verde salud",
    dark: false,
    vars: {
      "--bg": "#f1f7f2", "--surface": "#ffffff", "--surface-2": "#e7f1e9",
      "--text": "#16291c", "--muted": "#5f7167", "--border": "#d4e6d8",
      "--primary": "#2f9e44", "--accent": "#0ca678",
      "--success": "#2f9e44", "--warning": "#f08c00", "--danger": "#e8590c",
    },
  },
  azul_productividad: {
    label: "Azul productividad",
    dark: false,
    vars: {
      "--bg": "#eef3fb", "--surface": "#ffffff", "--surface-2": "#e1ebf8",
      "--text": "#102036", "--muted": "#5b6b80", "--border": "#cfddef",
      "--primary": "#1971c2", "--accent": "#1098ad",
      "--success": "#0ca678", "--warning": "#f59f00", "--danger": "#e03131",
    },
  },
};

const ThemeContext = createContext(null);
const useTheme = () => useContext(ThemeContext);

// Devuelve las variables CSS activas según paleta + modo oscuro.
function resolveThemeVars(paletteKey, dark) {
  const base = { ...PALETTES[paletteKey].vars };
  if (dark && !PALETTES[paletteKey].dark) {
    return { ...PALETTES.oscuro_moderno.vars, "--primary": base["--primary"], "--accent": base["--accent"] };
  }
  return base;
}

// Resuelve un color que puede venir como "var(--xxx)" o como hex.
function resolveColor(c, vars) {
  if (typeof c === "string" && c.startsWith("var(")) {
    const name = c.slice(4, -1).trim();
    return vars[name] || "#3b5bdb";
  }
  return c || "#3b5bdb";
}

// Convierte "#rrggbb" + alpha en rgba() para rellenos translúcidos.
function withAlpha(hex, a) {
  const h = (hex || "#3b5bdb").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ----------------------------------------------------------------------------
 * 3) DEFINICIÓN DE MÓDULOS (para el home tipo Odoo)
 * --------------------------------------------------------------------------*/
const MODULES = [
  { id: "objetivos", label: "Objetivos", icon: Target, color: "#7048e8", desc: "Metas y avances semanales" },
  { id: "economia", label: "Economía", icon: Wallet, color: "#1971c2", desc: "Cuentas, movimientos e informes" },
  { id: "habitos", label: "Buenos Hábitos", icon: HeartPulse, color: "#2f9e44", desc: "Comida, actividad, peso y lectura" },
  { id: "tenis", label: "Tenis", icon: Trophy, color: "#f08c00", desc: "Partidos y rendimiento" },
  { id: "diario", label: "Diario Personal", icon: NotebookPen, color: "#e8590c", desc: "Ánimo, energía y reflexión diaria" },
  { id: "config", label: "Configuración", icon: SettingsIcon, color: "#5b6b80", desc: "Perfil, categorías y temas" },
];

/* ----------------------------------------------------------------------------
 * 4) ESQUEMAS DE CAMPOS (schema-driven forms)
 *    Cada entidad describe sus campos; EntityForm los renderiza solo.
 * --------------------------------------------------------------------------*/
const FIELD_SCHEMAS = {
  goals: [
    { key: "name", label: "Nombre del objetivo", type: "text", required: true },
    { key: "description", label: "Descripción", type: "textarea" },
    { key: "goal_type", label: "Tipo", type: "select", options: ["mensual", "semanal", "anual", "personalizado"], required: true },
    { key: "target_value", label: "Meta numérica", type: "number", required: true },
    { key: "unit", label: "Unidad", type: "text", placeholder: "veces, kg, min, páginas…" },
    { key: "start_date", label: "Fecha de inicio", type: "date" },
    { key: "end_date", label: "Fecha de fin", type: "date" },
    { key: "weekly_frequency", label: "Frecuencia semanal esperada", type: "number" },
    { key: "status", label: "Estado", type: "select", options: ["activo", "pausado", "completado"] },
    { key: "notes", label: "Observaciones", type: "textarea" },
  ],
  goal_progress: [
    { key: "week_number", label: "Semana", type: "number", required: true },
    { key: "date", label: "Fecha", type: "date", required: true },
    { key: "amount", label: "Cantidad realizada", type: "number", required: true },
    { key: "notes", label: "Observación", type: "text" },
  ],
  accounts: [
    { key: "name", label: "Nombre de cuenta", type: "text", required: true },
    { key: "account_type", label: "Tipo", type: "select", options: ["cuenta bancaria", "billetera", "efectivo", "inversión", "ahorro"], required: true },
    { key: "institution", label: "Institución", type: "text" },
    { key: "currency", label: "Moneda", type: "text", placeholder: "ARS, USD…" },
    { key: "balance", label: "Saldo actual", type: "number", required: true },
    { key: "updated_on", label: "Fecha de actualización", type: "date" },
    { key: "notes", label: "Observación", type: "text" },
  ],
  financial_movements: [
    { key: "date", label: "Fecha", type: "date", required: true },
    { key: "account_id", label: "Cuenta", type: "ref", refTable: "accounts", required: true },
    { key: "description", label: "Descripción", type: "text", required: true },
    { key: "amount", label: "Importe", type: "number", required: true },
    { key: "movement_type", label: "Tipo", type: "select", options: ["ingreso", "egreso"], required: true },
    { key: "category_id", label: "Categoría", type: "ref", refTable: "categories" },
    { key: "status", label: "Estado", type: "select", options: ["pendiente de confirmar", "confirmado", "descartado"] },
    { key: "notes", label: "Observación", type: "text" },
  ],
  categories: [
    { key: "name", label: "Nombre", type: "text", required: true },
    { key: "kind", label: "Ámbito", type: "select", options: ["economia", "general"] },
    { key: "color", label: "Color", type: "color" },
    { key: "monthly_budget", label: "Presupuesto mensual (opcional)", type: "number" },
  ],
  meals: [
    { key: "date", label: "Fecha", type: "date", required: true },
    { key: "meal_type", label: "Tipo", type: "select", options: ["desayuno", "colación", "almuerzo", "merienda", "cena", "otro"], required: true },
    { key: "description", label: "Descripción", type: "textarea" },
    { key: "photo_url", label: "Foto (archivo o cámara)", type: "image" },
    { key: "calories", label: "Calorías estimadas", type: "number" },
    { key: "notes", label: "Observación", type: "text" },
  ],
  activities: [
    { key: "date", label: "Fecha", type: "date", required: true },
    { key: "activity_type", label: "Tipo", type: "select", options: ["pasos", "gimnasio", "tenis", "caminata", "bicicleta", "otra"], required: true },
    { key: "duration_min", label: "Duración (min)", type: "number" },
    { key: "steps", label: "Pasos (si aplica)", type: "number" },
    { key: "intensity", label: "Intensidad", type: "select", options: ["baja", "media", "alta"] },
    { key: "calories", label: "Calorías estimadas", type: "number" },
    { key: "notes", label: "Observación", type: "text" },
  ],
  body_measurements: [
    { key: "date", label: "Fecha", type: "date", required: true },
    { key: "weight", label: "Peso (kg)", type: "number", step: "0.001" },
    { key: "waist", label: "Cintura (cm)", type: "number", step: "0.1" },
    { key: "notes", label: "Observación", type: "text" },
  ],
  books: [
    { key: "title", label: "Nombre del libro", type: "text", required: true },
    { key: "author", label: "Autor", type: "text" },
    { key: "status", label: "Estado", type: "select", options: ["pendiente", "en curso", "completado"] },
    { key: "start_date", label: "Fecha de inicio", type: "date" },
    { key: "end_date", label: "Fecha de finalización", type: "date" },
    { key: "total_pages", label: "Páginas totales", type: "number" },
    { key: "pages_read", label: "Páginas leídas", type: "number" },
    { key: "notes", label: "Observación", type: "text" },
  ],
  tennis_matches: [
    { key: "date", label: "Fecha", type: "date", required: true },
    { key: "opponent", label: "Rival", type: "text" },
    { key: "match_type", label: "Tipo", type: "select", options: ["singles", "dobles"] },
    { key: "result", label: "Resultado", type: "select", options: ["ganado", "perdido"] },
    { key: "score", label: "Score", type: "text", placeholder: "6-3 6-4" },
    { key: "duration_min", label: "Duración (min)", type: "number" },
    { key: "place", label: "Lugar", type: "text" },
    { key: "calories", label: "Calorías estimadas", type: "number" },
    { key: "perceived_level", label: "Nivel percibido", type: "select", options: ["bajo", "medio", "alto"] },
    { key: "notes", label: "Observación", type: "textarea" },
  ],
  journal_entries: [
    { key: "date", label: "Fecha", type: "date", required: true },
    { key: "mood", label: "Estado de ánimo (1-10)", type: "range", min: 1, max: 10 },
    { key: "energy", label: "Energía (1-10)", type: "range", min: 1, max: 10 },
    { key: "stress", label: "Estrés (1-10)", type: "range", min: 1, max: 10 },
    { key: "note", label: "Nota libre del día", type: "textarea" },
    { key: "achievements", label: "Principales logros del día", type: "textarea" },
    { key: "improve_tomorrow", label: "Qué mejorar mañana", type: "textarea" },
  ],
};

/* ----------------------------------------------------------------------------
 * 5) HELPERS
 * --------------------------------------------------------------------------*/
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (d) => (d || "").slice(0, 7);
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// "2026-06" -> "jun 26"
const monthLabel = (key) => {
  const [y, m] = (key || "").split("-");
  if (!y || !m) return key || "";
  return `${MONTHS_ES[Number(m) - 1]} ${y.slice(2)}`;
};
const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const fmtMoney = (v, cur = "ARS") =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(num(v));

function imcClass(imc) {
  if (!imc) return "—";
  if (imc < 18.5) return "Bajo peso";
  if (imc < 25) return "Normal";
  if (imc < 30) return "Sobrepeso";
  return "Obesidad";
}
function progressColor(pct) {
  if (pct < 40) return "var(--danger)";
  if (pct < 75) return "var(--warning)";
  return "var(--success)";
}

/* --------- Parseo de CSV para importar movimientos ---------------------- */
// Normaliza importes en formato AR ("1.234,56") o US ("1,234.56").
function parseAmount(str) {
  if (str == null) return 0;
  let s = String(str).replace(/[^\d.,\-]/g, "");
  if (s.includes(".") && s.includes(",")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
// Convierte fechas dd/mm/aaaa o aaaa-mm-dd a ISO (aaaa-mm-dd).
function parseAnyDate(str) {
  if (!str) return todayISO();
  const s = String(str).trim();
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = "20" + y; return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (m) { const [, y, mo, d] = m; return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  return s.slice(0, 10);
}
// Parser CSV simple con autodetección de separador (, o ;) y comillas.
function parseCSV(text) {
  const firstLine = text.replace(/\r/g, "").split("\n")[0] || "";
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  const parseLine = (line) => {
    const out = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === delim && !inQ) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = (lines[0] ? parseLine(lines[0]) : []).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}
// Mapea filas de CSV a movimientos {date, description, amount, movement_type}.
function csvRowsToMovements({ headers, rows }) {
  const find = (keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const dateCol = find(["fecha", "date"]);
  const descCol = find(["desc", "detalle", "concepto", "movimiento", "referencia", "glosa"]);
  const amountCol = find(["importe", "monto", "amount", "valor"]);
  const debitCol = find(["debito", "débito", "debit"]);
  const creditCol = find(["credito", "crédito", "credit"]);
  return rows.map((r) => {
    let amount = 0, type = "egreso";
    if (amountCol >= 0) { const v = parseAmount(r[amountCol]); type = v < 0 ? "egreso" : "ingreso"; amount = Math.abs(v); }
    else { const d = debitCol >= 0 ? parseAmount(r[debitCol]) : 0; const c = creditCol >= 0 ? parseAmount(r[creditCol]) : 0;
      if (d) { type = "egreso"; amount = Math.abs(d); } else { type = "ingreso"; amount = Math.abs(c); } }
    return {
      date: dateCol >= 0 ? parseAnyDate(r[dateCol]) : todayISO(),
      description: descCol >= 0 ? r[descCol] : "(sin descripción)",
      amount, movement_type: type,
    };
  }).filter((m) => m.amount > 0);
}

/* ----------------------------------------------------------------------------
 * 6) CAPA DE IA Y BANCA
 *    Las funciones intentan usar la API Route segura (app/api/ai/route.js) y,
 *    si no hay clave o falla, caen a una heurística local. Así la app funciona
 *    con o sin IA conectada, y la API key nunca se expone en el cliente.
 * --------------------------------------------------------------------------*/

// Llama a la API Route del servidor. Devuelve null si no está disponible.
async function callAI(task, payload) {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, payload }),
    });
    const data = await res.json();
    return data?.ok ? data : null;
  } catch {
    return null;
  }
}

// IA: estimar calorías de una comida a partir de texto/foto.
async function aiEstimateMealCalories({ description }) {
  const r = await callAI("meal_calories", { description });
  if (r && typeof r.value === "number" && r.value > 0) return r.value;
  // Fallback heurístico simple por longitud de texto.
  const base = (description || "").length;
  return Math.max(120, Math.round(base * 6 + 200));
}

// IA: estimar calorías de una actividad física.
async function aiEstimateActivityCalories({ activity_type, duration_min, intensity, steps }) {
  const r = await callAI("activity_calories", { activity_type, duration_min, intensity, steps });
  if (r && typeof r.value === "number" && r.value > 0) return r.value;
  // Fallback: estimación basada en MET aproximado.
  const met = { caminata: 3.5, bicicleta: 7, gimnasio: 6, tenis: 7.3, pasos: 0, otra: 4 }[activity_type] || 4;
  if (activity_type === "pasos") return Math.round(num(steps) * 0.04);
  const factor = { baja: 0.8, media: 1, alta: 1.25 }[intensity] || 1;
  return Math.round(met * num(duration_min) * 0.0175 * 70 * factor); // 70kg de referencia
}

// IA: opinión sobre el plan de peso. NO reemplaza asesoramiento médico.
async function aiWeightPlanOpinion({ current, target, deadline, history }) {
  const r = await callAI("weight_opinion", { current, target, deadline, count: history?.length || 0 });
  if (r && r.text) return r.text;
  // Fallback textual.
  const diff = num(current) - num(target);
  const dir = diff > 0 ? "descenso" : "ascenso";
  return (
    `Plan de ${dir} de ${Math.abs(diff).toFixed(1)} kg hacia ${target} kg con plazo ${deadline || "no definido"}. ` +
    `Tenés ${history?.length || 0} mediciones registradas. ` +
    `Sugerencia general: priorizar un ritmo gradual (0,3–0,7 kg/semana), constancia en el registro y combinar ` +
    `alimentación y actividad. Este texto es orientativo y NO reemplaza asesoramiento médico o nutricional.`
  );
}

// IA: correlación de bienestar (Diario) con peso/ejercicio/comida/gastos.
async function aiWellbeingInsights({ journal, activities, meals }) {
  if (!journal?.length) return "Cargá algunos días en el diario para obtener correlaciones.";
  const r = await callAI("wellbeing_insights", {
    journal: journal.map((j) => ({ date: j.date, mood: j.mood, energy: j.energy, stress: j.stress })),
    activityCount: activities?.length || 0,
    mealCount: meals?.length || 0,
  });
  if (r && r.text) return r.text;
  // Fallback textual.
  const avg = (arr, k) => (arr.reduce((s, r2) => s + num(r2[k]), 0) / arr.length).toFixed(1);
  return (
    `Promedios recientes — ánimo: ${avg(journal, "mood")}, energía: ${avg(journal, "energy")}, ` +
    `estrés: ${avg(journal, "stress")}. Con más datos de ejercicio (${activities?.length || 0} registros) ` +
    `y comidas (${meals?.length || 0} registros), la IA podrá relacionar tu estado de ánimo con tu actividad, ` +
    `alimentación, peso y gastos. (Análisis local — conectá la API de IA para un análisis más completo.)`
  );
}

// Persistencia automática del resumen calórico diario en daily_health_summary.
// Recalcula consumido/gastado/balance por día y hace upsert (requiere índice
// único en (user_id, date) — ver supabase_migration_v2.sql).
async function syncDailySummary(userId, meals, activities) {
  if (!supabase || !userId) return;
  const map = {};
  meals.forEach((m) => {
    if (!m.date) return;
    map[m.date] = map[m.date] || { consumed: 0, burned: 0 };
    map[m.date].consumed += num(m.calories);
  });
  activities.forEach((a) => {
    if (!a.date) return;
    map[a.date] = map[a.date] || { consumed: 0, burned: 0 };
    map[a.date].burned += num(a.calories);
  });
  const rows = Object.entries(map).map(([date, v]) => ({
    user_id: userId,
    date,
    calories_consumed: v.consumed,
    calories_burned: v.burned,
    balance: v.consumed - v.burned,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  await supabase.from("daily_health_summary").upsert(rows, { onConflict: "user_id,date" });
}

// BANCA: importación futura de movimientos.
// En Argentina suele requerir agregadores financieros o APIs privadas:
// Belvo, Prometeo, o APIs bancarias específicas. Aquí un placeholder.
async function bankFetchMovements() {
  // TODO: integrar Belvo/Prometeo/API bancaria → devolver movimientos
  // que se insertarán con status "pendiente de confirmar".
  return [];
}

/* ----------------------------------------------------------------------------
 * 7) HOOK CRUD GENÉRICO (Supabase)
 * --------------------------------------------------------------------------*/
function useTable(table, userId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRows(data || []);
    setLoading(false);
  }, [table, userId]);

  useEffect(() => { reload(); }, [reload]);

  // Convierte cadenas vacías en null para que las columnas numéricas o de
  // fecha no fallen (Postgres rechaza "" en numeric/date).
  const clean = (payload) => {
    const out = {};
    for (const [k, v] of Object.entries(payload)) out[k] = v === "" ? null : v;
    return out;
  };

  const create = async (payload) => {
    const { data, error } = await supabase
      .from(table)
      .insert([{ ...clean(payload), user_id: userId }])
      .select();
    if (error) { setError(error.message); alert("No se pudo guardar: " + error.message); return null; }
    await reload();
    return data?.[0];
  };
  const update = async (id, payload) => {
    const { error } = await supabase
      .from(table)
      .update({ ...clean(payload), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { setError(error.message); alert("No se pudo guardar: " + error.message); return; }
    await reload();
  };
  const remove = async (id) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { setError(error.message); alert("No se pudo eliminar: " + error.message); return; }
    await reload();
  };

  return { rows, loading, error, reload, create, update, remove };
}

/* ============================================================================
 *  COMPONENTES UI REUTILIZABLES
 * ==========================================================================*/

function Card({ children, style, onClick, className = "" }) {
  return (
    <div className={`gp-card ${className}`} style={style} onClick={onClick}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", size = "md", type = "button", title }) {
  return (
    <button className={`gp-btn gp-btn-${variant} gp-btn-${size}`} onClick={onClick} type={type} title={title}>
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <Card className="gp-stat">
      <span className="gp-stat-label">{label}</span>
      <span className="gp-stat-value" style={{ color }}>{value}</span>
      {sub && <span className="gp-stat-sub">{sub}</span>}
    </Card>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="gp-modal-overlay" onClick={onClose}>
      <div className="gp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gp-modal-head">
          <h3>{title}</h3>
          <button className="gp-icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="gp-modal-body">{children}</div>
      </div>
    </div>
  );
}

// Lee un archivo de imagen, lo redimensiona y devuelve un data URL JPEG liviano.
function fileToResizedDataURL(file, maxDim = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height >= width && height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Formulario generado a partir de un schema de campos.
// aiActions: [{ label, field, run: async (form) => valor }] agrega botones de IA.
function EntityForm({ schema, initial, refs = {}, aiActions = [], onSubmit, onCancel }) {
  const [aiBusy, setAiBusy] = useState(false);
  const [form, setForm] = useState(() => {
    const base = {};
    schema.forEach((f) => {
      base[f.key] = initial?.[f.key] ?? (f.type === "range" ? f.min ?? 1 : f.type === "date" ? todayISO() : "");
    });
    return base;
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => {
    for (const f of schema) {
      if (f.required && (form[f.key] === "" || form[f.key] === null)) {
        alert(`El campo "${f.label}" es obligatorio.`);
        return;
      }
    }
    onSubmit(form);
  };

  return (
    <div className="gp-form">
      {schema.map((f) => (
        <div className="gp-field" key={f.key}>
          <label>{f.label}{f.required && <span className="gp-req">*</span>}</label>
          {f.type === "textarea" ? (
            <textarea value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} rows={3} />
          ) : f.type === "select" ? (
            <select value={form[f.key]} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">— Seleccionar —</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.type === "ref" ? (
            <select value={form[f.key]} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">— Seleccionar —</option>
              {(refs[f.refTable] || []).map((r) => (
                <option key={r.id} value={r.id}>{r.name || r.title || r.id}</option>
              ))}
            </select>
          ) : f.type === "range" ? (
            <div className="gp-range">
              <input type="range" min={f.min} max={f.max} value={form[f.key]}
                onChange={(e) => set(f.key, Number(e.target.value))} />
              <span className="gp-range-val">{form[f.key]}</span>
            </div>
          ) : f.type === "color" ? (
            <input type="color" value={form[f.key] || "#3b5bdb"} onChange={(e) => set(f.key, e.target.value)} />
          ) : f.type === "image" ? (
            <div className="gp-image-field">
              <input type="file" accept="image/*" capture="environment"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try { set(f.key, await fileToResizedDataURL(file)); }
                  catch { alert("No se pudo procesar la imagen."); }
                }} />
              {form[f.key] && (
                <div className="gp-image-preview">
                  <img src={form[f.key]} alt="foto" />
                  <button type="button" className="gp-icon-btn danger" onClick={() => set(f.key, "")}><X size={15} /></button>
                </div>
              )}
            </div>
          ) : (
            <input
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              step={f.step} placeholder={f.placeholder} value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
            />
          )}
        </div>
      ))}
      {aiActions.map((a) => (
        <button key={a.field} type="button" className="gp-ai-action" disabled={aiBusy}
          onClick={async () => {
            setAiBusy(true);
            try { const v = await a.run(form); if (v != null) set(a.field, v); }
            finally { setAiBusy(false); }
          }}>
          <Sparkles size={15} /> {aiBusy ? "Estimando…" : a.label}
        </button>
      ))}
      <div className="gp-form-actions">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit}><Check size={16} /> Guardar</Button>
      </div>
    </div>
  );
}

/* --------- Gráficos SVG simples (sin dependencias) ---------------------- */

function RingChart({ value, max, size = 96, label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const color = progressColor(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="48%" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text)">
        {Math.round(pct)}%
      </text>
      {label && <text x="50%" y="64%" textAnchor="middle" fontSize="9" fill="var(--muted)">{label}</text>}
    </svg>
  );
}

/* Base reutilizable: monta y actualiza una instancia de Chart.js. */
function ChartCanvas({ config, height = 240, ariaLabel }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
  }, [JSON.stringify(config)]);
  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel || "gráfico"} />
    </div>
  );
}

/* Gráfico de barras (categorías, conteos). Muestra el valor sobre cada barra. */
function BarChart({ data, height = 200 }) {
  const { paletteKey, dark } = useTheme();
  const vars = resolveThemeVars(paletteKey, dark);
  if (!data.length) return <div className="gp-empty-box">Sin datos</div>;
  const colors = data.map((d) => resolveColor(d.color, vars));
  // Plugin chico para dibujar el valor encima de cada barra.
  const valueLabels = {
    id: "valueLabels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.fillStyle = vars["--text"];
      ctx.font = "600 11px Inter, sans-serif";
      ctx.textAlign = "center";
      meta.data.forEach((bar, i) => {
        const v = data[i].value;
        if (v != null) ctx.fillText(Math.round(v).toLocaleString("es-AR"), bar.x, bar.y - 6);
      });
      ctx.restore();
    },
  };
  const config = {
    type: "bar",
    data: {
      labels: data.map((d) => d.label),
      datasets: [{
        data: data.map((d) => d.value),
        backgroundColor: colors.map((c) => withAlpha(c, 0.22)),
        borderColor: colors, borderWidth: 1.5, borderRadius: 6, maxBarThickness: 48,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        y: { beginAtZero: true, grid: { color: withAlpha(vars["--muted"], 0.15) }, ticks: { color: vars["--muted"], font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { color: vars["--muted"], font: { size: 11 }, autoSkip: false, maxRotation: 45 } },
      },
    },
    plugins: [valueLabels],
  };
  return <ChartCanvas config={config} height={height} ariaLabel="gráfico de barras" />;
}

/* Gráfico de líneas: curva suave + puntos marcados (combinación). */
function LineChart({ series, labels, height = 220 }) {
  const { paletteKey, dark } = useTheme();
  const vars = resolveThemeVars(paletteKey, dark);
  const all = series.flatMap((s) => s.points.map((p) => p.y));
  if (all.length === 0) return <div className="gp-empty-box">Sin datos</div>;
  const len = Math.max(...series.map((s) => s.points.length), 0);
  const xs = labels && labels.length ? labels : Array.from({ length: len }, (_, i) => i + 1);
  const config = {
    type: "line",
    data: {
      labels: xs,
      datasets: series.map((s) => {
        const c = resolveColor(s.color, vars);
        return {
          label: s.label || "",
          data: s.points.map((p) => p.y),
          borderColor: c,
          backgroundColor: withAlpha(c, 0.08),
          borderWidth: 2,
          tension: 0.4,          // curva suave
          fill: series.length === 1, // relleno tenue solo si hay una sola serie
          pointRadius: 3,        // puntos marcados
          pointHoverRadius: 5,
          pointBackgroundColor: c,
          pointBorderColor: c,
        };
      }),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        y: { beginAtZero: false, grid: { color: withAlpha(vars["--muted"], 0.15) }, ticks: { color: vars["--muted"], font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { color: vars["--muted"], font: { size: 11 }, maxRotation: 45 } },
      },
    },
  };
  return <ChartCanvas config={config} height={height} ariaLabel="gráfico de evolución" />;
}

/* Cabecera reutilizable de sección con botón "Agregar". */
function SectionHeader({ title, onAdd, addLabel = "Agregar", right }) {
  return (
    <div className="gp-section-head">
      <h2>{title}</h2>
      <div className="gp-section-head-right">
        {right}
        {onAdd && <Button onClick={onAdd} size="sm"><Plus size={16} /> {addLabel}</Button>}
      </div>
    </div>
  );
}

/* Tabla compacta con acciones editar/eliminar. */
function CompactList({ items, columns, onEdit, onDelete, empty = "Sin registros" }) {
  if (!items.length) return <div className="gp-empty-box">{empty}</div>;
  return (
    <div className="gp-table-wrap">
      <table className="gp-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th></th></tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(it) : it[c.key] ?? "—"}</td>)}
              <td className="gp-row-actions">
                {onEdit && <button className="gp-icon-btn" onClick={() => onEdit(it)}><Pencil size={15} /></button>}
                {onDelete && <button className="gp-icon-btn danger" onClick={() => onDelete(it.id)}><Trash2 size={15} /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Hook utilitario para manejar el modal de formulario de una entidad. */
function useFormModal() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  return {
    open, editing,
    add: () => { setEditing(null); setOpen(true); },
    edit: (item) => { setEditing(item); setOpen(true); },
    close: () => setOpen(false),
  };
}

/* ============================================================================
 *  MÓDULO 1 — OBJETIVOS
 * ==========================================================================*/
function ObjetivosModule({ userId }) {
  const goals = useTable("goals", userId);
  const progress = useTable("goal_progress", userId);
  const modal = useFormModal();
  const [detail, setDetail] = useState(null);     // objetivo abierto en detalle
  const progModal = useFormModal();

  const progressFor = (goalId) => progress.rows.filter((p) => p.goal_id === goalId);
  const totalDone = (goalId) => progressFor(goalId).reduce((s, p) => s + num(p.amount), 0);

  const save = async (form) => {
    if (modal.editing) await goals.update(modal.editing.id, form);
    else await goals.create(form);
    modal.close();
  };
  const saveProgress = async (form) => {
    const payload = { ...form, goal_id: detail.id };
    if (progModal.editing) await progress.update(progModal.editing.id, payload);
    else await progress.create(payload);
    progModal.close();
  };

  if (detail) {
    const done = totalDone(detail.id);
    const pct = num(detail.target_value) ? (done / num(detail.target_value)) * 100 : 0;
    const hist = progressFor(detail.id).sort((a, b) => (a.date > b.date ? 1 : -1));
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setDetail(null)}><ChevronLeft size={16} /> Volver</Button>
        <SectionHeader title={detail.name} onAdd={progModal.add} addLabel="Registrar avance" />
        <div className="gp-grid gp-grid-3">
          <Card className="gp-center"><RingChart value={done} max={num(detail.target_value)} size={120} label="avance" /></Card>
          <StatCard label="Meta" value={`${detail.target_value} ${detail.unit || ""}`} />
          <StatCard label="Realizado" value={`${done} ${detail.unit || ""}`} sub={`Faltan ${Math.max(0, num(detail.target_value) - done)}`} />
        </div>
        <h3 className="gp-subtitle">Historial semanal</h3>
        <CompactList
          items={hist}
          columns={[
            { key: "week_number", label: "Sem." },
            { key: "date", label: "Fecha" },
            { key: "amount", label: "Cantidad" },
            { key: "notes", label: "Obs." },
          ]}
          onEdit={progModal.edit}
          onDelete={progress.remove}
          empty="Aún no registraste avances."
        />
        <Modal open={progModal.open} title="Avance semanal" onClose={progModal.close}>
          <EntityForm schema={FIELD_SCHEMAS.goal_progress} initial={progModal.editing}
            onSubmit={saveProgress} onCancel={progModal.close} />
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Objetivos" onAdd={modal.add} addLabel="Nuevo objetivo" />
      <div className="gp-grid gp-grid-2">
        {goals.rows.map((g) => {
          const done = totalDone(g.id);
          const pct = num(g.target_value) ? (done / num(g.target_value)) * 100 : 0;
          const ritmo = pct >= 100 ? "Cumplido" : pct >= 60 ? "En ritmo" : "Atrasado";
          return (
            <Card key={g.id} className="gp-goal-card">
              <div className="gp-goal-info">
                <div className="gp-goal-top">
                  <h4>{g.name}</h4>
                  <span className={`gp-tag ${pct >= 100 ? "ok" : pct >= 60 ? "warn" : "bad"}`}>{ritmo}</span>
                </div>
                <p className="gp-muted">{g.description}</p>
                <div className="gp-goal-meta">
                  <span>Meta: <b>{g.target_value} {g.unit}</b></span>
                  <span>Hecho: <b>{done}</b></span>
                </div>
                <div className="gp-goal-actions">
                  <Button size="sm" variant="ghost" onClick={() => setDetail(g)}>Ver detalle</Button>
                  <button className="gp-icon-btn" onClick={() => modal.edit(g)}><Pencil size={15} /></button>
                  <button className="gp-icon-btn danger" onClick={() => goals.remove(g.id)}><Trash2 size={15} /></button>
                </div>
              </div>
              <RingChart value={done} max={num(g.target_value)} />
            </Card>
          );
        })}
        {goals.rows.length === 0 && <div className="gp-empty-box">Creá tu primer objetivo.</div>}
      </div>
      <Modal open={modal.open} title={modal.editing ? "Editar objetivo" : "Nuevo objetivo"} onClose={modal.close}>
        <EntityForm schema={FIELD_SCHEMAS.goals} initial={modal.editing} onSubmit={save} onCancel={modal.close} />
      </Modal>
    </div>
  );
}

/* ============================================================================
 *  MÓDULO 2 — ECONOMÍA
 * ==========================================================================*/
function EconomiaModule({ userId, currency }) {
  const [tab, setTab] = useState("situacion"); // situacion | movimientos | informes
  const accounts = useTable("accounts", userId);
  const movements = useTable("financial_movements", userId);
  const categories = useTable("categories", userId);

  return (
    <div>
      <div className="gp-tabs">
        {[["situacion", "Situación"], ["movimientos", "Movimientos"], ["informes", "Informes"]].map(([k, l]) => (
          <button key={k} className={`gp-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "situacion" && <EconSituacion accounts={accounts} currency={currency} />}
      {tab === "movimientos" && <EconMovimientos movements={movements} accounts={accounts} categories={categories} currency={currency} />}
      {tab === "informes" && <EconInformes movements={movements} categories={categories} currency={currency} />}
    </div>
  );
}

function EconSituacion({ accounts, currency }) {
  const modal = useFormModal();
  const liquidTypes = ["cuenta bancaria", "billetera", "efectivo"];
  const liquid = accounts.rows.filter((a) => liquidTypes.includes(a.account_type));
  const invest = accounts.rows.filter((a) => !liquidTypes.includes(a.account_type));
  const sum = (arr) => arr.reduce((s, a) => s + num(a.balance), 0);

  const save = async (form) => {
    if (modal.editing) await accounts.update(modal.editing.id, form);
    else await accounts.create(form);
    modal.close();
  };

  return (
    <div>
      <SectionHeader title="Situación actual" onAdd={modal.add} addLabel="Nueva cuenta" />
      <div className="gp-grid gp-grid-3">
        <StatCard label="Total disponible" value={fmtMoney(sum(liquid), currency)} color="var(--primary)" />
        <StatCard label="Invertido / ahorro" value={fmtMoney(sum(invest), currency)} color="var(--accent)" />
        <StatCard label="Patrimonio total" value={fmtMoney(sum(accounts.rows), currency)} color="var(--success)" />
      </div>
      <h3 className="gp-subtitle">Saldos líquidos</h3>
      <CompactList items={liquid}
        columns={[
          { key: "name", label: "Cuenta" }, { key: "account_type", label: "Tipo" },
          { key: "institution", label: "Institución" },
          { key: "balance", label: "Saldo", render: (a) => fmtMoney(a.balance, a.currency || currency) },
        ]}
        onEdit={modal.edit} onDelete={accounts.remove} empty="Sin cuentas líquidas." />
      <h3 className="gp-subtitle">Inversiones / ahorro</h3>
      <CompactList items={invest}
        columns={[
          { key: "name", label: "Cuenta" }, { key: "account_type", label: "Tipo" },
          { key: "balance", label: "Saldo", render: (a) => fmtMoney(a.balance, a.currency || currency) },
        ]}
        onEdit={modal.edit} onDelete={accounts.remove} empty="Sin inversiones." />
      <Modal open={modal.open} title={modal.editing ? "Editar cuenta" : "Nueva cuenta"} onClose={modal.close}>
        <EntityForm schema={FIELD_SCHEMAS.accounts} initial={modal.editing} onSubmit={save} onCancel={modal.close} />
      </Modal>
    </div>
  );
}

function EconMovimientos({ movements, accounts, categories, currency }) {
  const modal = useFormModal();
  const [transferOpen, setTransferOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const catName = (id) => categories.rows.find((c) => c.id === id)?.name || "—";
  const accName = (id) => accounts.rows.find((a) => a.id === id)?.name || "—";

  const save = async (form) => {
    const payload = { ...form, status: form.status || "pendiente de confirmar" };
    if (modal.editing) await movements.update(modal.editing.id, payload);
    else await movements.create(payload);
    modal.close();
  };

  // Transferencia: crea un movimiento tipo "transferencia", ajusta los saldos de
  // ambas cuentas y NO cuenta como ingreso ni egreso en los informes.
  const doTransfer = async ({ from, to, amount, date, description }) => {
    const amt = num(amount);
    await movements.create({
      date, account_id: from, transfer_account_id: to, amount: amt,
      movement_type: "transferencia", description: description || "Transferencia", status: "confirmado",
    });
    const fromAcc = accounts.rows.find((a) => a.id === from);
    const toAcc = accounts.rows.find((a) => a.id === to);
    if (fromAcc) await accounts.update(from, { balance: num(fromAcc.balance) - amt });
    if (toAcc) await accounts.update(to, { balance: num(toAcc.balance) + amt });
    setTransferOpen(false);
  };

  // Importación de CSV: cada fila entra como movimiento "pendiente de confirmar".
  const doImportCsv = async ({ account_id, rows }) => {
    for (const m of rows) await movements.create({ ...m, account_id, status: "pendiente de confirmar" });
    setCsvOpen(false);
    alert(`Se importaron ${rows.length} movimientos como pendientes de confirmar.`);
  };

  const pending = movements.rows.filter((m) => m.status === "pendiente de confirmar");
  const others = movements.rows.filter((m) => m.status !== "pendiente de confirmar");

  const columns = [
    { key: "date", label: "Fecha" },
    { key: "description", label: "Descripción" },
    { key: "account_id", label: "Cuenta", render: (m) => m.movement_type === "transferencia"
      ? `${accName(m.account_id)} → ${accName(m.transfer_account_id)}` : accName(m.account_id) },
    { key: "category_id", label: "Categoría", render: (m) => m.movement_type === "transferencia" ? "Transferencia" : catName(m.category_id) },
    { key: "amount", label: "Importe", render: (m) => {
      const color = m.movement_type === "ingreso" ? "var(--success)" : m.movement_type === "egreso" ? "var(--danger)" : "var(--muted)";
      const sign = m.movement_type === "ingreso" ? "+" : m.movement_type === "egreso" ? "-" : "";
      return <span style={{ color }}>{sign}{fmtMoney(m.amount, currency)}</span>;
    } },
  ];

  return (
    <div>
      <SectionHeader title="Movimientos" onAdd={modal.add} addLabel="Nuevo movimiento"
        right={<>
          <Button size="sm" variant="ghost" onClick={() => setTransferOpen(true)}>Transferencia</Button>
          <Button size="sm" variant="ghost" onClick={() => setCsvOpen(true)}>Importar CSV</Button>
        </>} />

      <h3 className="gp-subtitle">Pendientes de confirmar</h3>
      {pending.length === 0 ? <div className="gp-empty-box">No hay movimientos pendientes.</div> : (
        <div className="gp-pending-list">
          {pending.map((m) => (
            <Card key={m.id} className="gp-pending-item">
              <div>
                <b>{m.description}</b>
                <div className="gp-muted">{m.date} · {accName(m.account_id)} · {fmtMoney(m.amount, currency)}</div>
              </div>
              <div className="gp-pending-actions">
                <select defaultValue={m.category_id || ""} onChange={(e) => movements.update(m.id, { category_id: e.target.value })}>
                  <option value="">Categoría…</option>
                  {categories.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button size="sm" onClick={() => movements.update(m.id, { status: "confirmado" })}><Check size={14} /> Confirmar</Button>
                <Button size="sm" variant="ghost" onClick={() => modal.edit(m)}>Editar</Button>
                <Button size="sm" variant="danger" onClick={() => movements.update(m.id, { status: "descartado" })}>Descartar</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h3 className="gp-subtitle">Historial</h3>
      <CompactList items={others} columns={columns} onEdit={modal.edit} onDelete={movements.remove} empty="Sin movimientos confirmados." />

      <Modal open={modal.open} title={modal.editing ? "Editar movimiento" : "Nuevo movimiento"} onClose={modal.close}>
        <EntityForm schema={FIELD_SCHEMAS.financial_movements} initial={modal.editing}
          refs={{ accounts: accounts.rows, categories: categories.rows }} onSubmit={save} onCancel={modal.close} />
      </Modal>

      {transferOpen && <TransferModal accounts={accounts.rows} currency={currency}
        onClose={() => setTransferOpen(false)} onSubmit={doTransfer} />}
      {csvOpen && <CsvImportModal accounts={accounts.rows}
        onClose={() => setCsvOpen(false)} onImport={doImportCsv} />}
    </div>
  );
}

/* Modal de transferencia entre cuentas. */
function TransferModal({ accounts, currency, onClose, onSubmit }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const submit = () => {
    if (!from || !to) { alert("Elegí cuenta origen y destino."); return; }
    if (from === to) { alert("La cuenta origen y destino no pueden ser la misma."); return; }
    if (num(amount) <= 0) { alert("Ingresá un importe válido."); return; }
    onSubmit({ from, to, amount, date, description });
  };
  return (
    <Modal open title="Transferencia entre cuentas" onClose={onClose}>
      <div className="gp-form">
        <div className="gp-field"><label>Cuenta origen<span className="gp-req">*</span></label>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>
        <div className="gp-field"><label>Cuenta destino<span className="gp-req">*</span></label>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>
        <div className="gp-field"><label>Importe<span className="gp-req">*</span></label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="gp-field"><label>Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="gp-field"><label>Descripción (opcional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <p className="gp-hint"><Sparkles size={13} /> Ajusta el saldo de ambas cuentas y no cuenta como gasto ni ingreso.</p>
        <div className="gp-form-actions">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}><Check size={16} /> Transferir</Button>
        </div>
      </div>
    </Modal>
  );
}

/* Modal de importación de movimientos desde un archivo CSV. */
function CsvImportModal({ accounts, onClose, onImport }) {
  const [accountId, setAccountId] = useState("");
  const [parsed, setParsed] = useState(null);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = csvRowsToMovements(parseCSV(text));
      setParsed(rows);
    } catch { alert("No se pudo leer el CSV."); }
  };
  const submit = () => {
    if (!accountId) { alert("Elegí la cuenta a la que importar."); return; }
    if (!parsed || !parsed.length) { alert("Cargá un CSV con movimientos válidos."); return; }
    onImport({ account_id: accountId, rows: parsed });
  };
  return (
    <Modal open title="Importar movimientos desde CSV" onClose={onClose}>
      <div className="gp-form">
        <div className="gp-field"><label>Cuenta destino<span className="gp-req">*</span></label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>
        <div className="gp-field"><label>Archivo CSV</label>
          <input type="file" accept=".csv,text/csv" onChange={onFile} /></div>
        <p className="gp-hint"><Sparkles size={13} /> Detecto solo las columnas de fecha, descripción e importe (o débito/crédito). Entran como pendientes para que las revises.</p>
        {parsed && (
          <div>
            <p className="gp-muted">Se detectaron <b>{parsed.length}</b> movimientos. Vista previa:</p>
            <div className="gp-table-wrap">
              <table className="gp-table">
                <thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Importe</th></tr></thead>
                <tbody>
                  {parsed.slice(0, 5).map((m, i) => (
                    <tr key={i}><td>{m.date}</td><td>{m.description}</td><td>{m.movement_type}</td><td>{fmtMoney(m.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="gp-form-actions">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}><Check size={16} /> Importar</Button>
        </div>
      </div>
    </Modal>
  );
}

function EconInformes({ movements, categories, currency }) {
  const [month, setMonth] = useState(monthKey(todayISO()));
  const catName = (id) => categories.rows.find((c) => c.id === id)?.name || "Sin categoría";
  const catColor = (id) => categories.rows.find((c) => c.id === id)?.color || "var(--primary)";

  const confirmed = movements.rows.filter((m) => m.status === "confirmado" && m.movement_type === "egreso");
  const inMonth = confirmed.filter((m) => monthKey(m.date) === month);
  const prevMonthKey = (() => {
    const [y, mo] = month.split("-").map(Number);
    const d = new Date(y, mo - 2, 1);
    return d.toISOString().slice(0, 7);
  })();
  const inPrev = confirmed.filter((m) => monthKey(m.date) === prevMonthKey);

  const byCat = useMemo(() => {
    const map = {};
    inMonth.forEach((m) => { map[m.category_id] = (map[m.category_id] || 0) + num(m.amount); });
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map)
      .map(([id, val]) => {
        const prev = inPrev.filter((m) => m.category_id === id).reduce((s, m) => s + num(m.amount), 0);
        return { id, name: catName(id), value: val, pct: (val / total) * 100, prev, color: catColor(id) };
      })
      .sort((a, b) => b.value - a.value);
  }, [inMonth, inPrev, categories.rows]);

  const total = inMonth.reduce((s, m) => s + num(m.amount), 0);

  // Presupuestos: para cada categoría con tope definido, cuánto se gastó este mes.
  const spentByCat = (id) => inMonth.filter((m) => m.category_id === id).reduce((s, m) => s + num(m.amount), 0);
  const budgets = categories.rows
    .filter((c) => num(c.monthly_budget) > 0)
    .map((c) => {
      const spent = spentByCat(c.id);
      const budget = num(c.monthly_budget);
      return { id: c.id, name: c.name, color: c.color || "var(--primary)", spent, budget, pct: (spent / budget) * 100 };
    })
    .sort((a, b) => b.pct - a.pct);
  const budgetColor = (pct) => (pct >= 100 ? "var(--danger)" : pct >= 80 ? "var(--warning)" : "var(--success)");

  return (
    <div>
      <SectionHeader title="Informes mensuales"
        right={<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />} />
      <StatCard label={`Total gastos ${month}`} value={fmtMoney(total, currency)} color="var(--danger)" />

      {budgets.length > 0 && (
        <Card>
          <h4 className="gp-chart-title">Presupuestos del mes</h4>
          {budgets.map((b) => (
            <div key={b.id} className="gp-budget">
              <div className="gp-budget-top">
                <span>{b.name}</span>
                <span style={{ color: budgetColor(b.pct), fontWeight: 600 }}>
                  {fmtMoney(b.spent, currency)} / {fmtMoney(b.budget, currency)}
                  {b.pct >= 100 && " · ¡excedido!"}
                </span>
              </div>
              <div className="gp-progress">
                <div className="gp-progress-bar"
                  style={{ width: `${Math.min(100, b.pct)}%`, background: budgetColor(b.pct) }} />
              </div>
              <span className="gp-muted">{Math.round(b.pct)}% usado</span>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <BarChart data={byCat.map((c) => ({ label: c.name.slice(0, 8), value: Math.round(c.value), color: c.color }))} />
      </Card>
      <CompactList items={byCat}
        columns={[
          { key: "name", label: "Categoría" },
          { key: "value", label: "Total", render: (c) => fmtMoney(c.value, currency) },
          { key: "pct", label: "%", render: (c) => `${c.pct.toFixed(0)}%` },
          { key: "diff", label: "vs mes ant.", render: (c) => {
            const diff = c.value - c.prev;
            return <span style={{ color: diff > 0 ? "var(--danger)" : "var(--success)" }}>
              {diff >= 0 ? "+" : ""}{fmtMoney(diff, currency)}</span>;
          } },
        ]}
        empty="Sin gastos confirmados este mes." />
    </div>
  );
}

/* ============================================================================
 *  MÓDULO 3 — BUENOS HÁBITOS
 * ==========================================================================*/
function HabitosModule({ userId, profile }) {
  const [tab, setTab] = useState("comida");
  const meals = useTable("meals", userId);
  const activities = useTable("activities", userId);
  const measurements = useTable("body_measurements", userId);
  const books = useTable("books", userId);

  // Persistencia automática: cada vez que cambian comidas o actividades,
  // recalcula y guarda el resumen calórico diario en daily_health_summary.
  useEffect(() => {
    if (userId && !meals.loading && !activities.loading) {
      syncDailySummary(userId, meals.rows, activities.rows);
    }
  }, [userId, meals.rows, activities.rows, meals.loading, activities.loading]);

  const tabs = [
    ["comida", "Comida"], ["actividad", "Actividad"], ["resumen", "Resumen"],
    ["peso", "Peso e IMC"], ["libros", "Libros"],
  ];

  return (
    <div>
      <div className="gp-tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={`gp-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "comida" && <Comida meals={meals} />}
      {tab === "actividad" && <ActividadFisica activities={activities} />}
      {tab === "resumen" && <ResumenDiario meals={meals} activities={activities} />}
      {tab === "peso" && <PesoIMC measurements={measurements} profile={profile} />}
      {tab === "libros" && <Libros books={books} />}
    </div>
  );
}

function Comida({ meals }) {
  const modal = useFormModal();
  const [aiBusy, setAiBusy] = useState(false);
  const save = async (form) => {
    if (modal.editing) await meals.update(modal.editing.id, form);
    else await meals.create(form);
    modal.close();
  };
  const today = todayISO();
  const todayMeals = meals.rows.filter((m) => m.date === today);
  const todayCal = todayMeals.reduce((s, m) => s + num(m.calories), 0);
  const weekAvg = (() => {
    const days = {};
    meals.rows.forEach((m) => { days[m.date] = (days[m.date] || 0) + num(m.calories); });
    const vals = Object.values(days);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  })();

  const estimateAI = async (item) => {
    setAiBusy(true);
    const cal = await aiEstimateMealCalories({ description: item.description });
    await meals.update(item.id, { calories: cal });
    setAiBusy(false);
  };

  return (
    <div>
      <SectionHeader title="Comida saludable" onAdd={modal.add} addLabel="Registrar comida" />
      <div className="gp-grid gp-grid-2">
        <StatCard label="Calorías hoy" value={todayCal} color="var(--primary)" />
        <StatCard label="Promedio diario" value={weekAvg} sub="kcal/día" />
      </div>
      <CompactList items={meals.rows}
        columns={[
          { key: "photo_url", label: "", render: (m) => m.photo_url
            ? <img src={m.photo_url} alt="" className="gp-thumb" /> : <span className="gp-muted">—</span> },
          { key: "date", label: "Fecha" }, { key: "meal_type", label: "Tipo" },
          { key: "description", label: "Descripción" },
          { key: "calories", label: "kcal", render: (m) => (
            <span className="gp-cal-cell">
              {m.calories || "—"}
              {!m.calories && <button className="gp-ai-mini" disabled={aiBusy} onClick={() => estimateAI(m)}>
                <Sparkles size={12} /> IA</button>}
            </span>) },
        ]}
        onEdit={modal.edit} onDelete={meals.remove} empty="Sin comidas registradas." />
      <Modal open={modal.open} title={modal.editing ? "Editar comida" : "Registrar comida"} onClose={modal.close}>
        <EntityForm schema={FIELD_SCHEMAS.meals} initial={modal.editing} onSubmit={save} onCancel={modal.close}
          aiActions={[{ label: "Estimar calorías con IA", field: "calories",
            run: (form) => aiEstimateMealCalories({ description: form.description }) }]} />
        <p className="gp-hint"><Sparkles size={13} /> Cargá la descripción (o la foto) y tocá "Estimar calorías con IA".</p>
      </Modal>
    </div>
  );
}

function ActividadFisica({ activities }) {
  const modal = useFormModal();
  const [aiBusy, setAiBusy] = useState(false);
  const save = async (form) => {
    if (modal.editing) await activities.update(modal.editing.id, form);
    else await activities.create(form);
    modal.close();
  };
  const estimateAI = async (item) => {
    setAiBusy(true);
    const cal = await aiEstimateActivityCalories(item);
    await activities.update(item.id, { calories: cal });
    setAiBusy(false);
  };
  return (
    <div>
      <SectionHeader title="Actividad física" onAdd={modal.add} addLabel="Registrar actividad" />
      <CompactList items={activities.rows}
        columns={[
          { key: "date", label: "Fecha" }, { key: "activity_type", label: "Tipo" },
          { key: "duration_min", label: "Min" }, { key: "intensity", label: "Intensidad" },
          { key: "calories", label: "kcal", render: (a) => (
            <span className="gp-cal-cell">{a.calories || "—"}
              {!a.calories && <button className="gp-ai-mini" disabled={aiBusy} onClick={() => estimateAI(a)}>
                <Sparkles size={12} /> IA</button>}</span>) },
        ]}
        onEdit={modal.edit} onDelete={activities.remove} empty="Sin actividades registradas." />
      <Modal open={modal.open} title={modal.editing ? "Editar actividad" : "Registrar actividad"} onClose={modal.close}>
        <EntityForm schema={FIELD_SCHEMAS.activities} initial={modal.editing} onSubmit={save} onCancel={modal.close}
          aiActions={[{ label: "Estimar calorías con IA", field: "calories",
            run: (form) => aiEstimateActivityCalories(form) }]} />
      </Modal>
    </div>
  );
}

function ResumenDiario({ meals, activities }) {
  // Construye el saldo calórico por día (consumido - gastado).
  const days = useMemo(() => {
    const map = {};
    meals.rows.forEach((m) => {
      map[m.date] = map[m.date] || { date: m.date, consumed: 0, burned: 0 };
      map[m.date].consumed += num(m.calories);
    });
    activities.rows.forEach((a) => {
      map[a.date] = map[a.date] || { date: a.date, consumed: 0, burned: 0 };
      map[a.date].burned += num(a.calories);
    });
    return Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [meals.rows, activities.rows]);

  return (
    <div>
      <SectionHeader title="Registro general diario" />
      <CompactList
        items={days}
        columns={[
          { key: "date", label: "Día" },
          { key: "consumed", label: "Consumidas", render: (d) => `${Math.round(d.consumed)} kcal` },
          { key: "burned", label: "Gastadas", render: (d) => `${Math.round(d.burned)} kcal` },
          { key: "saldo", label: "Saldo", render: (d) => {
            const s = d.consumed - d.burned;
            return (
              <span style={{ color: s > 0 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                {s > 0 ? "+" : ""}{Math.round(s)} kcal · {s > 0 ? "superávit" : "déficit"}
              </span>
            );
          } },
        ]}
        empty="Registrá comidas y actividad para ver el balance."
      />
    </div>
  );
}

function PesoIMC({ measurements, profile }) {
  const modal = useFormModal();
  const save = async (form) => {
    if (modal.editing) await measurements.update(modal.editing.id, form);
    else await measurements.create(form);
    modal.close();
  };
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const sorted = [...measurements.rows].sort((a, b) => (a.date > b.date ? 1 : -1));
  const last = sorted[sorted.length - 1];
  const height = num(profile?.height); // metros
  const imc = last && height ? num(last.weight) / (height * height) : 0;
  const startW = num(profile?.start_weight) || num(sorted[0]?.weight);
  const targetW = num(profile?.target_weight);
  const diffStart = last ? num(last.weight) - startW : 0;
  const diffTarget = last ? num(last.weight) - targetW : 0;

  const opinion = async () => {
    setAiBusy(true);
    const txt = await aiWeightPlanOpinion({
      current: last?.weight, target: targetW, deadline: profile?.target_deadline, history: sorted,
    });
    setAiText(txt);
    setAiBusy(false);
  };

  return (
    <div>
      <SectionHeader title="Peso e IMC" onAdd={modal.add} addLabel="Nueva medición" />
      <div className="gp-grid gp-grid-3">
        <StatCard label="IMC actual" value={imc ? imc.toFixed(1) : "—"} sub={imcClass(imc)} color="var(--primary)" />
        <StatCard label="Objetivo de peso" value={targetW ? `${targetW} kg` : "—"}
          sub={last ? `${diffTarget >= 0 ? "+" : ""}${diffTarget.toFixed(1)} kg` : ""} color="var(--accent)" />
        <StatCard label="vs inicio" value={last ? `${diffStart >= 0 ? "+" : ""}${diffStart.toFixed(1)} kg` : "—"} />
      </div>
      <Card>
        <h4 className="gp-chart-title">Evolución de peso</h4>
        <LineChart labels={sorted.map((m) => m.date)} series={[{ color: "var(--primary)", points: sorted.map((m, i) => ({ x: i, y: num(m.weight) })) }]} />
      </Card>
      <Card>
        <h4 className="gp-chart-title">Evolución de cintura</h4>
        <LineChart labels={sorted.map((m) => m.date)} series={[{ color: "var(--accent)", points: sorted.map((m, i) => ({ x: i, y: num(m.waist) })) }]} />
      </Card>
      <Card className="gp-ai-box">
        <div className="gp-ai-head"><Sparkles size={16} /> Opinión IA del plan</div>
        {aiText ? <p>{aiText}</p> : <p className="gp-muted">Generá una orientación sobre tu plan de peso.</p>}
        <Button size="sm" variant="ghost" onClick={opinion} disabled={aiBusy}>{aiBusy ? "Analizando…" : "Generar opinión"}</Button>
      </Card>
      <CompactList items={sorted.slice().reverse()}
        columns={[
          { key: "date", label: "Fecha" },
          { key: "weight", label: "Peso (kg)" },
          { key: "waist", label: "Cintura (cm)" },
        ]}
        onEdit={modal.edit} onDelete={measurements.remove} empty="Sin mediciones." />
      <Modal open={modal.open} title="Medición corporal" onClose={modal.close}>
        <EntityForm schema={FIELD_SCHEMAS.body_measurements} initial={modal.editing} onSubmit={save} onCancel={modal.close} />
      </Modal>
    </div>
  );
}

function Libros({ books }) {
  const modal = useFormModal();
  const save = async (form) => {
    if (modal.editing) await books.update(modal.editing.id, form);
    else await books.create(form);
    modal.close();
  };
  const enCurso = books.rows.filter((b) => b.status === "en curso");
  const completados = books.rows.filter((b) => b.status === "completado");
  const yearDone = completados.filter((b) => (b.end_date || "").startsWith(String(new Date().getFullYear()))).length;
  const pct = (b) => num(b.total_pages) ? Math.min(100, (num(b.pages_read) / num(b.total_pages)) * 100) : 0;

  return (
    <div>
      <SectionHeader title="Lectura de libros" onAdd={modal.add} addLabel="Nuevo libro" />
      <div className="gp-grid gp-grid-3">
        <StatCard label="En curso" value={enCurso.length} color="var(--warning)" />
        <StatCard label="Completados" value={completados.length} color="var(--success)" />
        <StatCard label="Este año" value={yearDone} sub="libros" color="var(--primary)" />
      </div>
      {enCurso.map((b) => (
        <Card key={b.id} className="gp-book">
          <BookOpen size={20} />
          <div className="gp-book-info">
            <b>{b.title}</b> <span className="gp-muted">· {b.author}</span>
            <div className="gp-progress"><div className="gp-progress-bar" style={{ width: `${pct(b)}%` }} /></div>
            <span className="gp-muted">{b.pages_read || 0}/{b.total_pages || "?"} págs ({pct(b).toFixed(0)}%)</span>
          </div>
          <div>
            <button className="gp-icon-btn" onClick={() => modal.edit(b)}><Pencil size={15} /></button>
            <button className="gp-icon-btn danger" onClick={() => books.remove(b.id)}><Trash2 size={15} /></button>
          </div>
        </Card>
      ))}
      <CompactList items={books.rows.filter((b) => b.status !== "en curso")}
        columns={[
          { key: "title", label: "Libro" }, { key: "author", label: "Autor" }, { key: "status", label: "Estado" },
        ]}
        onEdit={modal.edit} onDelete={books.remove} empty="Sin otros libros." />
      <Modal open={modal.open} title={modal.editing ? "Editar libro" : "Nuevo libro"} onClose={modal.close}>
        <EntityForm schema={FIELD_SCHEMAS.books} initial={modal.editing} onSubmit={save} onCancel={modal.close} />
      </Modal>
    </div>
  );
}

/* ============================================================================
 *  MÓDULO 4 — TENIS
 * ==========================================================================*/
function TenisModule({ userId }) {
  const matches = useTable("tennis_matches", userId);
  const modal = useFormModal();
  const save = async (form) => {
    if (modal.editing) await matches.update(modal.editing.id, form);
    else await matches.create(form);
    modal.close();
  };

  const wins = matches.rows.filter((m) => m.result === "ganado").length;
  const losses = matches.rows.filter((m) => m.result === "perdido").length;
  const total = wins + losses;
  const effectiveness = total ? Math.round((wins / total) * 100) : 0;
  const totalMin = matches.rows.reduce((s, m) => s + num(m.duration_min), 0);
  const totalCal = matches.rows.reduce((s, m) => s + num(m.calories), 0);

  // Partidos por mes (para gráfico de evolución).
  const byMonth = useMemo(() => {
    const map = {};
    matches.rows.forEach((m) => { const k = monthKey(m.date); map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort().map(([k, v]) => ({ label: monthLabel(k), value: v }));
  }, [matches.rows]);

  return (
    <div>
      <SectionHeader title="Tenis" onAdd={modal.add} addLabel="Cargar partido" />
      <div className="gp-grid gp-grid-3">
        <StatCard label="Efectividad" value={`${effectiveness}%`} sub={`${wins}V / ${losses}D`} color="var(--success)" />
        <StatCard label="Tiempo jugado" value={`${Math.round(totalMin / 60)} h`} sub={`${totalMin} min`} color="var(--primary)" />
        <StatCard label="Calorías" value={totalCal} sub="estimadas" color="var(--warning)" />
      </div>
      <Card>
        <h4 className="gp-chart-title">Partidos por mes</h4>
        <BarChart data={byMonth.map((d) => ({ ...d, color: "var(--warning)" }))} />
      </Card>
      <CompactList items={matches.rows}
        columns={[
          { key: "date", label: "Fecha" }, { key: "opponent", label: "Rival" },
          { key: "result", label: "Resultado", render: (m) => (
            <span className={`gp-tag ${m.result === "ganado" ? "ok" : "bad"}`}>{m.result}</span>) },
          { key: "score", label: "Score" }, { key: "match_type", label: "Tipo" },
        ]}
        onEdit={modal.edit} onDelete={matches.remove} empty="Sin partidos registrados." />
      {/* Estructura futura: entrenamientos, golpes a mejorar, estadísticas por rival. */}
      <Modal open={modal.open} title={modal.editing ? "Editar partido" : "Cargar partido"} onClose={modal.close}>
        <EntityForm schema={FIELD_SCHEMAS.tennis_matches} initial={modal.editing} onSubmit={save} onCancel={modal.close} />
      </Modal>
    </div>
  );
}

/* ============================================================================
 *  MÓDULO 5 — DIARIO PERSONAL  (NUEVO)
 * ==========================================================================*/
function DiarioModule({ userId }) {
  const journal = useTable("journal_entries", userId);
  const activities = useTable("activities", userId);
  const meals = useTable("meals", userId);
  const modal = useFormModal();
  const [insight, setInsight] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const save = async (form) => {
    if (modal.editing) await journal.update(modal.editing.id, form);
    else await journal.create(form);
    modal.close();
  };

  const sorted = [...journal.rows].sort((a, b) => (a.date > b.date ? 1 : -1));
  const avg = (k) => sorted.length ? (sorted.reduce((s, r) => s + num(r[k]), 0) / sorted.length).toFixed(1) : "—";

  const runInsights = async () => {
    setAiBusy(true);
    // La IA podrá relacionar peso, ejercicio, alimentación, gastos y ánimo.
    const txt = await aiWellbeingInsights({ journal: sorted, activities: activities.rows, meals: meals.rows });
    setInsight(txt);
    setAiBusy(false);
  };

  return (
    <div>
      <SectionHeader title="Diario Personal" onAdd={modal.add} addLabel="Registrar día" />
      <div className="gp-grid gp-grid-3">
        <StatCard label="Ánimo prom." value={avg("mood")} sub="/ 10" color="var(--success)" />
        <StatCard label="Energía prom." value={avg("energy")} sub="/ 10" color="var(--primary)" />
        <StatCard label="Estrés prom." value={avg("stress")} sub="/ 10" color="var(--danger)" />
      </div>
      <Card>
        <h4 className="gp-chart-title">Evolución de ánimo, energía y estrés</h4>
        <LineChart labels={sorted.map((r) => r.date)} series={[
          { color: "var(--success)", label: "Ánimo", points: sorted.map((r, i) => ({ x: i, y: num(r.mood) })) },
          { color: "var(--primary)", label: "Energía", points: sorted.map((r, i) => ({ x: i, y: num(r.energy) })) },
          { color: "var(--danger)", label: "Estrés", points: sorted.map((r, i) => ({ x: i, y: num(r.stress) })) },
        ]} />
        <div className="gp-legend">
          <span><i style={{ background: "var(--success)" }} />Ánimo</span>
          <span><i style={{ background: "var(--primary)" }} />Energía</span>
          <span><i style={{ background: "var(--danger)" }} />Estrés</span>
        </div>
      </Card>
      <Card className="gp-ai-box">
        <div className="gp-ai-head"><Sparkles size={16} /> Correlaciones IA</div>
        {insight ? <p>{insight}</p> :
          <p className="gp-muted">La IA podrá relacionar tu ánimo con peso, ejercicio, alimentación y gastos.</p>}
        <Button size="sm" variant="ghost" onClick={runInsights} disabled={aiBusy}>
          {aiBusy ? "Analizando…" : "Generar análisis"}</Button>
      </Card>

      <h3 className="gp-subtitle">Entradas</h3>
      <div className="gp-grid gp-grid-2">
        {sorted.slice().reverse().map((e) => (
          <Card key={e.id} className="gp-journal">
            <div className="gp-journal-head">
              <span><Calendar size={14} /> {e.date}</span>
              <div>
                <button className="gp-icon-btn" onClick={() => modal.edit(e)}><Pencil size={14} /></button>
                <button className="gp-icon-btn danger" onClick={() => journal.remove(e.id)}><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="gp-journal-scores">
              <span>😊 {e.mood ?? "—"}</span><span>⚡ {e.energy ?? "—"}</span><span>😰 {e.stress ?? "—"}</span>
            </div>
            {e.note && <p className="gp-journal-note">{e.note}</p>}
            {e.achievements && <p className="gp-journal-line"><b>Logros:</b> {e.achievements}</p>}
            {e.improve_tomorrow && <p className="gp-journal-line"><b>Mejorar:</b> {e.improve_tomorrow}</p>}
          </Card>
        ))}
        {sorted.length === 0 && <div className="gp-empty-box">Registrá tu primer día.</div>}
      </div>

      <Modal open={modal.open} title={modal.editing ? "Editar día" : "Registrar día"} onClose={modal.close}>
        <EntityForm schema={FIELD_SCHEMAS.journal_entries} initial={modal.editing} onSubmit={save} onCancel={modal.close} />
      </Modal>
    </div>
  );
}

/* ============================================================================
 *  MÓDULO 6 — CONFIGURACIÓN
 * ==========================================================================*/
function ConfiguracionModule({ userId, profile, reloadProfile, settings, reloadSettings, onLogout }) {
  const categories = useTable("categories", userId);
  const catModal = useFormModal();
  const { paletteKey, setPaletteKey, dark, setDark } = useTheme();

  const saveProfile = async (patch) => {
    if (!profile) {
      await supabase.from("profiles").insert([{ user_id: userId, ...patch }]);
    } else {
      await supabase.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
    reloadProfile();
  };
  const saveSetting = async (patch) => {
    if (!settings) {
      await supabase.from("settings").insert([{ user_id: userId, ...patch }]);
    } else {
      await supabase.from("settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
    reloadSettings();
  };
  const saveCat = async (form) => {
    if (catModal.editing) await categories.update(catModal.editing.id, form);
    else await categories.create(form);
    catModal.close();
  };

  const profileFields = [
    { key: "full_name", label: "Nombre", type: "text" },
    { key: "height", label: "Altura (m)", type: "number", step: "0.01" },
    { key: "start_weight", label: "Peso inicial (kg)", type: "number", step: "0.001" },
    { key: "target_weight", label: "Objetivo de peso (kg)", type: "number", step: "0.001" },
    { key: "target_deadline", label: "Plazo objetivo", type: "date" },
    { key: "start_waist", label: "Cintura inicial (cm)", type: "number", step: "0.1" },
  ];

  return (
    <div>
      <SectionHeader title="Configuración" />

      <Card className="gp-config-block">
        <h3 className="gp-chart-title">Apariencia</h3>
        <div className="gp-palette-grid">
          {Object.entries(PALETTES).map(([key, p]) => (
            <button key={key} className={`gp-palette ${paletteKey === key ? "active" : ""}`}
              onClick={() => { setPaletteKey(key); setDark(p.dark); saveSetting({ palette: key, dark: p.dark }); }}>
              <div className="gp-palette-dots">
                <i style={{ background: p.vars["--primary"] }} />
                <i style={{ background: p.vars["--accent"] }} />
                <i style={{ background: p.vars["--bg"], border: "1px solid var(--border)" }} />
              </div>
              {p.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setDark(!dark); saveSetting({ dark: !dark }); }}>
          {dark ? <Sun size={16} /> : <Moon size={16} />} Modo {dark ? "claro" : "oscuro"}
        </Button>
      </Card>

      <Card className="gp-config-block">
        <h3 className="gp-chart-title">Datos personales y salud</h3>
        <div className="gp-form">
          {profileFields.map((f) => (
            <div className="gp-field" key={f.key}>
              <label>{f.label}</label>
              <input type={f.type === "number" ? "number" : f.type} step={f.step}
                defaultValue={profile?.[f.key] ?? ""}
                onBlur={(e) => saveProfile({ [f.key]: e.target.value })} />
            </div>
          ))}
          <div className="gp-field">
            <label>Moneda principal</label>
            <input defaultValue={settings?.currency ?? "ARS"} onBlur={(e) => saveSetting({ currency: e.target.value })} />
          </div>
        </div>
        <p className="gp-hint">Los cambios se guardan al salir de cada campo.</p>
      </Card>

      <Card className="gp-config-block">
        <SectionHeader title="Categorías" onAdd={catModal.add} addLabel="Nueva categoría" />
        <CompactList items={categories.rows}
          columns={[
            { key: "name", label: "Nombre" }, { key: "kind", label: "Ámbito" },
            { key: "color", label: "Color", render: (c) => <span className="gp-color-dot" style={{ background: c.color || "var(--primary)" }} /> },
          ]}
          onEdit={catModal.edit} onDelete={categories.remove} empty="Sin categorías." />
      </Card>

      <Button variant="danger" onClick={onLogout}><LogOut size={16} /> Cerrar sesión</Button>

      <Modal open={catModal.open} title={catModal.editing ? "Editar categoría" : "Nueva categoría"} onClose={catModal.close}>
        <EntityForm schema={FIELD_SCHEMAS.categories} initial={catModal.editing} onSubmit={saveCat} onCancel={catModal.close} />
      </Modal>
    </div>
  );
}

/* ============================================================================
 *  AUTENTICACIÓN
 * ==========================================================================*/
function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setMsg("");
    // Llamar los métodos directamente sobre supabase.auth: si se extraen a una
    // variable pierden el binding de `this` y fallan con
    // "Cannot read properties of undefined (reading 'fetch')".
    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    else if (mode === "signup") setMsg("Revisá tu email para confirmar la cuenta.");
    setBusy(false);
  };

  return (
    <div className="gp-auth">
      <Card className="gp-auth-card">
        <h1 className="gp-auth-logo">Gestor Personal</h1>
        <p className="gp-muted">{mode === "login" ? "Ingresá a tu cuenta" : "Creá una cuenta nueva"}</p>
        <div className="gp-field"><label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="gp-field"><label>Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {msg && <p className="gp-auth-msg">{msg}</p>}
        <Button onClick={submit}>{busy ? "..." : mode === "login" ? "Ingresar" : "Registrarme"}</Button>
        <button className="gp-link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Ingresá"}
        </button>
      </Card>
    </div>
  );
}

/* Pantalla si faltan variables de entorno de Supabase. */
function ConfigScreen() {
  return (
    <div className="gp-auth">
      <Card className="gp-auth-card">
        <h1 className="gp-auth-logo">Configuración pendiente</h1>
        <p className="gp-muted">Definí estas variables de entorno y reiniciá:</p>
        <pre className="gp-pre">NEXT_PUBLIC_SUPABASE_URL{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY</pre>
      </Card>
    </div>
  );
}

/* ============================================================================
 *  APP PRINCIPAL — layout, navegación, tema y sesión
 * ==========================================================================*/
export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("home");
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [paletteKey, setPaletteKey] = useState("pro_claro");
  const [dark, setDark] = useState(false);

  // Sesión Supabase
  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  const reloadProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    setProfile(data);
  }, [userId]);
  const reloadSettings = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
    setSettings(data);
    if (data?.palette && PALETTES[data.palette]) setPaletteKey(data.palette);
    if (typeof data?.dark === "boolean") setDark(data.dark);
  }, [userId]);

  useEffect(() => { if (userId) { reloadProfile(); reloadSettings(); } }, [userId, reloadProfile, reloadSettings]);

  // Variables CSS según paleta + modo oscuro
  const themeVars = useMemo(() => resolveThemeVars(paletteKey, dark), [paletteKey, dark]);

  if (!ready) return <div className="gp-loading">Cargando…</div>;
  if (!supabase) return <><GlobalStyles /><ConfigScreen /></>;
  if (!session) return <><GlobalStyles /><div style={themeVars}><AuthScreen /></div></>;

  const logout = async () => { await supabase.auth.signOut(); setView("home"); };
  const currency = settings?.currency || "ARS";

  const renderView = () => {
    switch (view) {
      case "objetivos": return <ObjetivosModule userId={userId} />;
      case "economia": return <EconomiaModule userId={userId} currency={currency} />;
      case "habitos": return <HabitosModule userId={userId} profile={profile} />;
      case "tenis": return <TenisModule userId={userId} />;
      case "diario": return <DiarioModule userId={userId} />;
      case "config": return (
        <ConfiguracionModule userId={userId} profile={profile} reloadProfile={reloadProfile}
          settings={settings} reloadSettings={reloadSettings} onLogout={logout} />
      );
      default: return <Home onOpen={setView} />;
    }
  };

  const current = MODULES.find((m) => m.id === view);

  return (
    <ThemeContext.Provider value={{ paletteKey, setPaletteKey, dark, setDark }}>
      <GlobalStyles />
      <div className="gp-app" style={themeVars}>
        {/* Sidebar (desktop) */}
        <aside className="gp-sidebar">
          <div className="gp-logo" onClick={() => setView("home")}>Gestor</div>
          <nav>
            <button className={`gp-nav-item ${view === "home" ? "active" : ""}`} onClick={() => setView("home")}>
              <span className="gp-nav-ico">▦</span> Inicio
            </button>
            {MODULES.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.id} className={`gp-nav-item ${view === m.id ? "active" : ""}`} onClick={() => setView(m.id)}>
                  <Icon size={18} /> {m.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Contenido */}
        <main className="gp-main">
          <header className="gp-topbar">
            <div className="gp-topbar-title">
              {view !== "home" && (
                <button className="gp-icon-btn" onClick={() => setView("home")}><ChevronLeft size={20} /></button>
              )}
              {current ? current.label : "Inicio"}
            </div>
            <div className="gp-topbar-user">{session.user.email}</div>
          </header>
          <div className="gp-content">{renderView()}</div>
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="gp-bottomnav">
          {[{ id: "home", label: "Inicio", icon: () => <span style={{ fontSize: 18 }}>▦</span> }, ...MODULES.slice(0, 5)]
            .map((m) => {
              const Icon = m.icon;
              const active = view === m.id;
              return (
                <button key={m.id} className={`gp-bn-item ${active ? "active" : ""}`} onClick={() => setView(m.id)}>
                  <Icon size={20} />
                  <span>{m.label.split(" ")[0]}</span>
                </button>
              );
            })}
        </nav>
      </div>
    </ThemeContext.Provider>
  );
}

/* Pantalla principal: módulos como tarjetas grandes tipo Odoo. */
function Home({ onOpen }) {
  return (
    <div>
      <div className="gp-modules-grid">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.id} className="gp-module-card" onClick={() => onOpen(m.id)}>
              <div className="gp-module-icon" style={{ background: m.color }}><Icon size={26} color="#fff" /></div>
              <h3>{m.label}</h3>
              <p className="gp-muted">{m.desc}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
 *  ESTILOS GLOBALES (CSS-in-JS, usa variables de tema + media queries)
 * ==========================================================================*/
function GlobalStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap');
* { box-sizing: border-box; }
body { margin: 0; }
.gp-app, .gp-auth { font-family: 'Inter', system-ui, sans-serif; color: var(--text); background: var(--bg); }
.gp-loading { display:flex; align-items:center; justify-content:center; height:100vh; font-family:'Inter',sans-serif; }
h1,h2,h3,h4 { font-family:'Sora','Inter',sans-serif; margin: 0; }
.gp-muted { color: var(--muted); font-size: 13px; }

/* Layout */
.gp-app { display:flex; min-height:100vh; }
.gp-sidebar { display:none; width:230px; background:var(--surface); border-right:1px solid var(--border); padding:18px 12px; position:sticky; top:0; height:100vh; }
.gp-logo { font-family:'Sora'; font-weight:700; font-size:20px; padding:8px 12px 18px; cursor:pointer; color:var(--primary); }
.gp-nav-item { display:flex; align-items:center; gap:10px; width:100%; border:none; background:none; color:var(--text); padding:11px 12px; border-radius:10px; font-size:14px; cursor:pointer; text-align:left; }
.gp-nav-item:hover { background:var(--surface-2); }
.gp-nav-item.active { background:var(--primary); color:#fff; }
.gp-nav-ico { width:18px; text-align:center; }
.gp-main { flex:1; display:flex; flex-direction:column; min-width:0; padding-bottom:72px; }
.gp-topbar { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid var(--border); background:var(--surface); position:sticky; top:0; z-index:5; }
.gp-topbar-title { display:flex; align-items:center; gap:6px; font-family:'Sora'; font-weight:700; font-size:18px; }
.gp-topbar-user { font-size:12px; color:var(--muted); }
.gp-content { padding:18px; max-width:1100px; width:100%; margin:0 auto; }

/* Cards */
.gp-card { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px; margin-bottom:14px; }
.gp-center { display:flex; align-items:center; justify-content:center; }

/* Home modules */
.gp-modules-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
.gp-module-card { cursor:pointer; transition:transform .12s, box-shadow .12s; display:flex; flex-direction:column; gap:8px; }
.gp-module-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.08); }
.gp-module-icon { width:52px; height:52px; border-radius:14px; display:flex; align-items:center; justify-content:center; }
.gp-module-card h3 { font-size:16px; }

/* Buttons */
.gp-btn { display:inline-flex; align-items:center; gap:6px; border:none; border-radius:10px; cursor:pointer; font-weight:600; font-family:inherit; }
.gp-btn-md { padding:10px 16px; font-size:14px; }
.gp-btn-sm { padding:7px 12px; font-size:13px; }
.gp-btn-primary { background:var(--primary); color:#fff; }
.gp-btn-ghost { background:var(--surface-2); color:var(--text); }
.gp-btn-danger { background:var(--danger); color:#fff; }
.gp-icon-btn { background:none; border:none; color:var(--muted); cursor:pointer; padding:5px; border-radius:8px; display:inline-flex; }
.gp-icon-btn:hover { background:var(--surface-2); color:var(--text); }
.gp-icon-btn.danger:hover { color:var(--danger); }

/* Section / stats */
.gp-section-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
.gp-section-head h2 { font-size:20px; }
.gp-section-head-right { display:flex; align-items:center; gap:8px; }
.gp-subtitle { font-size:15px; margin:18px 0 10px; color:var(--muted); }
.gp-grid { display:grid; gap:12px; margin-bottom:6px; }
.gp-grid-2 { grid-template-columns:repeat(2,1fr); }
.gp-grid-3 { grid-template-columns:repeat(3,1fr); }
.gp-stat { display:flex; flex-direction:column; gap:3px; }
.gp-stat-label { font-size:12px; color:var(--muted); }
.gp-stat-value { font-size:22px; font-weight:700; font-family:'Sora'; }
.gp-stat-sub { font-size:11px; color:var(--muted); }

/* Tabs */
.gp-tabs { display:flex; gap:6px; margin-bottom:16px; overflow-x:auto; }
.gp-tab { border:none; background:var(--surface-2); color:var(--text); padding:8px 14px; border-radius:20px; font-size:13px; cursor:pointer; white-space:nowrap; font-family:inherit; }
.gp-tab.active { background:var(--primary); color:#fff; }

/* Tables */
.gp-table-wrap { overflow-x:auto; background:var(--surface); border:1px solid var(--border); border-radius:14px; }
.gp-table { width:100%; border-collapse:collapse; font-size:13px; }
.gp-table th { text-align:left; padding:10px 12px; color:var(--muted); font-weight:600; border-bottom:1px solid var(--border); white-space:nowrap; }
.gp-table td { padding:10px 12px; border-bottom:1px solid var(--border); }
.gp-table tr:last-child td { border-bottom:none; }
.gp-row-actions { display:flex; gap:2px; justify-content:flex-end; }
.gp-empty-box { padding:24px; text-align:center; color:var(--muted); background:var(--surface); border:1px dashed var(--border); border-radius:14px; font-size:14px; }
.gp-empty { color:var(--muted); font-size:13px; margin:auto; }

/* Forms / modal */
.gp-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:flex-end; justify-content:center; z-index:50; }
.gp-modal { background:var(--surface); border-radius:18px 18px 0 0; width:100%; max-width:560px; max-height:90vh; overflow-y:auto; }
.gp-modal-head { display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid var(--border); position:sticky; top:0; background:var(--surface); }
.gp-modal-head h3 { font-size:17px; }
.gp-modal-body { padding:18px; }
.gp-form { display:flex; flex-direction:column; gap:12px; }
.gp-field { display:flex; flex-direction:column; gap:5px; }
.gp-field label { font-size:13px; font-weight:600; color:var(--muted); }
.gp-req { color:var(--danger); margin-left:3px; }
.gp-field input, .gp-field select, .gp-field textarea { padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:var(--bg); color:var(--text); font-size:14px; font-family:inherit; width:100%; }
.gp-field textarea { resize:vertical; }
.gp-range { display:flex; align-items:center; gap:10px; }
.gp-range input { flex:1; }
.gp-range-val { font-weight:700; min-width:24px; text-align:center; }
.gp-form-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:6px; }
.gp-hint { font-size:12px; color:var(--muted); display:flex; align-items:center; gap:5px; margin-top:10px; }

/* Goals */
.gp-goal-card { display:flex; align-items:center; gap:14px; justify-content:space-between; }
.gp-goal-info { flex:1; min-width:0; }
.gp-goal-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.gp-goal-top h4 { font-size:15px; }
.gp-goal-meta { display:flex; gap:14px; font-size:13px; margin:6px 0; }
.gp-goal-actions { display:flex; align-items:center; gap:4px; }
.gp-tag { font-size:11px; padding:3px 9px; border-radius:20px; font-weight:600; }
.gp-tag.ok { background:color-mix(in srgb, var(--success) 18%, transparent); color:var(--success); }
.gp-tag.warn { background:color-mix(in srgb, var(--warning) 22%, transparent); color:var(--warning); }
.gp-tag.bad { background:color-mix(in srgb, var(--danger) 16%, transparent); color:var(--danger); }

/* Charts */
.gp-bars { display:flex; align-items:flex-end; gap:8px; padding-top:10px; }
.gp-bar-col { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:6px; }
.gp-bar-fill { width:100%; max-width:42px; border-radius:6px 6px 0 0; min-height:2px; }
.gp-bar-label { font-size:10px; color:var(--muted); }
.gp-bar-value { font-size:12px; font-weight:700; color:var(--text); }
.gp-chart-title { font-size:14px; margin-bottom:10px; }
.gp-line { display:block; }
.gp-legend { display:flex; gap:14px; font-size:12px; color:var(--muted); margin-top:8px; }
.gp-legend span { display:flex; align-items:center; gap:5px; }
.gp-legend i { width:10px; height:10px; border-radius:3px; display:inline-block; }

/* Econ */
.gp-pending-list, .gp-pending-item { display:flex; }
.gp-pending-list { flex-direction:column; gap:10px; }
.gp-pending-item { align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.gp-pending-actions { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.gp-pending-actions select { padding:7px; border:1px solid var(--border); border-radius:8px; background:var(--bg); color:var(--text); }

/* Habitos */
.gp-daycard { display:flex; flex-direction:column; gap:6px; }
.gp-daycard-head { display:flex; align-items:center; gap:6px; font-weight:600; font-size:14px; }
.gp-daycard-row { display:flex; justify-content:space-between; font-size:13px; }
.gp-daycard-saldo { display:flex; align-items:center; gap:6px; font-weight:700; font-size:14px; margin-top:4px; }
.gp-cal-cell { display:flex; align-items:center; gap:6px; }
.gp-ai-mini { display:inline-flex; align-items:center; gap:3px; font-size:11px; border:1px solid var(--accent); color:var(--accent); background:none; border-radius:14px; padding:2px 7px; cursor:pointer; }
.gp-ai-action { display:inline-flex; align-items:center; justify-content:center; gap:6px; width:100%; border:1px solid var(--accent); color:var(--accent); background:none; border-radius:10px; padding:10px; cursor:pointer; font-size:14px; font-weight:600; font-family:inherit; }
.gp-ai-action:hover { background:color-mix(in srgb, var(--accent) 10%, transparent); }
.gp-ai-action:disabled { opacity:.6; cursor:default; }
.gp-image-field { display:flex; flex-direction:column; gap:8px; }
.gp-image-field input[type=file] { font-size:13px; }
.gp-image-preview { display:flex; align-items:flex-start; gap:8px; }
.gp-image-preview img { max-width:160px; max-height:160px; border-radius:10px; border:1px solid var(--border); }
.gp-thumb { width:34px; height:34px; object-fit:cover; border-radius:8px; border:1px solid var(--border); display:block; }
.gp-ai-box { border:1px solid var(--accent); }
.gp-ai-head { display:flex; align-items:center; gap:7px; font-weight:700; color:var(--accent); margin-bottom:8px; }
.gp-book { display:flex; align-items:center; gap:12px; }
.gp-book-info { flex:1; }
.gp-progress { height:7px; background:var(--surface-2); border-radius:10px; margin:6px 0 4px; overflow:hidden; }
.gp-progress-bar { height:100%; background:var(--success); border-radius:10px; }
.gp-budget { margin-bottom:14px; }
.gp-budget:last-child { margin-bottom:0; }
.gp-budget-top { display:flex; justify-content:space-between; align-items:center; font-size:13px; gap:8px; }

/* Diario */
.gp-journal { display:flex; flex-direction:column; gap:8px; }
.gp-journal-head { display:flex; align-items:center; justify-content:space-between; font-size:13px; color:var(--muted); }
.gp-journal-head span { display:flex; align-items:center; gap:5px; }
.gp-journal-scores { display:flex; gap:14px; font-size:15px; font-weight:600; }
.gp-journal-note { font-size:13px; margin:0; }
.gp-journal-line { font-size:12px; color:var(--muted); margin:0; }

/* Config */
.gp-config-block { }
.gp-palette-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:12px; }
.gp-palette { display:flex; flex-direction:column; gap:8px; align-items:flex-start; border:2px solid var(--border); background:var(--bg); border-radius:12px; padding:12px; cursor:pointer; font-size:13px; color:var(--text); font-family:inherit; }
.gp-palette.active { border-color:var(--primary); }
.gp-palette-dots { display:flex; gap:5px; }
.gp-palette-dots i { width:18px; height:18px; border-radius:6px; display:inline-block; }
.gp-color-dot { width:16px; height:16px; border-radius:5px; display:inline-block; }

/* Auth */
.gp-auth { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:18px; background:var(--bg); }
.gp-auth-card { width:100%; max-width:380px; display:flex; flex-direction:column; gap:12px; }
.gp-auth-logo { font-size:24px; color:var(--primary); }
.gp-auth-msg { font-size:13px; color:var(--danger); }
.gp-link { background:none; border:none; color:var(--primary); cursor:pointer; font-size:13px; text-decoration:underline; }
.gp-pre { background:var(--surface-2); padding:12px; border-radius:10px; font-size:13px; overflow-x:auto; }

/* Bottom nav (mobile) */
.gp-bottomnav { position:fixed; bottom:0; left:0; right:0; display:flex; background:var(--surface); border-top:1px solid var(--border); z-index:20; }
.gp-bn-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; padding:8px 2px; background:none; border:none; color:var(--muted); font-size:10px; cursor:pointer; font-family:inherit; }
.gp-bn-item.active { color:var(--primary); }

/* Responsive: desktop */
@media (min-width:768px) {
  .gp-sidebar { display:block; }
  .gp-bottomnav { display:none; }
  .gp-main { padding-bottom:0; }
  .gp-modules-grid { grid-template-columns:repeat(3,1fr); }
  .gp-modal { border-radius:18px; align-self:center; margin:auto; }
  .gp-modal-overlay { align-items:center; }
}
@media (max-width:520px) {
  .gp-grid-3 { grid-template-columns:repeat(2,1fr); }
}
    `}</style>
  );
}
