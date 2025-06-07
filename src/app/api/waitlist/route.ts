import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface WaitlistResponseData {
  id: number;
  email: string;
  name: string;
  phone_number?: string | null;
  status: string;
  source: string;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
}

interface SuccessResponse {
  found: true;
  data: WaitlistResponseData;
}

interface NotFoundResponse {
  found: false;
  message: string;
}

interface ErrorResponse {
  error: string;
}

interface ErrorWithMessage extends Error {
  message: string;
  stack?: string;
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return typeof error === "object" && error !== null && "message" in error;
}

export async function GET(request: Request) {
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      console.log(`[${timestamp}] Validation failed: Email parameter is required`);
      return NextResponse.json<ErrorResponse>(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    console.log(`[${timestamp}] Verifying waitlist entry for email=${email}`);

    const waitlistEntry = await prisma.waitlist.findUnique({
      where: { email },
    });

    if (!waitlistEntry) {
      console.log(`[${timestamp}] Email not found in waitlist: email=${email}`);
      return NextResponse.json<NotFoundResponse>({
        found: false,
        message: "Email not found in waitlist",
      });
    }

    console.log(`[${timestamp}] Waitlist entry found: id=${waitlistEntry.id}`);

    return NextResponse.json<SuccessResponse>({
      found: true,
      data: {
        id: waitlistEntry.id,
        email: waitlistEntry.email,
        name: waitlistEntry.name,
        phone_number: waitlistEntry.phone_number ?? null,
        status: waitlistEntry.status,
        source: waitlistEntry.source,
        createdAt: waitlistEntry.created_at,
        metadata: (typeof waitlistEntry.metadata === "object" && waitlistEntry.metadata !== null
          ? waitlistEntry.metadata
          : null) as Record<string, unknown> | null,
      },
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : String(error);
    console.error(`[${timestamp}] Error verifying waitlist entry:`, {
      message: errorMessage,
      stack: isErrorWithMessage(error) ? error.stack : undefined,
    });
    return NextResponse.json<ErrorResponse>(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect().catch((err) => {
      console.error(`[${timestamp}] Failed to disconnect Prisma client:`, err);
    });
  }
}