import { createFileRoute } from "@tanstack/react-router";
import { notifyFinishedMining } from "@/lib/core.server";

/**
 * Cron endpoint: pings users whose mining session finished while they were away.
 * Call it every few minutes from an external scheduler with the
 * `TELEGRAM_WEBHOOK_SECRET` value in the `x-cron-secret` header.
 */
export const Route = createFileRoute("/api/public/cron/mining")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["TELEGRAM_WEBHOOK_SECRET"] ?? "";
        const given =
          request.headers.get("x-cron-secret") ??
          new URL(request.url).searchParams.get("secret") ??
          "";
        if (!secret || given !== secret) return new Response("Unauthorized", { status: 401 });
        const notified = await notifyFinishedMining();
        return Response.json({ ok: true, notified });
      },
    },
  },
});
