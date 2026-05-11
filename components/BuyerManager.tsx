"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { Buyer } from "@/lib/supabase/types";
import { formatCardCode, parseCardCodes } from "@/lib/access-code";
import QrCard from "./QrCard";

type Props = {
  joinBaseUrl: string; // e.g. "https://bingo-ejc.vercel.app/jogar"
};

export default function BuyerManager({ joinBaseUrl }: Props) {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState("");
  const [codesInput, setCodesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<Buyer | null>(null);

  const [search, setSearch] = useState("");
  const [openQrFor, setOpenQrFor] = useState<string | null>(null);

  const reload = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/buyers", { cache: "no-store" });
      const j = await res.json();
      if (res.ok) setBuyers(j.buyers ?? []);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  // Live preview of parsed codes for confidence
  const preview = useMemo(() => parseCardCodes(codesInput, 1000), [codesInput]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Informe o nome do comprador");
      return;
    }
    if (preview.codes.length === 0) {
      setError("Informe pelo menos uma cartela válida");
      return;
    }
    if (preview.errors.length) {
      setError(preview.errors.join("; "));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/buyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), codes: codesInput }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Erro ao cadastrar");
        return;
      }
      setLastCreated(j.buyer);
      setName("");
      setCodesInput("");
      reload();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir este comprador? Ele perderá o acesso.")) return;
    const res = await fetch(`/api/admin/buyers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBuyers((bs) => bs.filter((b) => b.id !== id));
      if (lastCreated?.id === id) setLastCreated(null);
      if (openQrFor === id) setOpenQrFor(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) || b.access_code.toLowerCase().includes(q),
    );
  }, [buyers, search]);

  const joinUrlFor = (code: string) =>
    `${joinBaseUrl}${joinBaseUrl.includes("?") ? "&" : "?"}code=${encodeURIComponent(code)}`;

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider">Compradores</h2>
        <span className="text-xs text-slate-300">
          {buyers.length} cadastrados
        </span>
      </div>

      <div className="p-5 grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={submit} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Cadastrar novo</h3>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Nome</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João Silva"
              className="mt-1 w-full px-3 py-2 rounded-md border-2 border-slate-300 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">
              Cartelas (vírgula, espaço ou range 100-105)
            </span>
            <textarea
              value={codesInput}
              onChange={(e) => setCodesInput(e.target.value)}
              placeholder="428, 731, 902 ou 100-105"
              rows={3}
              className="mt-1 w-full px-3 py-2 rounded-md border-2 border-slate-300 focus:border-indigo-500 focus:outline-none font-mono text-sm"
            />
          </label>
          {(preview.codes.length > 0 || preview.errors.length > 0) && (
            <div className="text-xs text-slate-600 -mt-1">
              {preview.codes.length > 0 && (
                <span>
                  <b>{preview.codes.length}</b> cartela
                  {preview.codes.length === 1 ? "" : "s"}:{" "}
                  <span className="font-mono">
                    {preview.codes
                      .slice(0, 8)
                      .map(formatCardCode)
                      .join(", ")}
                    {preview.codes.length > 8 ? `, …+${preview.codes.length - 8}` : ""}
                  </span>
                </span>
              )}
              {preview.errors.length > 0 && (
                <span className="text-red-600">
                  {preview.codes.length > 0 ? " · " : ""}
                  {preview.errors.join("; ")}
                </span>
              )}
            </div>
          )}
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || preview.codes.length === 0 || name.trim().length < 2}
            className="w-full px-4 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold"
          >
            {submitting ? "Cadastrando…" : "Cadastrar e gerar código"}
          </button>
        </form>

        {/* Last created highlight */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Último gerado</h3>
          {lastCreated ? (
            <QrCard buyer={lastCreated} joinUrl={joinUrlFor(lastCreated.access_code)} />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
              Cadastre um comprador para gerar o QR aqui.
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="border-t border-slate-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome ou código"
            className="flex-1 px-3 py-2 text-sm rounded-md border border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={reload}
            disabled={refreshing}
            className="text-xs px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing ? "…" : "Recarregar"}
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400 text-center py-6">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">
            {search ? "Nenhum resultado" : "Nenhum comprador cadastrado ainda"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr className="text-left">
                  <th className="px-2 py-2">Nome</th>
                  <th className="px-2 py-2">Código</th>
                  <th className="px-2 py-2">Cartelas</th>
                  <th className="px-2 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => (
                  <Fragment key={b.id}>
                    <tr>
                      <td className="px-2 py-2 font-medium">{b.name}</td>
                      <td className="px-2 py-2 font-mono">{b.access_code}</td>
                      <td className="px-2 py-2 text-xs text-slate-600">
                        {b.card_codes.length} (
                        {b.card_codes.slice(0, 3).map(formatCardCode).join(", ")}
                        {b.card_codes.length > 3 ? "…" : ""})
                      </td>
                      <td className="px-2 py-2 text-right space-x-2">
                        <button
                          onClick={() =>
                            setOpenQrFor((id) => (id === b.id ? null : b.id))
                          }
                          className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                        >
                          {openQrFor === b.id ? "Fechar" : "Ver QR"}
                        </button>
                        <button
                          onClick={() => remove(b.id)}
                          className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                    {openQrFor === b.id && (
                      <tr>
                        <td colSpan={4} className="px-2 pb-3">
                          <QrCard buyer={b} joinUrl={joinUrlFor(b.access_code)} compact />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
