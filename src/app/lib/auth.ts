import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "../api/auth/[...nextauth]/route";

/**
 * Server-side auth helpers for API route handlers. Use these instead of
 * hardcoded/placeholder users. Pattern in a route:
 *
 *   const auth = await requireAdmin();
 *   if ("response" in auth) return auth.response;
 *   const user = auth.user; // { id, role, ... }
 */

export interface AuthUser {
  id: number;
  role: string;
  name?: string | null;
  email?: string | null;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as
    | { id?: string | number; role?: string; name?: string | null; email?: string | null }
    | undefined;
  if (!u?.id) return null;
  return { id: Number(u.id), role: u.role ?? "user", name: u.name, email: u.email };
}

export async function requireUser(): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const user = await getAuthUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

export async function requireAdmin(): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const user = await getAuthUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin") {
    return { response: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { user };
}
