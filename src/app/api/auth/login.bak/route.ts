// /var/www/my-next-app/src/app/api/auth/login/route.ts

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDbConnection } from "../../../lib/db"; // Adjust the path to your db connection logic

export async function POST(req: Request) {
  // Log the start of the login request
  console.log("Login request received");

  // Get email and password from the request body
  const { email, password } = await req.json();
  console.log("Email received:", email); // Log the email received in the request
  console.log("Password received:", password); // Log the password received (make sure this is safe to log in production)

  // Validate input
  if (!email || !password) {
    console.log("Missing email or password");
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  // Get database connection
  let connection;
  try {
    connection = await getDbConnection();
  } catch (dbError) {
    console.error("Database connection error:", dbError);
    return NextResponse.json({ message: "Database connection error." }, { status: 500 });
  }

  try {
    // Fetch user from the database by email
    console.log("Fetching user from DB by email:", email);
    const [rows] = await connection.execute("SELECT * FROM users WHERE email = ?", [email]);
    console.log("User fetched from DB:", rows); // Log the user data (ensure this doesn't contain sensitive info)

    // Check if user exists
    if (rows.length === 0) {
      console.log("User not found for email:", email);
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const user = rows[0];
    console.log("User found in DB:", user); // Log the user details (excluding sensitive info like password)

    // Compare the hashed password with the one in the database
    console.log("Comparing passwords...");
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password validation result:", isPasswordValid); // Log if the password is valid

    if (!isPasswordValid) {
      console.log("Invalid password for email:", email);
      return NextResponse.json({ message: "Invalid password" }, { status: 403 });
    }

    // Successful login - you can add session management or token here
    console.log("Login successful for email:", email);
    return NextResponse.json(
      { message: "Login successful", user: { id: user.id, email: user.email, name: user.name } },
      { status: 200 }
    );
  } catch (error) {
    console.error("An error occurred during the login process:", error);
    return NextResponse.json({ message: "An error occurred while logging in." }, { status: 500 });
  } finally {
    // Ensure the database connection is always closed
    if (connection) {
      await connection.end();
      console.log("Database connection closed");
    }
  }
}
