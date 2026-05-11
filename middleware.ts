import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/auth";

// Edge middleware: protects /admin/** and /api/admin/** (except /admin/login + /api/admin/login).
// Rate limiting on /api/auth/validate-code lives inside the route itself (Node runtime,
// module-level Map persists better than Edge state).

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // public sub-paths
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    // App misconfigured. Send to login (which will also surface error).
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "ADMIN_PASSWORD não configurado" }, { status: 500 });
    }
    return NextResponse.redirect(new URL("/admin/login?error=config", req.url));
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token, secret))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
