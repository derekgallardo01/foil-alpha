import { NextResponse } from "next/server";
import { getDbConnection } from "../../../../lib/db"; // Adjust path as needed
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]/route";

// Correctly destructure params with async
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id: userId } = await context.params; // Await params and destructure id
  const dbConnection = await getDbConnection();
  if (!dbConnection) {
    return NextResponse.json({ message: "Failed to connect to the database" }, { status: 500 });
  }

  try {
    const { name, email, role, subscriptionStatus } = await req.json();

    // Update the user
    await dbConnection.execute(
      "UPDATE users SET name = ?, email = ?, role = ?, subscriptionStatus = ? WHERE id = ?",
      [name, email, role, subscriptionStatus, userId]
    );

    // Fetch the updated user
    const [updatedRows] = await dbConnection.execute(
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

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id: userId } = await context.params; // Await params and destructure id
  const dbConnection = await getDbConnection();
  try {
    const [result] = await dbConnection.execute("DELETE FROM users WHERE id = ?", [userId]);
    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "User deleted" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ message: "Error deleting user" }, { status: 500 });
  } finally {
    await dbConnection.end();
  }
}