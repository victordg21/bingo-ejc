"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Card } from "@/lib/types";
import { getBrowserSupabase, supabaseConfigured } from "@/lib/supabase/browser";
import { playTick, unlockAudio } from "@/lib/sounds";

export default function TvClient({ cards }: { cards: Card[] }) {
  const [called, setCalled] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(true);
  const [pulse, setPulse] = useState(false);
  const [joinUrl, setJoinUrl] = useState("/jogar");
  const prevLastRef = useRef<number | null>(null);
  const newWinnersRef = useRef<Set<string>>(new Set());
  const [recentWinners, setRecentWinners] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setJoinUrl(`${window.location.origin}/jogar`);
    }
  }, []);

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
      });
    const channel = sb
      .channel("tv:game_state")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_state", filter: "id=eq.1" },
        (payload) => {
          const row = payload.new as { called_numbers?: number[] };
          if (row && Array.isArray(row.called_numbers)) setCalled(row.called_numbers);
        },
      )
      .subscribe((s) => setConnected(s === "SUBSCRIBED"));
    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, []);

  const calledSet = useMemo(() => new Set(called), [called]);

  const winners = useMemo(() => {
    const out: string[] = [];
    for (const c of cards) {
      let all = true;
      for (const n of c.numbers) {
        if (!calledSet.has(n)) {
          all = false;
          break;
        }
      }
      if (all) out.push(c.code);
    }
    return out;
  }, [cards, calledSet]);

  const lastCalled = called[called.length - 1] ?? null;
  useEffect(() => {
    if (lastCalled !== null && lastCalled !== prevLastRef.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 600);
      if (!muted) playTick();
      prevLastRef.current = lastCalled;
      return () => window.clearTimeout(t);
    }
    if (lastCalled === null) prevLastRef.current = null;
  }, [lastCalled, muted]);

  useEffect(() => {
    const newOnes: string[] = [];
    for (const code of winners) {
      if (!newWinnersRef.current.has(code)) {
        newWinnersRef.current.add(code);
        newOnes.push(code);
      }
    }
    if (newOnes.length > 0) {
      setRecentWinners((prev) => [...newOnes.reverse(), ...prev].slice(0, 5));
    }
    if (winners.length < newWinnersRef.current.size) {
      newWinnersRef.current = new Set(winners);
      setRecentWinners([]);
    }
  }, [winners]);

  const toggleMute = async () => {
    if (muted) await unlockAudio();
    setMuted((m) => !m);
  };

  const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);

  if (!supabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white text-center p-8">
        <div>
          <h1 className="text-3xl font-bold">Supabase não configurado</h1>
          <p className="opacity-70 mt-2 text-lg">
            Configure as variáveis de ambiente para usar o telão.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* ===== Header ===== */}
      <header className="px-4 sm:px-6 xl:px-8 pt-3 sm:pt-5 pb-2 flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-2xl xl:text-5xl font-black tracking-tight">
          🎉 BINGO DA FESTA
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleMute}
            className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/10 hover:bg-white/20"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <span
            className={`inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1 rounded-full ${
              connected
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-amber-500/20 text-amber-300"
            }`}
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
              }`}
            />
            {connected ? "AO VIVO" : "..."}
          </span>
        </div>
      </header>

      {/* ===== Mobile / portrait layout (default) ===== */}
      <main className="xl:hidden flex-1 px-4 pb-4 space-y-4">
        {/* Hero: last called */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 text-center">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">
            Último sorteado
          </div>
          <div
            className={`text-[10rem] sm:text-[12rem] leading-none font-black tabular-nums text-amber-400 transition-transform ${
              pulse ? "scale-110" : "scale-100"
            }`}
            style={{ transitionDuration: "300ms" }}
          >
            {lastCalled ?? "—"}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              Sorteados
            </div>
            <div className="text-4xl sm:text-5xl font-black tabular-nums mt-1">
              {called.length}
              <span className="text-xl text-slate-500">/90</span>
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              Vencedores
            </div>
            <div className="text-4xl sm:text-5xl font-black tabular-nums text-emerald-400 mt-1">
              {winners.length}
            </div>
          </div>
        </div>

        {/* 90 number grid */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">
            90 números
          </div>
          <div className="grid grid-cols-10 gap-1">
            {allNumbers.map((n) => {
              const hit = calledSet.has(n);
              const isLast = n === lastCalled;
              return (
                <div
                  key={n}
                  className={`aspect-square rounded flex items-center justify-center text-xs sm:text-sm font-black tabular-nums ${
                    isLast
                      ? "bg-amber-400 text-slate-900 ring-2 ring-amber-200"
                      : hit
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {n}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent winners */}
        {recentWinners.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-1">
              Últimas vitórias
            </div>
            <div className="flex flex-wrap gap-2">
              {recentWinners.map((code) => (
                <span
                  key={code}
                  className="px-2 py-1 rounded font-mono font-bold text-emerald-300 bg-emerald-900/40 text-sm"
                >
                  🏆 #{code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Join CTA */}
        <div className="rounded-xl bg-white text-slate-900 p-3 flex items-center gap-3">
          <QRCodeSVG value={joinUrl} size={64} level="M" includeMargin={false} />
          <div className="text-xs min-w-0">
            <div className="font-bold">Acompanhe no seu celular</div>
            <div className="opacity-70 break-all">{joinUrl}</div>
          </div>
        </div>
      </main>

      {/* ===== Projector / xl layout ===== */}
      <main className="hidden xl:grid flex-1 px-8 gap-8 items-stretch py-4 grid-cols-12">
        <div className="col-span-3 flex flex-col justify-center">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-400 mb-2">
            Último sorteado
          </div>
          <div
            className={`text-[18rem] 2xl:text-[22rem] leading-none font-black tabular-nums text-amber-400 transition-transform ${
              pulse ? "scale-110" : "scale-100"
            }`}
            style={{ transitionDuration: "300ms" }}
          >
            {lastCalled ?? "—"}
          </div>
        </div>

        <div className="col-span-6 flex flex-col justify-center">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-400 mb-2">
            90 números
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {allNumbers.map((n) => {
              const hit = calledSet.has(n);
              const isLast = n === lastCalled;
              return (
                <div
                  key={n}
                  className={`aspect-square rounded-md flex items-center justify-center text-2xl 2xl:text-3xl font-black tabular-nums transition-colors ${
                    isLast
                      ? "bg-amber-400 text-slate-900 ring-4 ring-amber-200"
                      : hit
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {n}
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-3 flex flex-col justify-center gap-6">
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Sorteados
            </div>
            <div className="text-7xl 2xl:text-8xl font-black tabular-nums">
              {called.length}
              <span className="text-3xl text-slate-500">/90</span>
            </div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Vencedores
            </div>
            <div className="text-7xl 2xl:text-8xl font-black tabular-nums text-emerald-400">
              {winners.length}
            </div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-slate-400 mb-1">
              Últimas vitórias
            </div>
            {recentWinners.length === 0 ? (
              <div className="text-slate-600 text-sm italic">aguardando…</div>
            ) : (
              <div className="space-y-1">
                {recentWinners.map((code) => (
                  <div
                    key={code}
                    className="text-2xl 2xl:text-3xl font-mono font-bold text-emerald-300"
                  >
                    🏆 #{code}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ===== Footer (xl only — mobile has its own CTA) ===== */}
      <footer className="hidden xl:flex px-8 pb-6 pt-2 items-end justify-between gap-8">
        <div className="text-base 2xl:text-lg text-slate-400 max-w-xl">
          Acompanhe suas cartelas no celular em tempo real. Compre acesso com o
          operador da festa — só <b className="text-white">R$ 5</b>.
        </div>
        <div className="flex items-center gap-3 bg-white p-3 rounded-lg">
          <QRCodeSVG value={joinUrl} size={96} level="M" includeMargin={false} />
          <div className="text-slate-900 text-sm">
            <div className="font-bold">Escaneie para jogar</div>
            <div className="text-xs opacity-70 break-all">{joinUrl}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
