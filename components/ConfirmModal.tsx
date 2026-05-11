"use client";

import { useEffect, useRef, useState } from "react";

type Variant = "confirm" | "destructive";

type Props = {
  open: boolean;
  title: string;
  body: string;
  number: number;
  confirmLabel: string;
  cancelLabel?: string;
  variant: Variant;
  onConfirm: () => void;
  onCancel: () => void;
};

const CLOSE_MS = 120;

export default function ConfirmModal({
  open,
  title,
  body,
  number,
  confirmLabel,
  cancelLabel = "Cancelar",
  variant,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Keep modal mounted briefly while close animation plays.
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => setMounted(false), CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  // Focus management + ESC handler. Active only while open.
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const raf = requestAnimationFrame(() => cancelRef.current?.focus());
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
      // Return focus to whatever was focused before the modal opened
      // (typically the grid button or the typed-input field).
      const prev = prevFocusRef.current;
      prevFocusRef.current = null;
      if (prev && typeof prev.focus === "function") {
        prev.focus();
      }
    };
  }, [open]);

  if (!mounted) return null;

  const confirmClasses =
    variant === "destructive"
      ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-400"
      : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-400";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        onClick={onCancel}
        className={[
          "absolute inset-0 bg-slate-900/50 cursor-default",
          closing ? "modal-backdrop-out" : "modal-backdrop-in",
        ].join(" ")}
      />
      <div
        className={[
          "relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden",
          closing ? "modal-panel-out" : "modal-panel-in",
        ].join(" ")}
      >
        <div className="px-6 pt-6 pb-4">
          <h3
            id="confirm-modal-title"
            className="text-lg font-bold text-slate-900"
          >
            {title}
          </h3>
          <p className="mt-2 text-sm text-slate-600">{body}</p>

          <div className="mt-5 flex items-center justify-center">
            <div className="rounded-xl bg-slate-100 border border-slate-200 px-8 py-4 text-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                Número
              </div>
              <div className="text-6xl font-black tabular-nums text-slate-900 leading-none mt-1">
                {number}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 flex-1 sm:flex-none"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] px-5 rounded-lg text-white font-semibold focus:outline-none focus-visible:ring-2 flex-1 sm:flex-none ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
