import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const entries = await prisma.waitlist.findMany({
      orderBy: {
        created_at: "desc"
      },
      select: {
        id: true,
        email: true,
        name: true,
        created_at: true,
        status: true,
        source: true,
        metadata: true
      }
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching waitlist entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch waitlist entries" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    await prisma.waitlist.delete({
      where: { id: Number(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting waitlist entry:", error);
    return NextResponse.json(
      { error: "Failed to delete waitlist entry" },
      { status: 500 }
    );
  }
}
