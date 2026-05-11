import LoginForm from "./LoginForm";

export const metadata = {
  title: "Admin — Bingo EJC",
};

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { from?: string; error?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <LoginForm from={searchParams.from} configError={searchParams.error === "config"} />
    </div>
  );
}
