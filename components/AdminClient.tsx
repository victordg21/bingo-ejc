"use client";

import { useEffect, useMemo, useState } from "react";
import type { Card, RankedCard } from "@/lib/types";
import { getBrowserSupabase, supabaseConfigured } from "@/lib/supabase/browser";
import NumberCaller from "./NumberCaller";
import Ranking from "./Ranking";
import CardLookup from "./CardLookup";
import BuyerManager from "./BuyerManager";
import ResetGameModal from "./ResetGameModal";

const MIN_NUM = 1;
const MAX_NUM = 90;

type Props = {
  cards: Card[];
};

export default function AdminClient({ cards }: Props) {
  const [called, setCalled] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [joinBaseUrl, setJoinBaseUrl] = useState("/jogar");

  // Compute the absolute /jogar URL on the client so the QR codes work
  // whether we're on localhost or the Vercel deploy.
  useEffect(() => {
    if (typeof window !== "undefined") {
      setJoinBaseUrl(`${window.location.origin}/jogar`);
    }
  }, []);

  // Initial fetch + realtime subscription
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    let active = true;
    sb.from("game_state")
      .select("called_numbers")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (!active) return;
        setCalled(data?.called_numbers ?? []);
        setLoaded(true);
      });

    const channel = sb
      .channel("admin:game_state")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_state", filter: "id=eq.1" },
        (payload) => {
          const row = payload.new as { called_numbers?: number[] };
          if (row && Array.isArray(row.called_numbers)) {
            setCalled(row.called_numbers);
          }
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, []);

  const calledSet = useMemo(() => new Set(called), [called]);

  const ranked: RankedCard[] = useMemo(() => {
    const result: RankedCard[] = new Array(cards.length);
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const missing: number[] = [];
      for (let j = 0; j < c.numbers.length; j++) {
        const n = c.numbers[j];
        if (!calledSet.has(n)) missing.push(n);
      }
      result[i] = { code: c.code, numbers: c.numbers, remaining: missing.length, missing };
    }
    result.sort((a, b) =>
      a.remaining !== b.remaining ? a.remaining - b.remaining : a.code.localeCompare(b.code),
    );
    return result;
  }, [cards, calledSet]);

  const winners = useMemo(() => ranked.filter((r) => r.remaining === 0), [ranked]);

  // Optimistic mutations: we mutate local state immediately, then call the API.
  // The realtime subscription will reconcile on success (no-op since states match)
  // or correct us on failure.
  const callApi = async (path: string, body?: unknown) => {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("API error", path, j);
      }
    } catch (e) {
      console.error("Network error", path, e);
    }
  };

  const addNumber = (n: number) => {
    if (!Number.isInteger(n) || n < MIN_NUM || n > MAX_NUM || calledSet.has(n)) return;
    setCalled((prev) => (prev.includes(n) ? prev : [...prev, n]));
    callApi("/api/admin/game/call", { n });
  };

  const toggleNumber = (n: number) => {
    if (!Number.isInteger(n) || n < MIN_NUM || n > MAX_NUM) return;
    setCalled((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
    callApi("/api/admin/game/toggle", { n });
  };

  const undoLast = () => {
    setCalled((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)));
    callApi("/api/admin/game/undo");
  };

  const onResetRequest = () => setShowReset(true);
  const confirmReset = async () => {
    setCalled([]);
    setShowReset(false);
    await callApi("/api/admin/game/reset");
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  if (!supabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold text-red-700">Supabase não configurado</h1>
          <p className="text-sm text-slate-700">
            Defina <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no Vercel (ou em{" "}
            <code>.env.local</code> para desenvolvimento), depois recarregue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/neves-logo.png"
              alt="Movimento Neves"
              className="w-10 h-10 shrink-0"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Bingo do São João — Admin</h1>
              <p className="text-xs text-slate-500">
                {cards.length} cartelas · 15 números · 1–90
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              title={connected ? "Realtime conectado" : "Conectando…"}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                connected
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                }`}
              />
              {connected ? "AO VIVO" : "conectando"}
            </span>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700">
                Ganhadores
              </div>
              <div className="text-2xl font-bold text-emerald-700 leading-none">
                {winners.length}
              </div>
            </div>
            <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-600">
                Chamados
              </div>
              <div className="text-2xl font-bold text-slate-800 leading-none">
                {called.length} / 90
              </div>
            </div>
            <button
              onClick={logout}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <NumberCaller
            called={called}
            calledSet={calledSet}
            onAdd={addNumber}
            onToggle={toggleNumber}
            onUndo={undoLast}
            onResetRequest={onResetRequest}
            min={MIN_NUM}
            max={MAX_NUM}
          />
        </section>

        <section className="lg:col-span-4">
          <Ranking ranked={ranked} winners={winners} />
        </section>

        <section className="lg:col-span-3">
          <CardLookup cards={cards} calledSet={calledSet} />
        </section>

        <section className="lg:col-span-12">
          <BuyerManager joinBaseUrl={joinBaseUrl} />
        </section>
      </main>

      <footer className="mx-auto max-w-[1600px] px-4 pb-8 text-xs text-slate-400">
        {loaded
          ? "Estado sincronizado em tempo real via Supabase."
          : "Carregando estado do jogo…"}
      </footer>

      <ResetGameModal
        open={showReset}
        onConfirm={confirmReset}
        onCancel={() => setShowReset(false)}
      />
    </div>
  );
}
