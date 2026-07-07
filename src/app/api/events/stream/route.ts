import { NextRequest } from "next/server";
import { getAuthUser } from "../../../lib/auth";
import { onAppEvent, type AppEvent } from "../../../lib/events";

// Long-lived connection; never statically generate, no buffering.
export const dynamic = "force-dynamic";

/**
 * GET /api/events/stream — Server-Sent Events channel for real-time updates.
 *
 * Broadcasts auction-wide events (new bids, auctions ending) to every client and
 * delivers user-targeted events (outbid, auction won, notifications) only to the
 * intended user. Clients (EventSource) auto-reconnect, and the pages keep a slow
 * fallback poll, so a dropped stream degrades gracefully.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  const userId = user ? user.id : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      // Initial hello so the client knows the stream is live.
      send({ type: "connected" });

      const unsubscribe = onAppEvent((event: AppEvent) => {
        // User-targeted events go only to their user; the rest are broadcast.
        if (event.userId != null && event.userId !== userId) return;
        try {
          send(event);
        } catch {
          /* controller closed */
        }
      });

      // Keep-alive comment every 25s so proxies don't time the connection out.
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
