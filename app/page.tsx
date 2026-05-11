import Link from "next/link";

export const metadata = {
  title: "Bingo EJC",
};

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Bingo EJC</h1>
          <p className="text-sm text-slate-500 mt-1">Festa da igreja · 1000 cartelas</p>
        </header>

        <div className="grid gap-3">
          <Link
            href="/jogar"
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-5 shadow-md transition"
          >
            <div className="text-xs uppercase tracking-widest opacity-80">Jogador</div>
            <div className="text-xl font-bold mt-0.5">Acompanhar minhas cartelas →</div>
          </Link>
          <Link
            href="/tv"
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-6 py-5 shadow-md transition"
          >
            <div className="text-xs uppercase tracking-widest opacity-80">Telão</div>
            <div className="text-xl font-bold mt-0.5">Modo TV / projeção →</div>
          </Link>
          <Link
            href="/admin"
            className="rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 px-6 py-5 shadow-sm transition"
          >
            <div className="text-xs uppercase tracking-widest text-slate-500">Operador</div>
            <div className="text-xl font-bold mt-0.5">Painel admin →</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
