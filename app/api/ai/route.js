/* ============================================================================
 *  CRON DE RECORDATORIOS  —  app/api/cron/reminders/route.js
 *
 *  Se ejecuta una vez por día (configurado en vercel.json). Busca recordatorios
 *  pendientes que vencen dentro de los próximos 5 días y todavía no fueron
 *  avisados, y manda un WhatsApp al número del usuario. Luego marca notified=true
 *  para no repetir.
 *
 *  Variables de entorno necesarias (TODAS del lado servidor, sin NEXT_PUBLIC_):
 *    SUPABASE_SERVICE_ROLE_KEY   → clave service_role de Supabase (Project
 *                                  Settings → API). Permite leer todos los
 *                                  recordatorios saltando RLS. NUNCA exponerla.
 *    CRON_SECRET                 → (opcional) protege este endpoint. Si está,
 *                                  Vercel Cron lo manda como Bearer token.
 *
 *  Para enviar el WhatsApp, configurá UNA de estas dos opciones:
 *    A) Twilio (recomendado):
 *       TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *       TWILIO_WHATSAPP_FROM   → ej "whatsapp:+14155238886"
 *    B) CallMeBot (gratis, ideal para uso personal):
 *       CALLMEBOT_APIKEY       → la apikey que te da CallMeBot al activar tu número
 * ==========================================================================*/

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// Envía un WhatsApp usando Twilio o, si no está, CallMeBot.
async function sendWhatsApp(phone, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (sid && token && from) {
    const params = new URLSearchParams({ To: `whatsapp:${phone}`, From: from, Body: body });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    return res.ok;
  }
  const cbKey = process.env.CALLMEBOT_APIKEY;
  if (cbKey) {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}` +
      `&text=${encodeURIComponent(body)}&apikey=${cbKey}`;
    const res = await fetch(url);
    return res.ok;
  }
  return false; // sin proveedor configurado
}

export async function GET(req) {
  // Seguridad opcional: si definiste CRON_SECRET, Vercel Cron lo envía como Bearer.
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  }
  if (!SERVICE_KEY) {
    return Response.json({ ok: false, reason: "falta SUPABASE_SERVICE_ROLE_KEY" });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const in5ISO = new Date(now.getTime() + 5 * 86400000).toISOString().slice(0, 10);

  // Recordatorios pendientes, no avisados, que vencen dentro de los próximos 5 días.
  const { data: reminders, error } = await db
    .from("reminders")
    .select("*")
    .eq("status", "pendiente")
    .eq("notified", false)
    .gte("due_date", todayISO)
    .lte("due_date", in5ISO);

  if (error) return Response.json({ ok: false, error: error.message });

  let sent = 0, skipped = 0;
  for (const r of reminders || []) {
    // Buscar el WhatsApp del usuario dueño del recordatorio.
    const { data: st } = await db.from("settings").select("whatsapp_number").eq("user_id", r.user_id).maybeSingle();
    const phone = st?.whatsapp_number;
    if (!phone) { skipped++; continue; }

    const body = `⏰ Recordatorio: "${r.title}" vence el ${r.due_date}. ¡No te olvides!`;
    const ok = await sendWhatsApp(phone, body);
    if (ok) { await db.from("reminders").update({ notified: true }).eq("id", r.id); sent++; }
    else skipped++;
  }

  return Response.json({ ok: true, checked: reminders?.length || 0, sent, skipped });
}
