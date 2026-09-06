import { createFileRoute } from "@tanstack/react-router";
import { APP } from "@/lib/config";
import {
  bannerUrl,
  btn,
  sendMessage,
  sendPhoto,
  telegramWebhookSecret,
} from "@/lib/bot.server";
import { getCfg } from "@/lib/core.server";

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
        const secret =
          process.env["TELEGRAM_WEBHOOK_SECRET"] ?? (await telegramWebhookSecret());
        const receivedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (receivedSecret !== secret) {
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

        const caption = WELCOME(msg?.from?.first_name ?? "Tiger");
        const keyboard = [[btn.miniApp], [btn.community, btn.payment]];

        // Admin-configured banner wins; otherwise the bundled banner is used.
        // If Telegram cannot fetch the image we still deliver the text reply.
        let photo = "";
        try {
          const cfg = await getCfg();
          photo = (cfg.bannerUrl ?? "").trim();
        } catch (e) {
          console.error("webhook: config read failed", e);
        }
        if (!photo) photo = bannerUrl(new URL(request.url).origin);

        const sent = await sendPhoto(chatId, photo, caption, keyboard);
        const delivered = sent ?? (await sendMessage(chatId, caption, keyboard));
        if (!delivered) {
          console.error("webhook: failed to deliver /start reply", { chatId });
          return Response.json({ ok: false, error: "Telegram delivery failed" }, { status: 502 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
