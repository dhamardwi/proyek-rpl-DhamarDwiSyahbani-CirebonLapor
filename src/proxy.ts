/**
 * src/proxy.ts  (Next.js 16 — formerly middleware.ts)
 *
 * Route protection dengan RBAC:
 * - Redirect unauthenticated users ke /login
 * - Redirect authenticated users yang ke /login atau /register ke dashboard mereka
 * - Guard route /dashboard/admin  → hanya ADMIN
 * - Guard route /dashboard/petugas → PETUGAS atau ADMIN
 * - Guard route /dashboard/masyarakat → MASYARAKAT atau ADMIN
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Route yang memerlukan autentikasi
const PROTECTED_PREFIXES = ["/dashboard", "/reports", "/my-reports", "/tasks", "/admin", "/map", "/settings"];

// Route yang tidak boleh diakses oleh user yang sudah login
const AUTH_ONLY_ROUTES = ["/login", "/register"];

// Role yang diizinkan per prefix route
const ROLE_GUARDS: { prefix: string; allowedRoles: string[] }[] = [
  { prefix: "/dashboard/admin", allowedRoles: ["ADMIN"] },
  { prefix: "/dashboard/petugas", allowedRoles: ["PETUGAS", "ADMIN"] },
  { prefix: "/dashboard/masyarakat", allowedRoles: ["MASYARAKAT", "ADMIN"] },
  { prefix: "/tasks", allowedRoles: ["PETUGAS", "ADMIN"] },
  { prefix: "/admin", allowedRoles: ["ADMIN"] },
];

export async function proxy(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = req.nextUrl;

  // 1. Jika sudah login & mengakses route auth (login/register), redirect ke dashboard
  if (AUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r)) && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 2. Route yang memerlukan autentikasi
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected) {
    if (!token) {
      // Belum login → redirect ke login dengan callbackUrl
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = token.role as string;

    // 3. Role-based guard
    for (const guard of ROLE_GUARDS) {
      if (pathname.startsWith(guard.prefix)) {
        if (!guard.allowedRoles.includes(role)) {
          return NextResponse.redirect(new URL("/unauthorized", req.url));
        }
        break;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Jalankan proxy untuk semua route kecuali static files dan API
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)",
  ],
};
