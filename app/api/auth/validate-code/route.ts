import { NextResponse } from "next/server";
import { getServerAnonSupabase } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`code:${ip}`, { windowMs: 60_000, max: 10 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um momento." },
      { status: 429 },
    );
  }

  let code = "";
  try {
    const body = await req.json();
    code = String(body?.code ?? "").trim().toUpperCase();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (!/^[A-Z]{1,4}-[A-Z0-9]{4}$/i.test(code)) {
    return NextResponse.json({ error: "Formato de código inválido" }, { status: 400 });
  }

  const sb = getServerAnonSupabase();
  const { data, error } = await sb
    .from("buyers")
    .select("id, name, access_code, card_codes, tier")
    .eq("access_code", code)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Código não encontrado" }, { status: 404 });

  return NextResponse.json({ buyer: data });
}
