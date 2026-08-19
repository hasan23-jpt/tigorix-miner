/** Shared, non-secret app constants (safe for the browser). */
export const APP = {
  botUsername: "Tigorixbot",
  miniAppLink: "https://t.me/Tigorixbot/play",
  communityChannel: "https://t.me/Tigorix",
  paymentChannel: "https://t.me/Tigorixpay",
  communityChatId: "@Tigorix",
  paymentChatId: "@Tigorixpay",
  adminTelegramId: "5419054691",
  tokenName: "TGX",
  tokensPerUsd: 100000,
} as const;

export const DAILY_REWARDS = [30, 40, 50, 70, 90, 120, 150];

export function tokensToUsd(tokens: number) {
  return tokens / APP.tokensPerUsd;
}

export function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.floor(n));
}

export function usd(n: number) {
  return `$${n.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".00")}`;
}

export function utcDayKey(d: Date = new Date()) {
  return d.toISOString().slice(0, 10);
}