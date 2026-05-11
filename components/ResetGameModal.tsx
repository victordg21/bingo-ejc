"use client";

import { useEffect, useRef, useState } from "react";

const REQUIRED = "REINICIAR";

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ResetGameModal({ open, onConfirm, onCancel }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) {
      setText("");
      setSubmitting(false);
      return;
    }
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancelRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  const canConfirm = text.trim().toUpperCase() === REQUIRED && !submitting;

  const handleConfirm = () => {
    if (!canConfirm) return;
    setSubmitting(true);
    onConfirm();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/60 cursor-default modal-backdrop-in"
      />
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-red-200 overflow-hidden modal-panel-in">
        <div className="px-6 pt-6 pb-4">
          <h3 id="reset-modal-title" className="text-lg font-bold text-red-700">
            Reiniciar jogo?
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            Isso vai apagar <b>todos</b> os números sorteados. Não dá pra desfazer.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Para confirmar, digite <b className="font-mono text-red-700">{REQUIRED}</b> abaixo:
          </p>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canConfirm) handleConfirm();
            }}
            placeholder={REQUIRED}
            className="mt-3 w-full px-4 py-3 text-lg font-mono tabular-nums rounded-lg border-2 border-slate-300 focus:border-red-500 focus:outline-none"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>
        <div className="px-6 pb-6 pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-[44px] px-5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold flex-1 sm:flex-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="min-h-[44px] px-5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex-1 sm:flex-none"
          >
            {submitting ? "Reiniciando…" : "Sim, reiniciar"}
          </button>
        </div>
      </div>
    </div>
  );
}
