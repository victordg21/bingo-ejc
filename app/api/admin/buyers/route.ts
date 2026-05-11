import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { generateAccessCode, nameToPrefix, parseCardCodes, randomCodeSuffix } from "@/lib/access-code";
import type { Tier } from "@/lib/supabase/types";

export const runtime = "nodejs";

const VALID_TIERS: Tier[] = ["basico", "live", "premium"];

export async function GET() {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("buyers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ buyers: data ?? [] });
}

export async function POST(req: Request) {
  let name = "";
  let codesInput = "";
  let tier: Tier = "live";
  try {
    const body = await req.json();
    name = String(body?.name ?? "").trim();
    codesInput = String(body?.codes ?? "");
    if (typeof body?.tier === "string" && VALID_TIERS.includes(body.tier as Tier)) {
      tier = body.tier as Tier;
    }
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (name.length < 2) {
    return NextResponse.json({ error: "Informe o nome do comprador" }, { status: 400 });
  }

  const { codes, errors } = parseCardCodes(codesInput, 1000);
  if (codes.length === 0) {
    return NextResponse.json(
      { error: errors[0] || "Informe pelo menos um código de cartela" },
      { status: 400 },
    );
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  const sb = getServiceSupabase();

  // Retry on access_code collision (extremely rare with 32-char alphabet)
  const prefix = nameToPrefix(name);
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const access_code =
      attempt === 0 ? generateAccessCode(name) : `${prefix}-${randomCodeSuffix(4)}`;
    const { data, error } = await sb
      .from("buyers")
      .insert({ name, access_code, card_codes: codes, tier })
      .select("*")
      .single();
    if (!error && data) {
      return NextResponse.json({ buyer: data });
    }
    lastErr = error?.message ?? "Erro desconhecido";
    if (!/duplicate key|unique/i.test(lastErr)) break;
  }
  return NextResponse.json({ error: lastErr ?? "Falha ao cadastrar" }, { status: 500 });
}
