import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDbConnection } from "../../../lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise"; // Import ResultSetHeader

// Define the type for the token row
interface TokenRow extends RowDataPacket {
  email: string;
}

export async function POST(req: NextRequest) {
  const connection = await getDbConnection();

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ message: "Token and password are required" }, { status: 400 });
    }

    // Execute the query and type the result
    const [tokens] = await connection.execute<TokenRow[]>(
      "SELECT email FROM reset_tokens WHERE token = ? AND expires > NOW()",
      [token]
    );

    if (tokens.length === 0) {
      return NextResponse.json({ message: "Invalid or expired token" }, { status: 400 });
    }

    const email = tokens[0].email;
    const hashedPassword = await bcrypt.hash(password, 12);

    // Type the UPDATE query result as ResultSetHeader
    const [updateResult] = await connection.execute<ResultSetHeader>(
      "UPDATE users SET password = ? WHERE email = ?",
      [hashedPassword, email]
    );
    if (updateResult.affectedRows === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 400 });
    }

    await connection.execute("DELETE FROM reset_tokens WHERE token = ?", [token]);
    console.log(`Password reset for ${email} with token ${token}`);

    return NextResponse.json({ message: "Password reset successfully", email }, { status: 200 });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { message: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  } finally {
    await connection.end();
  }
}