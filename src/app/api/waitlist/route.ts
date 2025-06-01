import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({
        error: 'Email parameter is required'
      }, { status: 400 });
    }

    const waitlistEntry = await prisma.waitlist.findUnique({
      where: { email }
    });

    if (!waitlistEntry) {
      return NextResponse.json({
        found: false,
        message: 'Email not found in waitlist'
      });
    }

    return NextResponse.json({
      found: true,
      data: {
        id: waitlistEntry.id,
        email: waitlistEntry.email,
        name: waitlistEntry.name,
        status: waitlistEntry.status,
        source: waitlistEntry.source,
        createdAt: waitlistEntry.created_at,
        metadata: waitlistEntry.metadata
      }
    });

  } catch (error) {
    console.error('Error verifying waitlist entry:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
