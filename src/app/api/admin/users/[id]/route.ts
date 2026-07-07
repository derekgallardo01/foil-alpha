import { NextResponse } from "next/server";
import { getDbConnection } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/auth";
import type { RowDataPacket } from "mysql2/promise";

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
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { id: userId } = await context.params;
  const dbConnection = await getDbConnection();
  if (!dbConnection) {
    return NextResponse.json({ message: "Failed to connect to the database" }, { status: 500 });
  }

  try {
    const { name, email, role, subscriptionStatus } = await req.json();
    if (!name || !email || !role || !subscriptionStatus) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

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