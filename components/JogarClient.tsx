"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import type { Card } from "@/lib/types";
import { getBrowserSupabase, supabaseConfigured } from "@/lib/supabase/browser";
import {
  isAudioUnlocked,
  playOneAwayAlert,
  playWinFanfare,
  unlockAudio,
} from "@/lib/sounds";
import { formatCardCode } from "@/lib/access-code";
import JogarLogin, { type AuthBuyer } from "./JogarLogin";
import { ToastRack, useToasts } from "./Toast";

const STORAGE_KEY = "bingo-ejc:player:v1";

type PlayerCard = {
  code: string;
  numbers: number[];
  missing: number[];
  remaining: number;
};

function rankPlayerCards(cards: Card[], buyer: AuthBuyer, calledSet: Set<number>): PlayerCard[] {
  const byCode = new Map<string, Card>();
  for (const c of cards) byCode.set(c.code, c);
  const result: PlayerCard[] = [];
  for (const codeNum of buyer.card_codes) {
    const code = formatCardCode(codeNum);
    const card = byCode.get(code);
    if (!card) continue;
    const missing: number[] = [];
    for (const n of card.numbers) if (!calledSet.has(n)) missing.push(n);
    result.push({ code, numbers: card.numbers, missing, remaining: missing.length });
  }
  result.sort((a, b) =>
    a.remaining !== b.remaining ? a.remaining - b.remaining : a.code.localeCompare(b.code),
  );
  return result;
}

