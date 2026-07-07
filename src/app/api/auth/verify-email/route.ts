import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: Request) {
  const { email, code } = await req.json().catch(() => ({ email: undefined, code: undefined }));

  if (!email || !code) {
    return NextResponse.json({ message: "Email and code are required." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { verification_code: true, is_verified: true },
    });

    if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });
    if (user.is_verified) return NextResponse.json({ message: "Email already verified." }, { status: 400 });
    if (user.verification_code !== code) {
      return NextResponse.json({ message: "Invalid verification code." }, { status: 400 });
    }

    await prisma.user.update({
      where: { email },
      data: { is_verified: 1, verification_code: null },
    });

    return NextResponse.json({ message: "Email verified successfully." }, { status: 200 });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ message: "An error occurred while verifying the email." }, { status: 500 });
  }
}
