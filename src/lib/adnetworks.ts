/**
 * Multi-network ad layer (browser only).
 *
 * Every network is optional and fully admin-configurable: when a block ID is
 * missing, the network is simply hidden / skipped. Reward-gated actions require
 * the ad to actually play for `MIN_WATCH_MS`, otherwise no reward is granted and
 * the caller shows a "try again" popup.
 */
import { showAdsgramAd } from "./adsgram";

/** Reward is issued only after the ad has remained open for at least 10 seconds. */
export const MIN_WATCH_MS = 10_000;

export type AdNet = "int" | "reward" | "giga" | "monetag" | "bitvex";

export type AdResult = { ok: boolean; reason?: "nofill" | "short" | "skip" };

type Win = Record<string, unknown>;

const W = () => window as unknown as Win;

const loaded = new Map<string, Promise<boolean>>();

function loadScript(key: string, build: () => HTMLScriptElement): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const cached = loaded.get(key);
  if (cached) return cached;
  const p = new Promise<boolean>((resolve) => {
    const s = build();
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  loaded.set(key, p);
  return p;
}

/* -------------------------------- Gigapub -------------------------------- */

async function showGigaAd(id: string): Promise<boolean> {
  const w = W();
  if (typeof w["showGiga"] !== "function") {
    await loadScript(`giga:${id}`, () => {
      const s = document.createElement("script");
      s.src = `https://ad.gigapub.tech/script?id=${encodeURIComponent(id)}`;
      return s;
    });
  }
  const fn = W()["showGiga"] as ((slot: string) => Promise<unknown>) | undefined;
  if (typeof fn !== "function") return false;
  try {
    await fn("main");
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------- Monetag -------------------------------- */

async function showMonetagAd(zone: string): Promise<boolean> {
  const sdk = `show_${zone}`;
  if (typeof W()[sdk] !== "function") {
    await loadScript(`monetag:${zone}`, () => {
      const s = document.createElement("script");
      s.src = "//libtl.com/sdk.js";
      s.dataset["zone"] = zone;
      s.dataset["sdk"] = sdk;
      return s;
    });
  }
  const fn = W()[sdk] as (() => Promise<unknown>) | undefined;
  if (typeof fn !== "function") return false;
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------- Adsbitvex ------------------------------- */

/**
 * AdsBitvex: one script tag per app id, then `window.showadsbitvex()` which
 * resolves when the full-screen reward ad finishes.
 */
async function showBitvexAd(appId: string): Promise<boolean> {
  const pick = () => {
    const w = W();
    const candidates = [
      w["showadsbitvex"],
      w["showAdsBitvex"],
      (w["AdsBitvex"] as { show?: unknown } | undefined)?.show,
    ];
    return candidates.find((c) => typeof c === "function") as
      | (() => Promise<unknown>)
      | undefined;
  };
  if (!pick()) {
    await loadScript(`bitvex:${appId}`, () => {
      const s = document.createElement("script");
      s.src = `https://sdk.adsbitvex.com/functions/v1/ad-script?appid=${encodeURIComponent(appId)}`;
      return s;
    });
    // The SDK registers its global slightly after onload in some builds.
    for (let i = 0; i < 20 && !pick(); i++) await new Promise((r) => setTimeout(r, 100));
  }
  const fn = pick();
  if (!fn) return false;
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------- public -------------------------------- */

export function hasBlock(id: string | undefined | null) {
  return !!(id && String(id).trim().length >= 3);
}

/**
 * Shows one ad from the given network. When `minWatchMs` is set, an ad that
 * closed too quickly counts as not watched (`reason: "short"`).
 */
export async function showAd(
  net: AdNet,
  blockId: string | undefined,
  minWatchMs = 0
): Promise<AdResult> {
  const id = String(blockId ?? "").trim();
  if (!hasBlock(id)) return { ok: false, reason: "nofill" };
  const started = Date.now();
  let ok = false;
  if (net === "int" || net === "reward") ok = await showAdsgramAd(id);
  else if (net === "giga") ok = await showGigaAd(id);
  else if (net === "monetag") ok = await showMonetagAd(id);
  else ok = await showBitvexAd(id);

  if (!ok) return { ok: false, reason: "nofill" };
  if (minWatchMs && Date.now() - started < minWatchMs) return { ok: false, reason: "short" };
  return { ok: true };
}

export function adErrorMessage(r: AdResult) {
  if (r.reason === "short") return "⏱ Watch the full ad (at least 10 seconds) to get the reward.";
  return "📺 No ad available right now — please try again in a moment.";
}
