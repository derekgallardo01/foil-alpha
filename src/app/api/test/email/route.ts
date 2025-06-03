import { NextResponse } from "next/server";
import { sendEmail } from '@/app/lib/email';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const to = searchParams.get('to') || 'derekgallardo01@gmail.com';
    const subject = searchParams.get('subject') || 'Test Email from TCG Market';
    const body = searchParams.get('body') || '<h1>Test Email</h1><p>This is a test email sent from the TCG Market application using Gmail API.</p>';

    const result = await sendEmail(to, subject, body);
    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      data: result
    });
  } catch (error) {
    console.error("Test email API error:", error);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}
