import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const sb = getServiceSupabase();
  const { data: current, error: readErr } = await sb
    .from("game_state")
    .select("called_numbers")
    .eq("id", 1)
    .single();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const arr = current?.called_numbers ?? [];
  if (arr.length === 0) {
    return NextResponse.json({ ok: true, called_numbers: [], last_called: null });
  }
  const next = arr.slice(0, -1);
  const last = next.length ? next[next.length - 1] : null;
  const { error: writeErr } = await sb
    .from("game_state")
    .update({ called_numbers: next, last_called: last, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, called_numbers: next, last_called: last });
}
