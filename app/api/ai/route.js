/* ============================================================================
 *  API ROUTE DE IA  —  app/api/ai/route.js   (Next.js App Router, lado servidor)
 *
 *  Recibe { task, payload } por POST y responde JSON.
 *  La API key vive SOLO en el servidor (variable de entorno sin NEXT_PUBLIC_),
 *  así nunca se expone en el navegador.
 *
 *  Si no hay key configurada o la llamada falla, responde { ok: false } con
 *  status 200, y el cliente usa su heurística local automáticamente.
 *
 *  Variables de entorno (configurar en .env.local y en Vercel):
 *    ANTHROPIC_API_KEY   → clave de Anthropic (https://console.anthropic.com)
 *    AI_MODEL            → opcional, por defecto "claude-haiku-4-5-20251001"
 *
 *  Para usar OpenAI en lugar de Anthropic, reemplazá callLLM() por una llamada
 *  a https://api.openai.com/v1/chat/completions con tu OPENAI_API_KEY.
 * ==========================================================================*/

import { NextResponse } from "next/server";

export const runtime = "nodejs"; // asegura entorno server (no edge)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Modelo por defecto. Para estas tareas (estimaciones cortas) conviene un
// modelo económico como Haiku. Verificá el string vigente en la consola/docs,
// porque los nombres cambian con cada generación.
const AI_MODEL = process.env.AI_MODEL || "claude-haiku-4-5-20251001";

// Llama al modelo de Anthropic y devuelve el texto plano de la respuesta.
async function callLLM(system, user, maxTokens = 400) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error("Upstream AI error " + res.status);
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

const firstInt = (txt) => parseInt((String(txt).match(/\d+/) || ["0"])[0], 10);

export async function POST(req) {
  // Sin key → el cliente cae a su heurística local.
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, reason: "no_api_key" });
  }

  try {
    const { task, payload = {} } = await req.json();

    switch (task) {
      // ---- Calorías de una comida (devuelve número) --------------------
      case "meal_calories": {
        const txt = await callLLM(
          "Sos un nutricionista. Respondé ÚNICAMENTE un número entero con las calorías totales estimadas. Sin texto, sin unidades.",
          `Estimá las calorías de esta comida: "${payload.description || ""}".`,
          20
        );
        return NextResponse.json({ ok: true, value: firstInt(txt) });
      }

      // ---- Calorías de una actividad física (devuelve número) ----------
      case "activity_calories": {
        const txt = await callLLM(
          "Sos un entrenador. Respondé ÚNICAMENTE un número entero con las calorías quemadas estimadas. Sin texto.",
          `Actividad: ${payload.activity_type}. Duración: ${payload.duration_min} min. ` +
            `Intensidad: ${payload.intensity}. Pasos: ${payload.steps || 0}. Persona de referencia: 70 kg.`,
          20
        );
        return NextResponse.json({ ok: true, value: firstInt(txt) });
      }

      // ---- Opinión del plan de peso (devuelve texto) -------------------
      case "weight_opinion": {
        const txt = await callLLM(
          "Sos un asistente de salud prudente. Das orientación general, breve y empática (máximo 4 oraciones). " +
            "SIEMPRE aclarás que no reemplaza asesoramiento médico ni nutricional.",
          `Peso actual: ${payload.current} kg. Objetivo: ${payload.target} kg. ` +
            `Plazo: ${payload.deadline || "no definido"}. Mediciones registradas: ${payload.count}. ` +
            `Comentá si el ritmo es razonable y qué tener en cuenta.`,
          400
        );
        return NextResponse.json({ ok: true, text: txt });
      }

      // ---- Correlaciones de bienestar del Diario (devuelve texto) ------
      case "wellbeing_insights": {
        const txt = await callLLM(
          "Sos un coach de bienestar. Analizás registros de ánimo, energía y estrés y sugerís patrones y " +
            "recomendaciones concretas y breves (máximo 5 oraciones). No diagnosticás.",
          `Entradas del diario (ánimo/energía/estrés 1-10): ${JSON.stringify(payload.journal)}. ` +
            `Registros de actividad física: ${payload.activityCount}. Registros de comidas: ${payload.mealCount}. ` +
            `Relacioná el estado de ánimo con la actividad y la alimentación cuando sea posible.`,
          500
        );
        return NextResponse.json({ ok: true, text: txt });
      }

      default:
        return NextResponse.json({ ok: false, reason: "unknown_task" });
    }
  } catch (e) {
    // Cualquier error → el cliente usa su heurística local.
    return NextResponse.json({ ok: false, error: String(e?.message || e) });
  }
}
