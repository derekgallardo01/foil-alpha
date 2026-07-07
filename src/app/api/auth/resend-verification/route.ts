import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { sendEmail } from "../../../lib/email";
import { DEV_BYPASS, mockSendEmail } from "../../../lib/dev-bypass";

/**
 * POST /api/auth/resend-verification { email }
 * Regenerates a verification code and re-sends it. Responds generically so it
 * can't be used to probe which emails have accounts.
 */
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({ email: undefined }));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  const generic = "If that account exists and isn't verified, a new code is on its way.";

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { is_verified: true } });
    if (!user) return NextResponse.json({ message: generic });
    if (user.is_verified) {
      return NextResponse.json({ message: "This email is already verified — you can sign in." });
    }

    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await prisma.user.update({ where: { email }, data: { verification_code: verificationCode } });

    const html = `
      <h2>Email Verification</h2>
      <p>Here is your new Foil Alpha verification code:</p>
      <p style="font-size:20px"><strong>${verificationCode}</strong></p>
      <p>Enter it on the verification page to activate your account.</p>`;
    try {
      if (DEV_BYPASS.SKIP_EMAIL_SENDING) await mockSendEmail(email, html);
      else if (process.env.ENABLE_EMAIL === "true") await sendEmail(email, "Your Foil Alpha verification code", html);
      else console.log("Email disabled - resent verification code:", verificationCode);
    } catch (emailError) {
      console.error("Resend email failed:", emailError);
      // Code is stored; the user can retry. Don't fail the request on email.
    }

    return NextResponse.json({ message: generic });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ message: "Could not resend the code. Please try again." }, { status: 500 });
  }
}
