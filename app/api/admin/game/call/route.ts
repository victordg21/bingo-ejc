import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let n = 0;
  try {
    const body = await req.json();
    n = Number(body?.n);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  if (!Number.isInteger(n) || n < 1 || n > 90) {
    return NextResponse.json({ error: "Número fora de 1–90" }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { data: current, error: readErr } = await sb
    .from("game_state")
    .select("called_numbers")
    .eq("id", 1)
    .single();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const arr = current?.called_numbers ?? [];
  if (arr.includes(n)) {
    return NextResponse.json({ ok: true, already: true, called_numbers: arr, last_called: arr[arr.length - 1] });
  }
  const next = [...arr, n];
  const { error: writeErr } = await sb
    .from("game_state")
    .update({ called_numbers: next, last_called: n, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, called_numbers: next, last_called: n });
}
