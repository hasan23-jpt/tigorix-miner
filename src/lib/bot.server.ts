/** Telegram Bot API helpers + initData verification. Server only. */
import { APP } from "./config";
import banner from "@/assets/tigorix-banner.png.asset.json";

export function botToken() {
  const t = process.env["TELEGRAM_BOT_TOKEN"];
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return t.trim();
}

const API = () => `https://api.telegram.org/bot${botToken()}`;

export async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || json.ok === false) {
    console.error(`Telegram ${method} failed [${res.status}]: ${json.description ?? ""}`);
    return null;
  }
  return json as { ok: true; result: unknown };
}

export const btn = {
  miniApp: { text: "🚀 Open Mini App", url: APP.miniAppLink },
  community: { text: "📣 Community", url: APP.communityChannel },
  payment: { text: "💸 Payment Proofs", url: APP.paymentChannel },
};

export function bannerUrl(origin: string) {
  return `${origin}${banner.url}`;
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  keyboard?: { text: string; url: string }[][]
) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export async function sendPhoto(
  chatId: string | number,
  photo: string,
  caption: string,
  keyboard?: { text: string; url: string }[][]
) {
  const r = await tg("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
  if (!r) return sendMessage(chatId, caption, keyboard);
  return r;
}

export async function notifyAdmin(text: string, keyboard?: { text: string; url: string }[][]) {
  return sendMessage(APP.adminTelegramId, text, keyboard);
}

/** Returns true when the user is a member of the given channel. */
export async function isChannelMember(chatId: string, userId: string | number) {
  const res = await fetch(
    `${API()}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${userId}`
  );
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { status?: string };
  };
  if (!json.ok || !json.result?.status) return false;
  return ["creator", "administrator", "member", "restricted"].includes(json.result.status);
}

async function hmac(keyData: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey(
    "raw",
    keyData as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
}

function hex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type AuthUser = {
  id: string;
  username: string;
  firstName: string;
  photoUrl: string;
  languageCode: string;
  startParam: string;
};

/** Verifies Telegram WebApp initData signature; throws when invalid. */
export async function verifyInitData(initData: string): Promise<AuthUser> {
  if (!initData) {
    if (process.env["NODE_ENV"] !== "production") {
      return {
        id: APP.adminTelegramId,
        username: "preview_admin",
        firstName: "Preview",
        photoUrl: "",
        languageCode: "en",
        startParam: "",
      };
    }
    throw new Error("Missing Telegram session");
  }
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  params.delete("hash");
  const dataCheck = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = await hmac(new TextEncoder().encode("WebAppData"), botToken());
  const signature = hex(await hmac(secret, dataCheck));
  if (signature !== hash) throw new Error("Invalid Telegram signature");

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 60 * 60 * 24)
    throw new Error("Telegram session expired, please reopen the app");

  const user = JSON.parse(params.get("user") ?? "{}") as {
    id?: number;
    username?: string;
    first_name?: string;
    photo_url?: string;
    language_code?: string;
  };
  if (!user.id) throw new Error("Telegram user not found");
  return {
    id: String(user.id),
    username: user.username ?? "",
    firstName: user.first_name ?? "Tiger",
    photoUrl: user.photo_url ?? "",
    languageCode: user.language_code ?? "en",
    startParam: params.get("start_param") ?? "",
  };
}