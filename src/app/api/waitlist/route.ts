import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../lib/auth";

interface WaitlistEntry {
  id: number;
  email: string;
  name: string;
  phone_number: string | null;
  status: string | null;
  source: string | null;
  created_at: Date | null;
  metadata: Record<string, unknown> | null;
}

// GET /api/admin/waitlist - Get all waitlist entries
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    // If email is provided, get single entry (keeping backward compatibility)
    if (email) {
      const waitlistEntry = await prisma.waitlist.findUnique({
        where: { email },
      });

      if (!waitlistEntry) {
        return NextResponse.json({
          found: false,
          message: "Email not found in waitlist",
        });
      }

      return NextResponse.json({
        found: true,
        data: {
          id: waitlistEntry.id,
          email: waitlistEntry.email,
          name: waitlistEntry.name,
          phone_number: waitlistEntry.phone_number,
          status: waitlistEntry.status,
          source: waitlistEntry.source,
          created_at: waitlistEntry.created_at,
          metadata: waitlistEntry.metadata,
        },
      });
    }

    // Otherwise, get all entries for admin page
    const entries = await prisma.waitlist.findMany({
      orderBy: { created_at: 'desc' },
    });

    console.log(`Found ${entries.length} waitlist entries`);

    return NextResponse.json({ entries });

  } catch (error) {
    console.error("Error fetching waitlist entries:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/waitlist - Delete a waitlist entry
export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID parameter is required" },
        { status: 400 }
      );
    }

    console.log(`Deleting waitlist entry with id=${id}`);

    const deletedEntry = await prisma.waitlist.delete({
      where: { id: parseInt(id) },
    });

    console.log(`Successfully deleted waitlist entry: ${deletedEntry.email}`);

    return NextResponse.json({
      success: true,
      message: `Deleted waitlist entry for ${deletedEntry.email}`,
    });

  } catch (error) {
    console.error("Error deleting waitlist entry:", error);
    return NextResponse.json(
      { error: "Failed to delete waitlist entry" },
      { status: 500 }
    );
  }
}

// POST /api/admin/waitlist - Update waitlist entry status
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID and status are required" },
        { status: 400 }
      );
    }

    const updatedEntry = await prisma.waitlist.update({
      where: { id: parseInt(id) },
      data: { status },
    });

    console.log(`Updated waitlist entry ${id} status to ${status}`);

    return NextResponse.json({
      success: true,
      data: updatedEntry,
    });

  } catch (error) {
    console.error("Error updating waitlist entry:", error);
    return NextResponse.json(
      { error: "Failed to update waitlist entry" },
      { status: 500 }
    );
  }
}