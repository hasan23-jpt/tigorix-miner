import { useCallback, useState } from "react";
import { toast } from "sonner";
import { hasAdsgramBlock, showAdsgramAd, watchAdsgramAds } from "@/lib/adsgram";
import { useAppState } from "./useApp";

/**
 * Gates an action behind watching Adsgram ads. When no block ID is configured
 * in the admin panel yet, the action runs directly (graceful fallback).
 */
export function useAdGate() {
  const { boot } = useAppState();
  const [watchingAd, setWatchingAd] = useState(0); // 0 = idle

  /** Shows ONE interstitial ad, then runs the action if the ad was watched. */
  const gateWithInterstitial = useCallback(
    async (action: () => unknown | Promise<unknown>) => {
      const blockId = boot.cfg.adsgramIntBlockId ?? "";
      if (!hasAdsgramBlock(blockId)) {
        await action();
        return;
      }
      setWatchingAd(1);
      try {
        const ok = await showAdsgramAd(blockId);
        if (!ok) {
          toast.error("📺 Please watch the full ad to continue.");
          return;
        }
        await action();
      } finally {
        setWatchingAd(0);
      }
    },
    [boot.cfg.adsgramIntBlockId]
  );

  /** Shows N rewarded ads in sequence, then runs the action only if ALL were watched. */
  const gateWithRewardAds = useCallback(
    async (count: number, action: () => unknown | Promise<unknown>) => {
      const blockId = boot.cfg.adsgramRewardBlockId ?? "";
      if (!hasAdsgramBlock(blockId) || count <= 0) {
        await action();
        return;
      }
      setWatchingAd(count);
      try {
        const watched = await watchAdsgramAds(blockId, count, (w) => setWatchingAd(count - w));
        if (watched < count) {
          toast.error(`📺 ${watched}/${count} ads watched — finish all ads to continue.`);
          return;
        }
        await action();
      } finally {
        setWatchingAd(0);
      }
    },
    [boot.cfg.adsgramRewardBlockId]
  );

  /** Picks a random configured ad block (interstitial or rewarded) and shows it. */
  const showRandomAd = useCallback(async () => {
    const ids = [boot.cfg.adsgramIntBlockId, boot.cfg.adsgramRewardBlockId].filter(
      (id): id is string => hasAdsgramBlock(id)
    );
    if (!ids.length) return true;
    setWatchingAd(1);
    try {
      return await showAdsgramAd(ids[Math.floor(Math.random() * ids.length)]!);
    } finally {
      setWatchingAd(0);
    }
  }, [boot.cfg.adsgramIntBlockId, boot.cfg.adsgramRewardBlockId]);

  return { gateWithInterstitial, gateWithRewardAds, showRandomAd, watchingAd };
}
