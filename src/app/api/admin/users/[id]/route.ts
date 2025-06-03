import { NextResponse } from "next/server";
import { getDbConnection } from "../../../../lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]/route";
import type { RowDataPacket } from "mysql2/promise";

// Define the expected user row type, extending RowDataPacket
interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  role: string;
  registeredAt: Date;
  lastLoginAt: Date | null;
  subscriptionStatus: string;
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id: userId } = await context.params;
  const dbConnection = await getDbConnection();
  if (!dbConnection) {
    return NextResponse.json({ message: "Failed to connect to the database" }, { status: 500 });
  }

  try {
    const { name, email, role, subscriptionStatus } = await req.json();

    await dbConnection.execute(
      "UPDATE users SET name = ?, email = ?, role = ?, subscriptionStatus = ? WHERE id = ?",
      [name, email, role, subscriptionStatus, userId]
    );

    const [updatedRows] = await dbConnection.execute<UserRow[]>(
      "SELECT id, name, email, role, registeredAt, last_login_at AS lastLoginAt, subscriptionStatus FROM users WHERE id = ?",
      [userId]
    );

    if (updatedRows.length === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updatedRows[0], { status: 200 });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ message: "Error updating user" }, { status: 500 });
  } finally {
    await dbConnection.end();
  }
}