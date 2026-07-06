"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * Client-side auth gate shared by protected pages. Encapsulates the redirect
 * effect that was hand-rolled across ~18 pages:
 *   - unauthenticated  → /login
 *   - authed non-admin → /unauthorized  (only when `{ admin: true }`)
 *
 * Returns the session/status plus `ready` (safe to render protected content)
 * and `isAdmin`. Pages still render their own loading/return-null guards using
 * `status` / `ready`.
 */
export function useRequireAuth(options?: { admin?: boolean }) {
  const admin = options?.admin ?? false;
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (admin && status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/unauthorized");
    }
  }, [status, session, router, admin]);

  const isAdmin = session?.user?.role === "admin";
  const ready = status === "authenticated" && (!admin || isAdmin);

  return { session, status, isAdmin, ready };
}
