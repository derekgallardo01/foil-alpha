// /var/www/my-next-app/src/app/api/auth/login/route.ts

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDbConnection } from "../../../lib/db"; // Adjust the path to your db connection logic
import type { RowDataPacket } from "mysql2/promise"; // Import RowDataPacket for typing

interface User extends RowDataPacket {
  id: number;
  email: string;
  name: string;
  password: string;
}

export async function POST(req: Request) {
  console.log("Login request received");

  const { email, password } = await req.json();
  console.log("Email received:", email);
  console.log("Password received:", password);

  if (!email || !password) {
    console.log("Missing email or password");
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  let connection;
  try {
    connection = await getDbConnection();
  } catch (dbError) {
    console.error("Database connection error:", dbError);
    return NextResponse.json({ message: "Database connection error." }, { status: 500 });
  }

  try {
    // Fetch user from the database by email with explicit typing
    console.log("Fetching user from DB by email:", email);
    const [rows] = await connection.execute<User[]>("SELECT * FROM users WHERE email = ?", [email]);
    console.log("User fetched from DB:", rows);

    // Check if user exists
    if (rows.length === 0) {
      console.log("User not found for email:", email);
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const user = rows[0];
    console.log("User found in DB:", user);

    // Compare the hashed password
    console.log("Comparing passwords...");
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password validation result:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("Invalid password for email:", email);
      return NextResponse.json({ message: "Invalid password" }, { status: 403 });
    }

    console.log("Login successful for email:", email);
    return NextResponse.json(
      { message: "Login successful", user: { id: user.id, email: user.email, name: user.name } },
      { status: 200 }
    );
  } catch (error) {
    console.error("An error occurred during the login process:", error);
    return NextResponse.json({ message: "An error occurred while logging in." }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
      console.log("Database connection closed");
    }
  }
}