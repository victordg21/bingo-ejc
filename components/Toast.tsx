"use client";

import { useEffect, useState } from "react";

export type ToastItem = { id: number; text: string; tone: "info" | "warn" | "success" };

export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = (text: string, tone: ToastItem["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((it) => [...it, { id, text, tone }]);
    window.setTimeout(() => {
      setItems((it) => it.filter((x) => x.id !== id));
    }, 4000);
  };
  return { items, push };
}

export function ToastRack({ items }: { items: ToastItem[] }) {
  return (
    <div className="fixed top-4 right-4 z-40 flex flex-col gap-2 max-w-sm">
      {items.map((t) => (
        <ToastView key={t.id} item={t} />
      ))}
    </div>
  );
}

function ToastView({ item }: { item: ToastItem }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const tone =
    item.tone === "warn"
      ? "bg-amber-100 border-amber-400 text-amber-900"
      : item.tone === "success"
        ? "bg-emerald-100 border-emerald-500 text-emerald-900"
        : "bg-white border-slate-300 text-slate-900";
  return (
    <div
      className={`pointer-events-none rounded-lg border-2 shadow-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
        show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      } ${tone}`}
    >
      {item.text}
    </div>
  );
}