export default function JogarClient({ cards }: { cards: Card[] }) {
  const [buyer, setBuyer] = useState<AuthBuyer | null>(null);
  const [initialCode, setInitialCode] = useState<string | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  // Game state from realtime
  const [called, setCalled] = useState<number[]>([]);
  const [totalWinners, setTotalWinners] = useState<number>(0);
  const [connected, setConnected] = useState(false);

  // Audio + wake lock
  const [audioReady, setAudioReady] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Toasts + win modal
  const toasts = useToasts();
  const [winModal, setWinModal] = useState<string | null>(null);
  const prevRemainingRef = useRef<Map<string, number>>(new Map());

  // ---- Hydrate access code from URL or localStorage ----
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("code")?.toUpperCase() ?? null;
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    let cached: AuthBuyer | null = null;
    if (fromStorage) {
      try {
        cached = JSON.parse(fromStorage) as AuthBuyer;
      } catch {
        /* ignore */
      }
    }
    if (fromUrl) {
      if (cached && cached.access_code === fromUrl) {
        setBuyer(cached);
      } else {
        setInitialCode(fromUrl);
      }
    } else if (cached) {
      setBuyer(cached);
    }
    setHydrated(true);
  }, []);

  // Persist buyer locally
  useEffect(() => {
    if (!hydrated) return;
    if (buyer) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buyer));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [buyer, hydrated]);

  // ---- Realtime: game state ----
  useEffect(() => {
    if (!buyer) return;
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
      .channel("jogar:game_state")
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
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, [buyer]);

  // ---- Wake Lock (best effort) ----
  useEffect(() => {
    if (!buyer) return;
    const supported =
      typeof navigator !== "undefined" && "wakeLock" in navigator;
    if (!supported) return;
    let cancelled = false;
    const request = async () => {
      try {
        const wl = await (navigator as Navigator & {
          wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> };
        }).wakeLock.request("screen");
        if (cancelled) {
          wl.release().catch(() => {});
          return;
        }
        wakeLockRef.current = wl;
        wl.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
        /* not granted; ignore */
      }
    };
    request();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) request();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [buyer]);

  // ---- Audio unlock on first user gesture ----
  useEffect(() => {
    if (!buyer) return;
    const handler = async () => {
      const ok = await unlockAudio();
      if (ok) setAudioReady(true);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [buyer]);

  // ---- Derived state ----
  const calledSet = useMemo(() => new Set(called), [called]);
  const playerCards: PlayerCard[] = useMemo(
    () => (buyer ? rankPlayerCards(cards, buyer, calledSet) : []),
    [cards, buyer, calledSet],
  );

  const winners = useMemo(() => playerCards.filter((c) => c.remaining === 0), [playerCards]);
  const oneAways = useMemo(() => playerCards.filter((c) => c.remaining === 1), [playerCards]);
  const bestCard = playerCards[0];

  // ---- Total winners count (across all 1000 cards, not just this player) ----
  useEffect(() => {
    if (!called.length) {
      setTotalWinners(0);
      return;
    }
    let count = 0;
    for (const c of cards) {
      let allHit = true;
      for (const n of c.numbers) {
        if (!calledSet.has(n)) {
          allHit = false;
          break;
        }
      }
      if (allHit) count++;
    }
    setTotalWinners(count);
  }, [cards, calledSet, called.length]);

  const lastCalled = called[called.length - 1];

  // ---- Transition effects: detect new 1-aways and new wins ----
  useEffect(() => {
    const prev = prevRemainingRef.current;
    const next = new Map<string, number>();
    let newOneAway: string | null = null;
    let newWin: string | null = null;
    for (const c of playerCards) {
      next.set(c.code, c.remaining);
      const before = prev.get(c.code);
      if (before === undefined) continue;
      if (before > 1 && c.remaining === 1 && !newOneAway) newOneAway = c.code;
      if (before > 0 && c.remaining === 0 && !newWin) newWin = c.code;
    }
    if (newOneAway && prev.size > 0) {
      navigator.vibrate?.([200, 100, 200]);
      playOneAwayAlert();
      toasts.push(`🔥 Cartela #${newOneAway} a 1 número de vencer!`, "warn");
    }
    if (newWin && prev.size > 0) {
      navigator.vibrate?.([300, 100, 300, 100, 300]);
      playWinFanfare();
      setWinModal(newWin);
      confetti({
        particleCount: 220,
        spread: 90,
        origin: { y: 0.6 },
      });
      setTimeout(
        () => confetti({ particleCount: 120, spread: 100, origin: { x: 0.2, y: 0.6 } }),
        300,
      );
      setTimeout(
        () => confetti({ particleCount: 120, spread: 100, origin: { x: 0.8, y: 0.6 } }),
        600,
      );
    }
    prevRemainingRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCards]);

  // ---- Handlers ----
  const handleLogout = useCallback(() => {
    setBuyer(null);
  }, []);

  const enableAudio = async () => {
    const ok = await unlockAudio();
    setAudioReady(ok);
  };

  // ---- Render ----
  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">…</div>;
  }

  if (!supabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-bold text-red-700">Supabase não configurado</h1>
          <p className="text-sm text-slate-600 mt-2">
            O operador da festa ainda não configurou o servidor.
          </p>
        </div>
      </div>
    );
  }

  if (!buyer) {
    return (
      <JogarLogin
        initialCode={initialCode}
        onAuthenticated={(b) => {
          setBuyer(b);
          setInitialCode(undefined);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">Olá,</div>
            <div className="text-base font-bold text-slate-900 truncate">{buyer.name}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Último</div>
            <div className="text-5xl font-black tabular-nums text-indigo-700 leading-none">
              {lastCalled ?? "—"}
            </div>
          </div>
          <div className="text-right shrink-0">
            <ConnectionDot connected={connected} />
            <div className="text-xs text-slate-500 mt-1">
              {called.length}/90 · 🏆 {totalWinners}
            </div>
          </div>
        </div>
        {!audioReady && (
          <button
            onClick={enableAudio}
            className="block w-full text-xs bg-amber-50 text-amber-900 border-t border-amber-200 py-1.5 hover:bg-amber-100"
          >
            🔊 Ativar sons (toque uma vez para liberar áudio)
          </button>
        )}
      </header>

      <main className="px-4 pt-4 space-y-4 max-w-2xl mx-auto">
        {/* Status banner */}
        {winners.length > 0 ? (
          <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-4 shadow-md">
            <div className="text-xs uppercase tracking-widest opacity-90">
              🎉 Você venceu!
            </div>
            <div className="text-2xl font-black mt-1">
              {winners.length}{" "}
              {winners.length === 1 ? "cartela vencedora" : "cartelas vencedoras"}
            </div>
            <div className="text-sm opacity-90 mt-1">
              Procure o operador para confirmar:{" "}
              <span className="font-mono font-bold">
                {winners.map((w) => `#${w.code}`).join(", ")}
              </span>
            </div>
          </div>
        ) : oneAways.length > 0 ? (
          <div className="rounded-xl bg-amber-100 border-2 border-amber-400 p-4 animate-pulse">
            <div className="text-sm uppercase tracking-widest text-amber-800 font-bold">
              🔥 A 1 número de vencer!
            </div>
            <div className="text-lg font-bold mt-1 text-amber-900">
              {oneAways.map((c) => `#${c.code}`).join(", ")}
            </div>
          </div>
        ) : bestCard ? (
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Faltam {bestCard.remaining}{" "}
              {bestCard.remaining === 1 ? "número" : "números"} para sua melhor cartela
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1">#{bestCard.code}</div>
          </div>
        ) : null}

        {/* Best card */}
        {bestCard && (
          <CardView
            card={bestCard}
            calledSet={calledSet}
            featured
          />
        )}

        {/* All cards */}
        {playerCards.length > 1 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-slate-500 px-1">
              Todas as suas cartelas ({playerCards.length})
            </div>
            {playerCards.slice(1).map((c) => (
              <CardView key={c.code} card={c} calledSet={calledSet} />
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Sair / trocar código
          </button>
        </div>
      </main>

      <ToastRack items={toasts.items} />

      {winModal && (
        <WinModalView
          code={winModal}
          onClose={() => setWinModal(null)}
        />
      )}
    </div>
  );
}

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span
      title={connected ? "ao vivo" : "reconectando"}
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
        connected
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
        }`}
      />
      {connected ? "AO VIVO" : "..."}
    </span>
  );
}

function CardView({
  card,
  calledSet,
  featured,
}: {
  card: PlayerCard;
  calledSet: Set<number>;
  featured?: boolean;
}) {
  const won = card.remaining === 0;
  const oneAway = card.remaining === 1;
  const twoAway = card.remaining === 2;

  const ring = won
    ? "border-emerald-500 bg-emerald-50"
    : oneAway
      ? "border-amber-500 bg-amber-50 animate-pulse"
      : twoAway
        ? "border-amber-300 bg-amber-50/40"
        : "border-slate-200 bg-white";

  return (
    <div
      className={`rounded-xl border-2 ${ring} ${featured ? "p-4 shadow-sm" : "p-3"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`font-mono font-bold ${featured ? "text-xl" : "text-base"}`}>
          #{card.code}
        </div>
        {won ? (
          <div className="text-emerald-700 font-bold text-sm">VENCEDORA! 🏆</div>
        ) : (
          <div className="text-right">
            <span
              className={`px-2 py-0.5 rounded font-bold tabular-nums ${
                oneAway
                  ? "bg-amber-500 text-white"
                  : twoAway
                    ? "bg-amber-200 text-amber-900"
                    : "bg-slate-200 text-slate-700"
              } ${featured ? "text-base" : "text-xs"}`}
            >
              Faltam {card.remaining}
            </span>
          </div>
        )}
      </div>
      <div className={`grid grid-cols-5 ${featured ? "gap-1.5" : "gap-1"}`}>
        {card.numbers.map((n) => {
          const hit = calledSet.has(n);
          return (
            <div
              key={n}
              className={`aspect-square rounded-md flex items-center justify-center font-bold tabular-nums ${
                featured ? "text-2xl" : "text-base"
              } ${
                hit
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {n}
            </div>
          );
        })}
      </div>
      {!won && card.missing.length <= 5 && (
        <div className="mt-2 text-xs text-slate-600">
          falta:{" "}
          <span className="font-mono font-semibold text-slate-900">
            {card.missing.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

function WinModalView({ code, onClose }: { code: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60 modal-backdrop-in" />
      <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-6 shadow-2xl modal-panel-in text-center">
        <div className="text-5xl mb-2">🎉</div>
        <div className="text-2xl font-black">BINGO!</div>
        <div className="text-lg mt-1 opacity-95">
          Cartela <span className="font-mono">#{code}</span> venceu!
        </div>
        <div className="text-sm mt-3 opacity-90">
          Procure o operador para validar e receber seu prêmio.
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full px-5 py-3 rounded-lg bg-white text-emerald-700 font-bold hover:bg-emerald-50"
        >
          Ver minhas cartelas
        </button>
      </div>
    </div>
  );
}
