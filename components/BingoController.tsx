"use client";

import { useEffect, useMemo, useState } from "react";
import type { Card, RankedCard } from "@/lib/types";
import NumberCaller from "./NumberCaller";
import Ranking from "./Ranking";
import CardLookup from "./CardLookup";

const STORAGE_KEY = "bingo-ejc:called:v1";
const MIN_NUM = 1;
const MAX_NUM = 90;

function readStoredCalled(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n) => typeof n === "number" && Number.isInteger(n) && n >= MIN_NUM && n <= MAX_NUM,
    );
  } catch {
    return [];
  }
}

export default function BingoController({ cards }: { cards: Card[] }) {
  const [called, setCalled] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCalled(readStoredCalled());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(called));
    } catch {
      /* ignore quota errors */
    }
  }, [called, hydrated]);

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
      result[i] = {
        code: c.code,
        numbers: c.numbers,
        remaining: missing.length,
        missing,
      };
    }
    result.sort((a, b) =>
      a.remaining !== b.remaining ? a.remaining - b.remaining : a.code.localeCompare(b.code),
    );
    return result;
  }, [cards, calledSet]);

  const winners = useMemo(() => ranked.filter((r) => r.remaining === 0), [ranked]);

  const addNumber = (n: number) => {
    if (!Number.isInteger(n) || n < MIN_NUM || n > MAX_NUM) return;
    setCalled((prev) => (prev.includes(n) ? prev : [...prev, n]));
  };

  const toggleNumber = (n: number) => {
    if (!Number.isInteger(n) || n < MIN_NUM || n > MAX_NUM) return;
    setCalled((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const undoLast = () => {
    setCalled((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)));
  };

  const reset = () => {
    setCalled([]);
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bingo EJC</h1>
            <p className="text-xs text-slate-500">
              {cards.length} cartelas · 15 números · 1–90
            </p>
          </div>
          <div className="flex items-center gap-3">
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
            onReset={reset}
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
      </main>

      <footer className="mx-auto max-w-[1600px] px-4 pb-8 text-xs text-slate-400">
        Dados das cartelas determinísticos. Estado salvo no navegador (localStorage).
      </footer>
    </div>
  );
}
