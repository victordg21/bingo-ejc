"use client";

import { useMemo, useState } from "react";
import type { RankedCard } from "@/lib/types";

type Props = {
  ranked: RankedCard[];
  winners: RankedCard[];
};

const DEFAULT_LIMIT = 20;

export default function Ranking({ ranked, winners }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");

  const nonWinners = useMemo(() => ranked.filter((r) => r.remaining > 0), [ranked]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return nonWinners;
    return nonWinners.filter((r) => r.code.toLowerCase().includes(q));
  }, [nonWinners, search]);

  const visible = showAll || search ? filtered : filtered.slice(0, DEFAULT_LIMIT);

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider">Ranking ao vivo</h2>
        <span className="text-xs text-slate-300">
          {filtered.length} de {nonWinners.length}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Winners pinned */}
        {winners.length > 0 && (
          <div className="rounded-lg border-2 border-emerald-500 bg-emerald-50 p-3">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">
              Bingo! {winners.length} {winners.length === 1 ? "ganhador" : "ganhadores"}
            </div>
            <div className="flex flex-wrap gap-2">
              {winners.map((w) => (
                <span
                  key={w.code}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 text-white font-bold tabular-nums text-sm"
                >
                  #{w.code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código (ex. 0428)"
            className="flex-1 px-3 py-2 text-sm rounded-md border border-slate-300 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => setShowAll((s) => !s)}
            className="text-xs px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-50"
          >
            {showAll ? `Top ${DEFAULT_LIMIT}` : "Ver todas"}
          </button>
        </div>

        {/* List */}
        <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
          {visible.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">
              {search ? "Nenhuma cartela encontrada" : "Nenhuma cartela"}
            </div>
          ) : (
            visible.map((card) => {
              const tone =
                card.remaining === 1
                  ? "bg-amber-100 border-amber-400"
                  : card.remaining === 2
                    ? "bg-amber-50 border-amber-200"
                    : "bg-white border-slate-200";
              return (
                <div
                  key={card.code}
                  className={`flex items-center gap-3 p-2.5 rounded-md border ${tone}`}
                >
                  <div className="font-mono font-bold text-base tabular-nums w-16 shrink-0">
                    #{card.code}
                  </div>
                  <div className="shrink-0">
                    <span
                      className={[
                        "inline-block min-w-[2.5rem] text-center px-2 py-0.5 rounded font-bold tabular-nums text-sm",
                        card.remaining === 1
                          ? "bg-amber-500 text-white"
                          : card.remaining === 2
                            ? "bg-amber-300 text-amber-900"
                            : "bg-slate-200 text-slate-700",
                      ].join(" ")}
                    >
                      {card.remaining}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 truncate flex-1">
                    falta:{" "}
                    <span className="tabular-nums font-medium text-slate-800">
                      {card.missing.join(", ")}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
