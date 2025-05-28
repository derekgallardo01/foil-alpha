import { NextResponse } from "next/server";
import { getDbConnection } from "../../../lib/db";

export async function POST(req: Request) {
  const { email, code } = await req.json();

  // Validate input
  if (!email || !code) {
    return NextResponse.json({ message: "Email and code are required." }, { status: 400 });
  }

  const connection = await getDbConnection();

  try {
    // Check user and code
    const [rows]: [any[], any] = await connection.execute(
      "SELECT verification_code, is_verified FROM users WHERE email = ?",
      [email]
    );
    if (rows.length === 0) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const user = rows[0];
    if (user.is_verified) {
      return NextResponse.json({ message: "Email already verified." }, { status: 400 });
    }
    if (user.verification_code !== code) {
      return NextResponse.json({ message: "Invalid verification code." }, { status: 400 });
    }

    // Mark user as verified
    await connection.execute(
      "UPDATE users SET is_verified = 1, verification_code = NULL WHERE email = ?",
      [email]
    );

    return NextResponse.json({ message: "Email verified successfully." }, { status: 200 });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ message: "An error occurred while verifying the email." }, { status: 500 });
  } finally {
    await connection.end();
  }
}