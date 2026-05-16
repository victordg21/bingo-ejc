"use client";

import { useState } from "react";

export default function LoginForm({ from, configError }: { from?: string; configError: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Senha incorreta");
        setLoading(false);
        return;
      }
      window.location.href = from && from.startsWith("/admin") ? from : "/admin";
    } catch {
      setError("Falha de rede");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-6">
      <div className="flex items-center gap-3">
        <img
          src="/neves-logo.png"
          alt="Movimento Neves"
          className="w-12 h-12 shrink-0"
        />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Painel do operador</h1>
          <p className="text-sm text-slate-500">Bingo do São João</p>
        </div>
      </div>

      {configError && (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          ADMIN_PASSWORD não está configurado nas variáveis de ambiente.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-slate-600">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-md border-2 border-slate-300 focus:border-indigo-500 focus:outline-none"
            autoFocus
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="w-full px-4 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
