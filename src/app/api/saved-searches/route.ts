import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import type { SavedSearchQuery } from "../../lib/saved-search";

export const dynamic = "force-dynamic";

const MAX_PER_USER = 25;

/** GET /api/saved-searches — the user's saved searches. */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const searches = await prisma.savedSearch.findMany({
    where: { user_id: auth.user.id },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json({
    success: true,
    data: searches.map((s) => ({ id: s.id, name: s.name, query: s.query, created_at: s.created_at })),
  });
}

/** POST /api/saved-searches { name, query } — save a marketplace filter. */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const user = auth.user;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const raw = (body.query ?? {}) as Record<string, unknown>;
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  // Whitelist + coerce the query fields; drop empties so a wildcard stays wildcard.
  const query: SavedSearchQuery = {};
  if (typeof raw.search === "string" && raw.search.trim()) query.search = raw.search.trim().slice(0, 100);
  if (typeof raw.set === "string" && raw.set.trim()) query.set = raw.set.trim().slice(0, 120);
  if (typeof raw.rarity === "string" && raw.rarity.trim()) query.rarity = raw.rarity.trim().slice(0, 60);
  if (raw.price_min != null && Number.isFinite(Number(raw.price_min))) query.price_min = Number(raw.price_min);
  if (raw.price_max != null && Number.isFinite(Number(raw.price_max))) query.price_max = Number(raw.price_max);

  const count = await prisma.savedSearch.count({ where: { user_id: user.id } });
  if (count >= MAX_PER_USER) {
    return NextResponse.json({ error: `You can save up to ${MAX_PER_USER} searches.` }, { status: 400 });
  }

  const created = await prisma.savedSearch.create({
    data: { user_id: user.id, name, query: query as object },
  });
  return NextResponse.json({ success: true, data: { id: created.id, name: created.name, query } }, { status: 201 });
}

/** DELETE /api/saved-searches?id=X */
export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id is required." }, { status: 400 });

  await prisma.savedSearch.deleteMany({ where: { id, user_id: auth.user.id } });
  return NextResponse.json({ success: true });
}
