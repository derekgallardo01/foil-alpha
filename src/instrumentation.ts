/**
 * In-app scheduler (runs inside the single Next.js server instance).
 *
 * Gated behind ENABLE_IN_APP_CRON so it only runs where intended (not in dev
 * or build). Settles ended auctions on a short interval by calling the
 * CRON_SECRET-protected /api/process-auctions route — without this, auctions
 * never settle because nothing triggers that endpoint.
 *
 * Uses setInterval rather than node-cron so nothing Node-specific has to be
 * webpack-bundled into the instrumentation entry.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_IN_APP_CRON !== "true") return;

  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const secret = process.env.CRON_SECRET || "";

  const call = async (path: string) => {
    try {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      });
      console.log(`[cron] ${path} -> ${res.status}`);
    } catch (err) {
      console.error(`[cron] ${path} failed`, err);
    }
  };

  // Settle ended auctions every 2 minutes. First run shortly after boot.
  const AUCTION_INTERVAL_MS = 2 * 60 * 1000;
  setTimeout(() => void call("/api/process-auctions"), 20_000);
  setInterval(() => void call("/api/process-auctions"), AUCTION_INTERVAL_MS);

  console.log("[cron] in-app scheduler started — settling auctions every 2 minutes");
}
