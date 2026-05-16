"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import type { Buyer } from "@/lib/supabase/types";
import { formatCardCode } from "@/lib/access-code";

type Props = {
  buyer: Buyer;
  joinUrl: string; // includes ?code=...
  compact?: boolean;
};

export default function QrCard({ buyer, joinUrl, compact }: Props) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const copy = async (kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(kind === "code" ? buyer.access_code : joinUrl);
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=480,height=720");
    if (!w) return;
    const cardList = buyer.card_codes.map(formatCardCode).join(", ");
    w.document.write(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${buyer.name} — Bingo do São João</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:32px;text-align:center;color:#0f172a}
  h1{font-size:24px;margin:0 0 4px}
  .logo{width:64px;height:64px;margin:0 auto 8px;display:block}
  .code{font-size:48px;font-weight:900;letter-spacing:2px;margin:16px 0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
  .qr{display:flex;justify-content:center;margin:16px 0}
  .cards{font-size:13px;color:#334155;margin-top:24px}
  .url{font-size:12px;color:#64748b;margin-top:8px;word-break:break-all}
  @media print { body{padding:8px} }
</style></head><body>
  <img src="/neves-logo.png" alt="Movimento Neves" class="logo">
  <h1>${buyer.name}</h1>
  <div>Bingo do São João — código de acesso</div>
  <div class="code">${buyer.access_code}</div>
  <div class="qr">${document.getElementById(`qr-${buyer.id}`)?.outerHTML ?? ""}</div>
  <div class="cards"><b>${buyer.card_codes.length}</b> ${buyer.card_codes.length === 1 ? "cartela" : "cartelas"}: ${cardList}</div>
  <div class="url">${joinUrl}</div>
  <script>window.onload=()=>{window.print();}</script>
</body></html>`);
    w.document.close();
  };

  return (
    <div
      className={`rounded-xl border-2 border-emerald-500 bg-emerald-50/50 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="bg-white p-2 rounded-lg border border-slate-200">
          <QRCodeSVG
            id={`qr-${buyer.id}`}
            value={joinUrl}
            size={compact ? 96 : 144}
            level="M"
            includeMargin={false}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">
            Comprador cadastrado
          </div>
          <div className="text-lg font-bold text-slate-900 truncate">{buyer.name}</div>
          <div className="mt-1 font-mono text-2xl font-black tracking-wider text-slate-900">
            {buyer.access_code}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            {buyer.card_codes.length}{" "}
            {buyer.card_codes.length === 1 ? "cartela" : "cartelas"}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => copy("code")}
          className="px-3 py-1.5 text-xs rounded-md bg-white border border-slate-300 hover:bg-slate-50 font-medium"
        >
          {copied === "code" ? "Copiado!" : "Copiar código"}
        </button>
        <button
          onClick={() => copy("link")}
          className="px-3 py-1.5 text-xs rounded-md bg-white border border-slate-300 hover:bg-slate-50 font-medium"
        >
          {copied === "link" ? "Copiado!" : "Copiar link"}
        </button>
        <button
          onClick={handlePrint}
          className="px-3 py-1.5 text-xs rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium"
        >
          Imprimir / Compartilhar
        </button>
      </div>
    </div>
  );
}
