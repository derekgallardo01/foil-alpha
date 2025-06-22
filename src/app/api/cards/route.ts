import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "../../lib/prisma";

// Response interface
interface CardResponse {
  id: string;
  name: string;
  set_name: string;
  set_number: string | null; // Made nullable to match Prisma schema
  rarity: string;
  card_type: string | null; // Made nullable to match Prisma schema
  imageUrl: string | null;
  createdAt: Date;
}

// POST/PUT body interfaces
interface CreateCardBody {
  name: string;
  set_name: string;
  set_number?: string | null; // Made optional to align with schema
  rarity: string;
  card_type?: string | null; // Made optional to align with schema
  imageUrl?: string | null;
}

interface UpdateCardBody {
  name?: string;
  set_name?: string;
  set_number?: string | null; // Made nullable
  rarity?: string;
  card_type?: string | null; // Made nullable
  imageUrl?: string | null;
}

// GET /api/cards - fetch all cards
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cardsFromDb = await prisma.card.findMany({
      select: {
        id: true,
        name: true,
        set_name: true,
        set_number: true,
        rarity: true,
        card_type: true,
        image_url: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // Map DB records to CardResponse format
    const cards: CardResponse[] = cardsFromDb.map((c) => ({
      id: c.id.toString(),
      name: c.name,
      set_name: c.set_name,
      set_number: c.set_number,
      rarity: c.rarity,
      card_type: c.card_type,
      imageUrl: c.image_url ?? null,
      createdAt: c.created_at,
    }));

    return NextResponse.json({ cards }, { status: 200 });
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/cards - create a new card
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: CreateCardBody = await request.json();

    // Validate required fields
    if (!body.name || !body.set_name || !body.rarity) {
      return NextResponse.json({ error: "Name, set_name, and rarity are required" }, { status: 400 });
    }

    const newCard = await prisma.card.create({
      data: {
        name: body.name,
        set_name: body.set_name,
        set_number: body.set_number ?? null,
        rarity: body.rarity,
        card_type: body.card_type ?? null,
        image_url: body.imageUrl ?? null,
      },
      select: {
        id: true,
        name: true,
        set_name: true,
        set_number: true,
        rarity: true,
        card_type: true,
        image_url: true,
        created_at: true,
      },
    });

    const card: CardResponse = {
      id: newCard.id.toString(),
      name: newCard.name,
      set_name: newCard.set_name,
      set_number: newCard.set_number,
      rarity: newCard.rarity,
      card_type: newCard.card_type,
      imageUrl: newCard.image_url ?? null,
      createdAt: newCard.created_at,
    };

    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    console.error("Error creating card:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/cards?id=... - update existing card
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Card ID is required" }, { status: 400 });
    }

    const body: UpdateCardBody = await request.json();

    // Explicitly build update object
    type CardUpdateData = {
      name?: string;
      set_name?: string;
      set_number?: string | null;
      rarity?: string;
      card_type?: string | null;
      image_url?: string | null;
    };

    const dataToUpdate: CardUpdateData = {};
    if (body.name !== undefined) dataToUpdate.name = body.name;
    if (body.set_name !== undefined) dataToUpdate.set_name = body.set_name;
    if (body.set_number !== undefined) dataToUpdate.set_number = body.set_number;
    if (body.rarity !== undefined) dataToUpdate.rarity = body.rarity;
    if (body.card_type !== undefined) dataToUpdate.card_type = body.card_type;
    if (body.imageUrl !== undefined) dataToUpdate.image_url = body.imageUrl;

    const updatedCard = await prisma.card.update({
      where: { id: Number(id) },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        set_name: true,
        set_number: true,
        rarity: true,
        card_type: true,
        image_url: true,
        created_at: true,
      },
    });

    const card: CardResponse = {
      id: updatedCard.id.toString(),
      name: updatedCard.name,
      set_name: updatedCard.set_name,
      set_number: updatedCard.set_number,
      rarity: updatedCard.rarity,
      card_type: updatedCard.card_type,
      imageUrl: updatedCard.image_url ?? null,
      createdAt: updatedCard.created_at,
    };

    return NextResponse.json({ card }, { status: 200 });
  } catch (error) {
    console.error("Error updating card:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/cards?id=... - delete a card
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Card ID is required" }, { status: 400 });
    }

    await prisma.card.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "Card deleted" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting card:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}