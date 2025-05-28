import { NextRequest, NextResponse } from "next/server";

const channelId = "1350526438972850276";
const botToken = process.env.DISCORD_BOT_TOKEN;

export async function GET(req: NextRequest) {
  if (!botToken) {
    console.error("Bot token not configured");
    return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
  }
  try {
    console.log("Fetching Discord messages for channel:", channelId);
    const cacheBuster = Date.now(); // Unique timestamp for each request
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=50&_=${cacheBuster}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    const data = await response.json();
    console.log("Raw Discord GET response:", data);
    if (!response.ok) {
      console.error("Discord API GET error:", data.message);
      throw new Error(data.message || "Failed to fetch messages");
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("GET fetch error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!botToken) {
    console.error("Bot token not configured");
    return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
  }
  try {
    const { content } = await req.json();
    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required and must be a string" }, { status: 400 });
    }
    console.log("Sending message to Discord channel:", channelId, "Content:", content);
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      }
    );
    const data = await response.json();
    console.log("Raw Discord POST response:", data);
    if (!response.ok) {
      console.error("Discord API POST error:", data.message);
      throw new Error(data.message || "Failed to send message");
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("POST fetch error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}