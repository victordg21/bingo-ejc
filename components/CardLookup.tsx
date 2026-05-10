"use client";

import { useMemo, useState } from "react";
import type { Card } from "@/lib/types";

type Props = {
  cards: Card[];
  calledSet: Set<number>;
};

export default function CardLookup({ cards, calledSet }: Props) {
  const [query, setQuery] = useState("");

  const cardByCode = useMemo(() => {
    const map = new Map<string, Card>();
    for (const c of cards) map.set(c.code, c);
    return map;
  }, [cards]);

  const normalized = query.trim().padStart(4, "0").slice(-4);
  const card = query.trim() ? cardByCode.get(normalized) : undefined;

  const missing = card ? card.numbers.filter((n) => !calledSet.has(n)) : [];
  const isWinner = card && missing.length === 0;

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden sticky top-[88px]">
      <div className="bg-slate-900 text-white px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider">Verificar cartela</h2>
      </div>

      <div className="p-4 space-y-4">
        <input
          type="text"
          inputMode="numeric"
          value={query}
          onChange={(e) => setQuery(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Código da cartela (ex. 0428)"
          className="w-full px-4 py-3 text-xl font-semibold tabular-nums rounded-lg border-2 border-slate-300 focus:border-indigo-500 focus:outline-none"
          maxLength={4}
        />

        {query.trim() && !card && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
            Cartela #{normalized} não encontrada.
          </div>
        )}

        {card && (
          <div className="space-y-3">
            <div
              className={[
                "rounded-lg p-3 border-2",
                isWinner
                  ? "bg-emerald-50 border-emerald-500"
                  : missing.length === 1
                    ? "bg-amber-50 border-amber-400"
                    : "bg-slate-50 border-slate-200",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-mono font-bold text-2xl tabular-nums">
                  #{card.code}
                </div>
                <div className="text-right">
                  {isWinner ? (
                    <div className="text-emerald-700 font-bold text-lg">BINGO!</div>
                  ) : (
                    <div>
                      <div className="text-3xl font-black tabular-nums leading-none">
                        {missing.length}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">
                        faltam
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {!isWinner && (
                <div className="mt-2 text-xs text-slate-600">
                  falta:{" "}
                  <span className="tabular-nums font-semibold text-slate-900">
                    {missing.join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                15 números da cartela
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {card.numbers.map((n) => {
                  const hit = calledSet.has(n);
                  return (
                    <div
                      key={n}
                      className={[
                        "aspect-square rounded-md flex items-center justify-center text-lg font-bold tabular-nums",
                        hit
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-400 line-through-none",
                      ].join(" ")}
                    >
                      {n}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          <a
            href="/data/cards.csv"
            download
            className="block text-center text-sm px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
          >
            Baixar todas as cartelas (CSV)
          </a>
        </div>
      </div>
    </div>
  );
}
