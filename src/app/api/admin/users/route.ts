import { NextResponse } from "next/server";
import { getDbConnection } from "../../../lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import type { OkPacket, RowDataPacket } from "mysql2"; // Import mysql2 types

// Define the User type for the SELECT query result
interface User extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role: string;
  registeredAt: Date;
  lastLoginAt: Date | null;
  subscriptionStatus: string;
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

    const [insertResult]: [OkPacket, unknown] = await dbConnection.execute(
      "INSERT INTO users (name, email, role, subscriptionStatus, password, registeredAt) VALUES (?, ?, ?, ?, ?, NOW())",
      [name, email, role, subscriptionStatus, password]
    );

    const [selectResult]: [RowDataPacket[], unknown] = await dbConnection.execute(
      "SELECT id, name, email, role, registeredAt, last_login_at AS lastLoginAt, subscriptionStatus FROM users WHERE id = ?",
      [insertResult.insertId]
    );

    const newUser = selectResult as User[];

    if (!newUser[0]) {
      return NextResponse.json({ message: "User not found after creation" }, { status: 500 });
    }

    return NextResponse.json(newUser[0], { status: 201 });
  } catch (error) {
    console.error("Error adding user:", error);
    return NextResponse.json({ message: "Error adding user" }, { status: 500 });
  } finally {
    await dbConnection.end();
  }
}