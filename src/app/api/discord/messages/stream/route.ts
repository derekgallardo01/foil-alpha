import { NextRequest } from "next/server";

const channelId = "1350526438972850276";
const botToken = process.env.DISCORD_BOT_TOKEN;

export async function GET(req: NextRequest) {
  if (!botToken) {
    return new Response("Bot token not configured", { status: 500 });
  }

  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendMessages = async () => {
        try {
          console.log("SSE: Fetching messages for channel:", channelId);
          const response = await fetch(
            `https://discord.com/api/v10/channels/${channelId}/messages?limit=50`,
            { headers: { Authorization: `Bot ${botToken}` } }
          );
          const data = await response.json();
          console.log("SSE: Raw Discord response:", data);
          if (!response.ok) throw new Error(data.message || "Failed to fetch messages");
          const eventData = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(eventData));
        } catch (error) {
          const errorData = `data: ${JSON.stringify({ error: (error as Error).message })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        }
      };

      await sendMessages();
      const interval = setInterval(sendMessages, 2000);

      req.signal.addEventListener("abort", () => {
        console.log("SSE: Client disconnected, closing stream");
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, { headers });
}