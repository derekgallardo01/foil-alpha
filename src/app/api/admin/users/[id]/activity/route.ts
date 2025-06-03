// src/app/api/admin/users/[id]/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verify } from "jsonwebtoken";
import prisma from '@/app/lib/prisma'; // Adjust path to your Prisma client

// Define the activity log entry type (matches client-side expectation)
interface ActivityLogEntry {
  id: number;
  userId: number;
  action: string;
  timestamp: string;
}

// Verify admin access
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;

  try {
    const decoded = verify(token, process.env.JWT_SECRET || "your-secret-key") as { role: string };
    return decoded.role === "admin";
  } catch (_) {
    return false;
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = parseInt(params.id, 10);

  // Verify admin access
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Fetch activity log from MySQL using Prisma
    const activities = await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 50, // Limit to 50 entries for performance
    });

    // Map to match client-expected format
    const response: ActivityLogEntry[] = activities.map((activity) => ({
      id: activity.id,
      userId: activity.userId,
      action: activity.action,
      timestamp: activity.timestamp.toISOString(),
    }));

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error fetching activity log:", error);
    return NextResponse.json({ error: "Failed to fetch activity log" }, { status: 500 });
  }
}