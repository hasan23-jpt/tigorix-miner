/** Adsgram SDK loader (browser only). Block IDs come from the admin panel. */

type AdsgramController = {
  show: () => Promise<{ done?: boolean }>;
};

declare global {
  interface Window {
    Adsgram?: { init: (opts: { blockId: string }) => AdsgramController };
  }
}

let loading: Promise<boolean> | null = null;
const controllers = new Map<string, AdsgramController>();

function loadSdk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Adsgram) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const s = document.createElement("script");
    // Official Adsgram Reward/Interstitial SDK. The old `adsgram.min.js`
    // filename returns no usable controller on production deployments.
    s.src = "https://sad.adsgram.ai/js/sad.min.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return loading;
}

export function hasAdsgramBlock(blockId: string | undefined) {
  // Adsgram block IDs come in both forms: "int-43953" and plain numbers like "43952".
  return !!blockId && /^(?:[a-z]+-)?\d+$/i.test(blockId.trim());
}

/**
 * Shows an Adsgram ad (interstitial or rewarded, decided by the block ID).
 * Resolves true only when the ad was actually watched; false when skipped,
 * no-fill, blocked by an ad-blocker, or the SDK failed to load.
 */
export async function showAdsgramAd(blockId: string): Promise<boolean> {
  const id = blockId.trim();
  if (!hasAdsgramBlock(id)) return false;
  if (!(await loadSdk()) || !window.Adsgram) return false;
  try {
    let ctrl = controllers.get(id);
    if (!ctrl) {
      ctrl = window.Adsgram.init({ blockId: id });
      controllers.set(id, ctrl);
    }
    const result = await ctrl.show();
    return result?.done === true;
  } catch {
    // user skipped / closed early / no fill
    return false;
  }
}

/**
 * Watches N ads in sequence. Returns how many were actually watched.
 * `onProgress(watched, total)` is called after each ad finishes.
 */
export async function watchAdsgramAds(
  blockId: string,
  count: number,
  onProgress?: (watched: number, total: number) => void
) {
  let watched = 0;
  for (let i = 0; i < count; i++) {
    const ok = await showAdsgramAd(blockId);
    if (!ok) break;
    watched += 1;
    onProgress?.(watched, count);
  }
  return watched;
}
