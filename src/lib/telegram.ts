/** Thin, SSR-safe wrapper around the Telegram WebApp bridge. */
type TgUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  language_code?: string;
};

type WebApp = {
  initData: string;
  initDataUnsafe: { user?: TgUser; start_param?: string };
  ready: () => void;
  expand: () => void;
  openTelegramLink: (u: string) => void;
  openLink: (u: string) => void;
  HapticFeedback?: { impactOccurred: (s: string) => void };
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
};

export function webApp(): WebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp ?? null;
}

export function initTelegram() {
  const wa = webApp();
  if (!wa) return;
  wa.ready();
  wa.expand();
  wa.setHeaderColor?.("#141210");
  wa.setBackgroundColor?.("#141210");
}

export function initData() {
  return webApp()?.initData ?? "";
}

export function tgUser(): TgUser | null {
  return webApp()?.initDataUnsafe?.user ?? null;
}

export function startParam() {
  return webApp()?.initDataUnsafe?.start_param ?? "";
}

export function haptic(style: "light" | "medium" | "heavy" = "light") {
  webApp()?.HapticFeedback?.impactOccurred(style);
}

export function openLink(url: string) {
  const wa = webApp();
  if (wa && url.includes("t.me")) wa.openTelegramLink(url);
  else if (wa) wa.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

/** Rough per-browser fingerprint used for multi-account abuse checks. */
export function deviceFingerprint() {
  if (typeof window === "undefined") return "";
  const n = window.navigator;
  const parts = [
    n.userAgent,
    n.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    String((n as unknown as { hardwareConcurrency?: number }).hardwareConcurrency ?? 0),
  ].join("|");
  let h = 0;
  for (let i = 0; i < parts.length; i++) h = (h * 31 + parts.charCodeAt(i)) | 0;
  return `d${Math.abs(h)}`;
}