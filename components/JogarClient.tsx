"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import type { Card } from "@/lib/types";
import { getBrowserSupabase, supabaseConfigured } from "@/lib/supabase/browser";
import {
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

function rankPlayerCards(
  cards: Card[],
  buyer: AuthBuyer,
  calledSet: Set<number>,
): PlayerCard[] {
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

  const [called, setCalled] = useState<number[]>([]);
  const [totalWinners, setTotalWinners] = useState<number>(0);
  const [connected, setConnected] = useState(false);

  const [audioReady, setAudioReady] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const toasts = useToasts();
  const [winModal, setWinModal] = useState<string | null>(null);
  const prevRemainingRef = useRef<Map<string, number>>(new Map());

  // ---- Hydrate from URL / localStorage ----
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
      if (cached && cached.access_code === fromUrl) setBuyer(cached);
      else setInitialCode(fromUrl);
    } else if (cached) {
      setBuyer(cached);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (buyer) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buyer));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [buyer, hydrated]);

  // ---- Realtime ----
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
          if (row && Array.isArray(row.called_numbers)) setCalled(row.called_numbers);
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, [buyer]);

  // ---- Wake Lock ----
  useEffect(() => {
    if (!buyer) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let cancelled = false;
    const request = async () => {
      try {
        const wl = await (
          navigator as Navigator & {
            wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> };
          }
        ).wakeLock.request("screen");
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

  // ---- Audio unlock ----
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

  // ---- Derived ----
  const calledSet = useMemo(() => new Set(called), [called]);
  const playerCards: PlayerCard[] = useMemo(
    () => (buyer ? rankPlayerCards(cards, buyer, calledSet) : []),
    [cards, buyer, calledSet],
  );
  const winners = useMemo(
    () => playerCards.filter((c) => c.remaining === 0),
    [playerCards],
  );
  const oneAways = useMemo(
    () => playerCards.filter((c) => c.remaining === 1),
    [playerCards],
  );
  const bestCard = playerCards[0];

  // Total winners across the entire game (not just this player)
  useEffect(() => {
    if (!called.length) {
      setTotalWinners(0);
      return;
    }
    let count = 0;
    for (const c of cards) {
      let all = true;
      for (const n of c.numbers) {
        if (!calledSet.has(n)) {
          all = false;
          break;
        }
      }
      if (all) count++;
    }
    setTotalWinners(count);
  }, [cards, calledSet, called.length]);

  const lastCalled = called[called.length - 1];

  // ---- Transition effects ----
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
      toasts.push(`Cartela #${newOneAway} · falta 1!`, "warn");
    }
    if (newWin && prev.size > 0) {
      navigator.vibrate?.([300, 100, 300, 100, 300]);
      playWinFanfare();
      setWinModal(newWin);
      confetti({ particleCount: 220, spread: 90, origin: { y: 0.6 } });
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

  const handleLogout = useCallback(() => setBuyer(null), []);
  const enableAudio = async () => {
    const ok = await unlockAudio();
    setAudioReady(ok);
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">…</div>
    );
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

  const playerWinnersCount = winners.length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ===== Compact sticky header ===== */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        {/* Meta strip */}
        <div className="px-4 pt-2.5 pb-1 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate min-w-0 pr-2">
            <img
              src="/neves-logo.png"
              alt="Movimento Neves"
              className="w-6 h-6 shrink-0"
            />
            <div className="truncate">
              <span className="text-slate-500">Olá, </span>
              <span className="font-semibold text-slate-900">{buyer.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ConnectionDot connected={connected} />
            <span className="tabular-nums text-slate-600 font-medium">
              {called.length}/90
            </span>
          </div>
        </div>

        {/* Big number strip */}
        <div className="px-4 pb-3 pt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              Último número
            </div>
            <div className="text-6xl sm:text-7xl font-black tabular-nums text-indigo-700 leading-none">
              {lastCalled ?? "—"}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              Ganhadores
            </div>
            <div className="text-2xl sm:text-3xl font-bold tabular-nums text-emerald-700 leading-none mt-0.5">
              {totalWinners}
            </div>
          </div>
        </div>

        {!audioReady && (
          <button
            onClick={enableAudio}
            className="block w-full text-[11px] bg-amber-50 text-amber-900 border-t border-amber-200 py-2 active:bg-amber-100"
          >
            🔊 Toque aqui para ativar os sons
          </button>
        )}
      </header>

      <main className="px-3 py-4 space-y-3 max-w-xl mx-auto">
        {/* Status pill */}
        {playerWinnersCount > 0 ? (
          <div className="rounded-xl bg-emerald-600 text-white px-4 py-3 shadow-sm">
            <div className="text-[10px] uppercase tracking-widest opacity-90">
              Você venceu
            </div>
            <div className="text-lg font-bold mt-0.5">
              {playerWinnersCount}{" "}
              {playerWinnersCount === 1 ? "cartela vencedora" : "cartelas vencedoras"} —
              procure o operador
            </div>
          </div>
        ) : oneAways.length > 0 ? (
          <div className="rounded-xl bg-amber-100 border border-amber-300 px-4 py-3 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white text-base shrink-0 animate-pulse">
              🔥
            </span>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-amber-800 font-semibold">
                A 1 número de vencer
              </div>
              <div className="text-sm font-mono font-bold text-amber-900 truncate">
                {oneAways.map((c) => `#${c.code}`).join("  ")}
              </div>
            </div>
          </div>
        ) : null}

        {/* Best card (featured) */}
        {bestCard && (
          <CardView card={bestCard} calledSet={calledSet} featured />
        )}

        {/* Rest of player cards */}
        {playerCards.length > 1 && (
          <div className="space-y-2 pt-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 px-1">
              Suas outras cartelas ({playerCards.length - 1})
            </div>
            {playerCards.slice(1).map((c) => (
              <CardView key={c.code} card={c} calledSet={calledSet} />
            ))}
          </div>
        )}

        {/* Logout link */}
        <div className="flex justify-center pt-6 pb-4">
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Sair / trocar código
          </button>
        </div>
      </main>

      <ToastRack items={toasts.items} />

      {winModal && (
        <WinModalView code={winModal} onClose={() => setWinModal(null)} />
      )}
    </div>
  );
}

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span
      title={connected ? "AO VIVO" : "reconectando"}
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
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
      {connected ? "AO VIVO" : "…"}
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

  const containerClass = won
    ? "border-emerald-500 bg-emerald-50"
    : oneAway
      ? "border-amber-400 bg-amber-50"
      : twoAway
        ? "border-amber-200 bg-amber-50/40"
        : "border-slate-200 bg-white";

  return (
    <div
      className={`rounded-xl border ${containerClass} ${
        featured ? "p-3 shadow-sm" : "p-2.5"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className={`font-mono font-bold tabular-nums ${
            featured ? "text-lg" : "text-sm"
          }`}
        >
          #{card.code}
        </div>
        <Badge card={card} compact={!featured} />
      </div>

      <div className={`grid grid-cols-5 ${featured ? "gap-1.5" : "gap-1"}`}>
        {card.numbers.map((n) => {
          const hit = calledSet.has(n);
          return (
            <div
              key={n}
              className={`aspect-square rounded-md flex items-center justify-center font-bold tabular-nums ${
                featured ? "text-xl" : "text-sm"
              } ${
                hit
                  ? "bg-emerald-500 text-white"
                  : "bg-white border border-slate-200 text-slate-700"
              }`}
            >
              {n}
            </div>
          );
        })}
      </div>

      {!won && card.missing.length <= (featured ? 5 : 3) && card.missing.length > 0 && (
        <div className="mt-2 text-[11px] text-slate-600 truncate">
          falta:{" "}
          <span className="font-mono font-semibold text-slate-900">
            {card.missing.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

function Badge({ card, compact }: { card: PlayerCard; compact?: boolean }) {
  if (card.remaining === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-emerald-600 text-white ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        🏆 BINGO
      </span>
    );
  }
  if (card.remaining === 1) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-amber-500 text-white ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        🔥 falta 1
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded font-semibold tabular-nums ${
        card.remaining === 2
          ? "bg-amber-200 text-amber-900"
          : "bg-slate-100 text-slate-700"
      } ${compact ? "text-[10px]" : "text-xs"}`}
    >
      faltam {card.remaining}
    </span>
  );
}

function WinModalView({ code, onClose }: { code: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-slate-900/70 modal-backdrop-in" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl modal-panel-in text-center overflow-hidden">
        <div className="bg-emerald-600 text-white px-6 py-5">
          <div className="text-4xl">🎉</div>
          <div className="text-3xl font-black mt-1">BINGO!</div>
          <div className="text-sm mt-1 opacity-95">
            Cartela <span className="font-mono font-bold">#{code}</span>
          </div>
        </div>
        <div className="px-6 py-5 text-sm text-slate-700">
          Procure o operador para validar e receber seu prêmio.
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
          >
            Ver minhas cartelas
          </button>
        </div>
      </div>
    </div>
  );
}
