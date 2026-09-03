import { useCallback, useState } from "react";
import { toast } from "sonner";
import { MIN_WATCH_MS, adErrorMessage, hasBlock, showAd, type AdNet } from "@/lib/adnetworks";
import { useAppState } from "./useApp";

/**
 * Runs an action behind an optional ad. Reward claims require the ad to play for
 * at least 10 seconds; if no ad is available the user gets a "try again" popup
 * and the action is not performed.
 */
export function useAdGate() {
  const { boot } = useAppState();
  const [watchingAd, setWatchingAd] = useState(0); // 0 = idle

  const blockOf = useCallback(
    (net: AdNet) => {
      const cfg = boot.cfg as Record<string, unknown>;
      const map: Record<AdNet, string> = {
        int: "adsgramIntBlockId",
        reward: "adsgramRewardBlockId",
        giga: "gigaBlockId",
        monetag: "monetagBlockId",
        bitvex: "bitvexBlockId",
      };
      return String(cfg[map[net]] ?? "");
    },
    [boot.cfg]
  );

  /** Shows one interstitial ad (min 10s) and only then runs the action. */
  const gateWithInterstitial = useCallback(
    async (action: () => unknown | Promise<unknown>) => {
      const blockId = blockOf("int");
      if (!hasBlock(blockId)) {
        await action();
        return;
      }
      setWatchingAd(1);
      try {
        const r = await showAd("int", blockId, MIN_WATCH_MS);
        if (!r.ok) {
          toast.error(adErrorMessage(r), {
            description: "Tap the button again to retry.",
          });
          return;
        }
        await action();
      } finally {
        setWatchingAd(0);
      }
    },
    [blockOf]
  );

  /** Shows N rewarded ads in sequence; the action runs only if all played. */
  const gateWithRewardAds = useCallback(
    async (count: number, action: () => unknown | Promise<unknown>) => {
      const blockId = blockOf("reward");
      if (!hasBlock(blockId) || count <= 0) {
        await action();
        return;
      }
      setWatchingAd(count);
      try {
        let watched = 0;
        for (let i = 0; i < count; i++) {
          const r = await showAd("reward", blockId, MIN_WATCH_MS);
          if (!r.ok) {
            toast.error(adErrorMessage(r), {
              description: `${watched}/${count} ads watched — please try again.`,
            });
            return;
          }
          watched += 1;
          setWatchingAd(count - watched);
        }
        await action();
      } finally {
        setWatchingAd(0);
      }
    },
    [blockOf]
  );

  /** Picks a random configured network and shows one ad from it. */
  const showRandomAd = useCallback(async () => {
    const nets: AdNet[] = (["int", "reward", "giga", "monetag", "bitvex"] as AdNet[]).filter((n) =>
      hasBlock(blockOf(n))
    );
    if (!nets.length) return true;
    const net = nets[Math.floor(Math.random() * nets.length)]!;
    setWatchingAd(1);
    try {
      const r = await showAd(net, blockOf(net), MIN_WATCH_MS);
      if (!r.ok) toast.error(adErrorMessage(r));
      return r.ok;
    } finally {
      setWatchingAd(0);
    }
  }, [blockOf]);

  /** Fire-and-forget interstitial (app open / Home visit). No reward, no gate. */
  const showAutoAd = useCallback(async () => {
    const blockId = blockOf("int");
    if (!hasBlock(blockId)) return;
    await showAd("int", blockId);
  }, [blockOf]);

  return { gateWithInterstitial, gateWithRewardAds, showRandomAd, showAutoAd, watchingAd };
}
