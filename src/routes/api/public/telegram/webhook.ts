import { createFileRoute } from "@tanstack/react-router";
import { APP } from "@/lib/config";
import { bannerUrl, btn, sendPhoto } from "@/lib/bot.server";

function webhookSecret() {
  return process.env["TELEGRAM_WEBHOOK_SECRET"] ?? "";
}

const WELCOME = (name: string) =>
  `🐯 <b>Welcome to Tigorix, ${name}!</b>\n\n` +
  `💎 Mine <b>TGX</b> tokens every hour, complete tasks, watch ads and refer friends.\n` +
  `🪙 <b>${APP.tokensPerUsd.toLocaleString("en-US")} TGX = $1</b> — withdraw in USDT (BEP-20).\n` +
  `🎁 Daily rewards, reward codes and partner bonuses every single day.\n\n` +
  `👇 Tap below to start earning!`;

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = webhookSecret();
        if (
          secret &&
          request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret
        ) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json().catch(() => null)) as {
          message?: {
            chat?: { id?: number };
            from?: { first_name?: string };
            text?: string;
          };
        } | null;

        const msg = update?.message;
        const chatId = msg?.chat?.id;
        if (!chatId) return Response.json({ ok: true });

        const text = (msg?.text ?? "").trim();
        if (!text.startsWith("/start")) return Response.json({ ok: true });

        const origin = new URL(request.url).origin;
        await sendPhoto(chatId, bannerUrl(origin), WELCOME(msg?.from?.first_name ?? "Tiger"), [
          [btn.miniApp],
          [btn.community, btn.payment],
        ]);

        return Response.json({ ok: true });
      },
    },
  },
});