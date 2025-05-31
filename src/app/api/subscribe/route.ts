import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();
    
    // TODO: Implement Constant Contact API integration
    // For now, we'll just simulate success
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    return NextResponse.json({
      success: true,
      message: "Successfully added to waitlist"
    });
  } catch (error) {
    console.error("Error in subscription:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}
