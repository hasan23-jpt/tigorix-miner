/** Partner channel promotions: bot posts localized messages with the admin's referral link. */
import { APP } from "./config";
import { deleteDoc, getDoc, queryDocs, setDoc } from "./fsdb.server";
import { sendMessage, sendPhoto, tg } from "./bot.server";

export const PARTNER_LANGS = ["en", "si", "ru", "hi", "bn"] as const;
export type PartnerLang = (typeof PARTNER_LANGS)[number];

export type PartnerDoc = {
  id: string;
  chat: string;
  name: string;
  lang: PartnerLang;
  active: boolean;
  lastSentAt?: number;
  lastStatus?: string;
};

const DEFAULT_TEXT: Record<PartnerLang, string> = {
  en: "🐯 <b>Tigorix is live!</b>\n\n⛏ Mine TGX every hour\n🎁 Daily rewards & tasks\n💸 Withdraw real USDT (BEP-20)\n\n👇 Tap below and start earning now!",
  si: "🐯 <b>Tigorix දැන් live!</b>\n\n⛏ හැම පැයකම TGX mine කරන්න\n🎁 දිනපතා rewards සහ tasks\n💸 සැබෑ USDT (BEP-20) withdraw කරන්න\n\n👇 පහළ බොත්තම ඔබා දැන්ම උපයන්න!",
  ru: "🐯 <b>Tigorix запущен!</b>\n\n⛏ Майните TGX каждый час\n🎁 Ежедневные награды и задания\n💸 Выводите реальные USDT (BEP-20)\n\n👇 Нажмите ниже и начните зарабатывать!",
  hi: "🐯 <b>Tigorix लाइव है!</b>\n\n⛏ हर घंटे TGX माइन करें\n🎁 रोज़ाना इनाम और टास्क\n💸 असली USDT (BEP-20) निकालें\n\n👇 नीचे टैप करें और कमाना शुरू करें!",
  bn: "🐯 <b>Tigorix এখন লাইভ!</b>\n\n⛏ প্রতি ঘণ্টায় TGX মাইন করুন\n🎁 দৈনিক পুরস্কার ও টাস্ক\n💸 আসল USDT (BEP-20) তুলুন\n\n👇 নিচে ট্যাপ করে এখনই আয় শুরু করুন!",
};

const BTN: Record<PartnerLang, { start: string; community: string }> = {
  en: { start: "🚀 Start Earning", community: "📣 Community" },
  si: { start: "🚀 උපයන්න පටන් ගන්න", community: "📣 Community" },
  ru: { start: "🚀 Начать зарабатывать", community: "📣 Сообщество" },
  hi: { start: "🚀 कमाई शुरू करें", community: "📣 कम्युनिटी" },
  bn: { start: "🚀 আয় শুরু করুন", community: "📣 কমিউনিটি" },
};

const CHAT_RE = /^(@[A-Za-z][A-Za-z0-9_]{3,31}|-100\d{6,15})$/;

export function normalizeChat(raw: string) {
  let c = String(raw ?? "").trim();
  const m = c.match(/^https?:\/\/t\.me\/([A-Za-z0-9_]+)\/?$/i);
  if (m) c = `@${m[1]}`;
  if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(c)) c = `@${c}`;
  if (!CHAT_RE.test(c)) throw new Error("Invalid channel — use @username, t.me link or -100… id");
  return c;
}

const idOf = (chat: string) => chat.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60);
const refLink = () => `${APP.miniAppLink}?startapp=${APP.adminTelegramId}`;

export async function listPartners() {
  return (await queryDocs<PartnerDoc>("partners", { limit: 500 })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export async function savePartner(input: { chat: string; name: string; lang: string; active: boolean }) {
  const chat = normalizeChat(input.chat);
  const lang = (PARTNER_LANGS as readonly string[]).includes(input.lang) ? (input.lang as PartnerLang) : "en";
  const id = idOf(chat);
  await setDoc(`partners/${id}`, {
    id,
    chat,
    name: String(input.name ?? "").trim().slice(0, 60) || chat,
    lang,
    active: !!input.active,
  });
  return { ok: true, id };
}

export async function removePartner(id: string) {
  if (!/^[A-Za-z0-9_]{1,60}$/.test(id)) throw new Error("Bad id");
  await deleteDoc(`partners/${id}`);
  return { ok: true };
}

let botId = 0;
async function botIsAdmin(chat: string) {
  if (!botId) {
    const me = (await tg("getMe", {})) as { result?: { id?: number } } | null;
    botId = me?.result?.id ?? 0;
  }
  if (!botId) return false;
  const r = (await tg("getChatMember", { chat_id: chat, user_id: botId })) as {
    result?: { status?: string; can_post_messages?: boolean };
  } | null;
  const s = r?.result?.status;
  return s === "creator" || s === "administrator";
}

export async function checkPartner(id: string) {
  const p = await getDoc<PartnerDoc>(`partners/${id}`);
  if (!p) throw new Error("Partner not found");
  const ok = await botIsAdmin(p.chat);
  await setDoc(`partners/${id}`, { lastStatus: ok ? "bot admin ✅" : "bot not admin ❌" });
  return { ok };
}

/**
 * Sends the promo to one partner (id) or every active partner (id omitted).
 * Text per language is optional — falls back to the built-in localized promo.
 */
export async function sendPartners(opts: {
  id?: string;
  texts?: Partial<Record<string, string>>;
  photo?: string;
}) {
  const guard = await getDoc<{ at: number }>("partnerSend/lock");
  if (!opts.id && guard && Date.now() - guard.at < 60_000)
    throw new Error("⏳ Please wait 1 minute between bulk partner sends.");
  if (!opts.id) await setDoc("partnerSend/lock", { at: Date.now() });

  const all = opts.id
    ? [await getDoc<PartnerDoc>(`partners/${opts.id}`)].filter(Boolean) as PartnerDoc[]
    : (await listPartners()).filter((p) => p.active);
  const photo = /^https:\/\//.test(opts.photo ?? "") ? opts.photo! : "";
  const results: { name: string; ok: boolean; reason?: string }[] = [];

  for (const p of all) {
    if (!(await botIsAdmin(p.chat))) {
      results.push({ name: p.name, ok: false, reason: "bot not admin" });
      await setDoc(`partners/${p.id}`, { lastStatus: "bot not admin ❌" });
      continue;
    }
    const text = (opts.texts?.[p.lang] ?? "").trim() || (opts.texts?.["en"] ?? "").trim() || DEFAULT_TEXT[p.lang];
    const b = BTN[p.lang];
    const kb = [[{ text: b.start, url: refLink() }], [{ text: b.community, url: APP.communityChannel }]];
    const r = photo ? await sendPhoto(p.chat, photo, text.slice(0, 1000), kb) : await sendMessage(p.chat, text.slice(0, 4000), kb);
    results.push({ name: p.name, ok: !!r, reason: r ? undefined : "send failed" });
    await setDoc(`partners/${p.id}`, { lastSentAt: Date.now(), lastStatus: r ? "sent ✅" : "send failed ❌" });
  }
  return { sent: results.filter((r) => r.ok).length, total: results.length, results };
}
