import { createFileRoute } from "@tanstack/react-router";
import { REQUIRED_CHANNELS } from "@/lib/config";
import { chatPhoto } from "@/lib/bot.server";

// Serves the profile photo of an allow-listed channel only.
export const Route = createFileRoute("/api/public/chat-photo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const c = new URL(request.url).searchParams.get("c") ?? "";
        if (!REQUIRED_CHANNELS.some((x) => x.id === c)) return new Response("Not found", { status: 404 });
        const p = await chatPhoto(`@${c}`).catch(() => null);
        if (!p) return new Response("Not found", { status: 404 });
        return new Response(p.body, {
          headers: { "Content-Type": p.type, "Cache-Control": "public, max-age=86400" },
        });
      },
    },
  },
});
