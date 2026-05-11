"use client";

import { useState } from "react";
import ConfirmModal from "./ConfirmModal";

type Props = {
  called: number[];
  calledSet: Set<number>;
  onAdd: (n: number) => void;
  onToggle: (n: number) => void;
  onUndo: () => void;
  onResetRequest: () => void;
  min: number;
  max: number;
};

export default function NumberCaller({
  called,
  calledSet,
  onAdd,
  onToggle,
  onUndo,
  onResetRequest,
  min,
  max,
}: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingNumber, setPendingNumber] = useState<number | null>(null);
  // Snapshot of the pending tap, retained during the close animation so the
  // modal can keep rendering its title/body while it fades out.
  const [pendingSnapshot, setPendingSnapshot] = useState<{
    n: number;
    wasCalled: boolean;
  } | null>(null);

  const lastCalled = called[called.length - 1];
  const modalOpen = pendingNumber !== null;

  const handleGridClick = (n: number) => {
    setPendingSnapshot({ n, wasCalled: calledSet.has(n) });
    setPendingNumber(n);
  };

  const handleModalConfirm = () => {
    if (pendingNumber !== null) onToggle(pendingNumber);
    setPendingNumber(null);
  };

  const handleModalCancel = () => {
    setPendingNumber(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const n = parseInt(trimmed, 10);
    if (Number.isNaN(n) || n < min || n > max) {
      setError(`Número precisa estar entre ${min} e ${max}`);
      return;
    }
    if (calledSet.has(n)) {
      setError(`${n} já foi chamado`);
      setInput("");
      return;
    }
    onAdd(n);
    setInput("");
    setError(null);
  };

  const handleReset = () => {
    if (called.length === 0) return;
    onResetRequest();
  };

  // 9 rows x 10 columns: 1-10 row 1, 11-20 row 2, ...
  const allNumbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 text-white px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider">Chamar número</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* Last called - giant display */}
        <div className="rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-indigo-200">
              Último chamado
            </div>
            <div className="text-[8rem] leading-none font-black tabular-nums">
              {lastCalled ?? "—"}
            </div>
          </div>
          <button
            onClick={onUndo}
            disabled={called.length === 0}
            className="self-start px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
          >
            Desfazer
          </button>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder={`Digite (${min}-${max}) e Enter`}
            className="flex-1 text-2xl font-semibold tabular-nums px-4 py-3 rounded-lg border-2 border-slate-300 focus:border-indigo-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            className="px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            Chamar
          </button>
        </form>
        {error && <p className="text-sm text-red-600 -mt-3">{error}</p>}

        {/* 90-number grid */}
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
            Clique para alternar (pede confirmação)
          </div>
          <div
            className={[
              "grid grid-cols-10 gap-1 transition-opacity",
              modalOpen ? "opacity-50 pointer-events-none" : "opacity-100",
            ].join(" ")}
            aria-hidden={modalOpen}
          >
            {allNumbers.map((n) => {
              const isCalled = calledSet.has(n);
              const isLast = n === lastCalled;
              return (
                <button
                  key={n}
                  onClick={() => handleGridClick(n)}
                  className={[
                    "aspect-square rounded-md text-base font-bold tabular-nums transition-colors",
                    isLast
                      ? "bg-amber-400 text-slate-900 ring-2 ring-amber-600"
                      : isCalled
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700",
                  ].join(" ")}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* Called list in order */}
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
            Ordem dos chamados ({called.length})
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 min-h-[3rem] flex flex-wrap gap-1">
            {called.length === 0 ? (
              <span className="text-sm text-slate-400 px-2 py-1">Nenhum número ainda</span>
            ) : (
              called.map((n, i) => (
                <span
                  key={`${n}-${i}`}
                  className={[
                    "px-2 py-0.5 rounded text-sm font-semibold tabular-nums",
                    i === called.length - 1
                      ? "bg-amber-200 text-amber-900"
                      : "bg-white border border-slate-200 text-slate-700",
                  ].join(" ")}
                >
                  {n}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleReset}
            disabled={called.length === 0}
            className="text-xs px-3 py-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Reiniciar jogo
          </button>
        </div>
      </div>

      <ConfirmModal
        open={modalOpen}
        number={pendingSnapshot?.n ?? 0}
        title={
          pendingSnapshot?.wasCalled
            ? `Remover número ${pendingSnapshot.n}?`
            : `Adicionar número ${pendingSnapshot?.n ?? ""}?`
        }
        body={
          pendingSnapshot?.wasCalled
            ? "Este número já foi sorteado. Você tem certeza que deseja removê-lo da lista?"
            : `Você tem certeza que deseja marcar o número ${pendingSnapshot?.n ?? ""} como sorteado?`
        }
        confirmLabel={pendingSnapshot?.wasCalled ? "Sim, remover" : "Sim, adicionar"}
        variant={pendingSnapshot?.wasCalled ? "destructive" : "confirm"}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
}
