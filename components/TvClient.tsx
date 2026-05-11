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

  // Realtime
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

  // Detect newly added last_called for pulse + sound
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

  // Track newly-won cards for the "recent winners" ticker
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
    // also handle "winners decreased" e.g. after reset
    if (winners.length < newWinnersRef.current.size) {
      newWinnersRef.current = new Set(winners);
      setRecentWinners([]);
    }
  }, [winners]);

  const toggleMute = async () => {
    if (muted) {
      await unlockAudio();
    }
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
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden flex flex-col">
      <header className="px-8 pt-6 pb-2 flex items-center justify-between">
        <h1 className="text-4xl xl:text-5xl font-black tracking-tight">
          🎉 BINGO DA FESTA
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleMute}
            className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20"
            title={muted ? "Ativar som" : "Mutar"}
          >
            {muted ? "🔇 Som off" : "🔊 Som on"}
          </button>
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              connected ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
            }`}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
              }`}
            />
            {connected ? "AO VIVO" : "..."}
          </span>
        </div>
      </header>

      <main className="flex-1 px-8 grid grid-cols-12 gap-8 items-stretch py-4">
        {/* Last called - left column */}
        <div className="col-span-3 flex flex-col justify-center">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-400 mb-2">
            Último sorteado
          </div>
          <div
            className={`text-[18rem] xl:text-[22rem] leading-none font-black tabular-nums text-amber-400 transition-transform ${
              pulse ? "scale-110" : "scale-100"
            }`}
            style={{ transitionDuration: "300ms" }}
          >
            {lastCalled ?? "—"}
          </div>
        </div>

        {/* 90 grid - center column */}
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
                  className={`aspect-square rounded-md flex items-center justify-center text-2xl xl:text-3xl font-black tabular-nums transition-colors ${
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

        {/* Stats - right column */}
        <div className="col-span-3 flex flex-col justify-center gap-6">
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Sorteados</div>
            <div className="text-7xl xl:text-8xl font-black tabular-nums">
              {called.length}
              <span className="text-3xl text-slate-500">/90</span>
            </div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Vencedores</div>
            <div className="text-7xl xl:text-8xl font-black tabular-nums text-emerald-400">
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
                    className="text-2xl xl:text-3xl font-mono font-bold text-emerald-300"
                  >
                    🏆 #{code}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer: QR + tagline */}
      <footer className="px-8 pb-6 pt-2 flex items-end justify-between gap-8">
        <div className="text-base xl:text-lg text-slate-400 max-w-xl">
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
