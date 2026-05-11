"use client";

import { useEffect, useState } from "react";

type Props = {
  initialCode?: string;
  onAuthenticated: (buyer: AuthBuyer) => void;
};

export type AuthBuyer = {
  id: string;
  name: string;
  access_code: string;
  card_codes: number[];
  tier: string;
};

export default function JogarLogin({ initialCode, onAuthenticated }: Props) {
  const [code, setCode] = useState(initialCode ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Código inválido");
        setSubmitting(false);
        return;
      }
      onAuthenticated(j.buyer as AuthBuyer);
    } catch {
      setError("Falha de rede");
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (initialCode && initialCode.length >= 6) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <h1 className="text-2xl font-bold text-slate-900">Bingo EJC</h1>
        <p className="text-sm text-slate-500 mt-1">
          Digite seu código de acesso para acompanhar suas cartelas em tempo real.
        </p>

        <label className="block mt-5">
          <span className="text-xs uppercase tracking-wider text-slate-600">
            Código de acesso
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
            placeholder="JOAO-7K2P"
            className="mt-1 w-full px-4 py-3 text-xl font-mono uppercase rounded-lg border-2 border-slate-300 focus:border-indigo-500 focus:outline-none"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
        </label>

        {error && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || code.length < 6}
          className="mt-4 w-full px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base"
        >
          {submitting ? "Validando…" : "Entrar"}
        </button>

        <p className="mt-4 text-xs text-center text-slate-500">
          Não tem código? Procure o operador da festa.
        </p>
      </form>
    </div>
  );
}
