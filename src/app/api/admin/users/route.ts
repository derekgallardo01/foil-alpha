import { NextResponse } from "next/server";
import { getDbConnection } from "../../../lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const dbConnection = await getDbConnection();
  if (!dbConnection) {
    return NextResponse.json({ message: "Failed to connect to the database" }, { status: 500 });
  }

  try {
    const [rows] = await dbConnection.execute(
      "SELECT id, name, email, role, registeredAt, last_login_at AS lastLoginAt, subscriptionStatus FROM users"
    );

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ message: "Error fetching users" }, { status: 500 });
  } finally {
    await dbConnection.end();
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const dbConnection = await getDbConnection();
  if (!dbConnection) {
    return NextResponse.json({ message: "Failed to connect to the database" }, { status: 500 });
  }

  try {
    const { name, email, role, subscriptionStatus, password } = await req.json();
    
    // Validate required fields
    if (!name || !email || !role || !subscriptionStatus || !password) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const [result] = await dbConnection.execute(
      "INSERT INTO users (name, email, role, subscriptionStatus, password, registeredAt) VALUES (?, ?, ?, ?, ?, NOW())",
      [name, email, role, subscriptionStatus, password]
    );
    const [newUser] = await dbConnection.execute(
      "SELECT id, name, email, role, registeredAt, last_login_at AS lastLoginAt, subscriptionStatus FROM users WHERE id = ?",
      [(result as any).insertId]
    );
    return NextResponse.json(newUser[0], { status: 201 });
  } catch (error) {
    console.error("Error adding user:", error);
    return NextResponse.json({ message: "Error adding user" }, { status: 500 });
  } finally {
    await dbConnection.end();
  }
}