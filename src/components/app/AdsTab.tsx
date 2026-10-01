import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Globe, PlayCircle } from "lucide-react";
import { APP, fmt } from "@/lib/config";
import { openLink } from "@/lib/telegram";
import { MIN_WATCH_MS, adErrorMessage, hasBlock, showAd, type AdNet } from "@/lib/adnetworks";
import { doClaimSite, doRecordAd, getSites } from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, GhostButton, GoldButton, Guide, Pill, SectionTitle, Stat } from "./ui";
import adsgramLogo from "@/assets/adsgram-logo.png";
import monetagLogo from "@/assets/monetag-logo.png";
import bitvexLogo from "@/assets/adsbitvex-logo.png";

const LOGOS: Partial<Record<AdNet, string>> = {
  int: adsgramLogo,
  reward: adsgramLogo,
  monetag: monetagLogo,
  bitvex: bitvexLogo,
};

/**
 * Rewarded ads are entirely optional: the user opts in before any ad is shown
 * and no other app feature depends on them.
 */
export function AdsTab() {
  const [sub, setSub] = useState<"ads" | "sites">("ads");

  return (
    <div className="space-y-4">
      <Guide>
        Pick any ad network below and tap Watch Ad. When the ad finishes, the reward is added to
        your balance instantly. Each network has its own daily limit that resets at 00:00 UTC.
        Your friends' ad views also unlock your referral rewards.
      </Guide>

      <div className="surface-card grid grid-cols-2 gap-2 p-1.5">
        {(["ads", "sites"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSub(k)}
            className={`rounded-lg py-2.5 text-xs font-extrabold transition ${
              sub === k ? "bg-gold-gradient text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {k === "ads" ? "📺 Watch Ads" : "🌐 Visit Sites"}
          </button>
        ))}
      </div>

      {sub === "ads" ? <AdsView /> : <SitesView />}
    </div>
  );
}

type NetworkCard = {
  net: AdNet;
  network: string;
  title: string;
  blockId: string;
  reward: number;
  cap: number;
  seen: number;
};

function AdsView() {
  const { state, boot, auth, run, busy } = useAppState();
  const [playing, setPlaying] = useState<AdNet | null>(null);
  const cfg = boot.cfg as unknown as Record<string, number | string | boolean>;
  const u = state.user as unknown as Record<string, number>;

  const cards: NetworkCard[] = ([
    {
      net: "int",
      network: "Adsgram · Interstitial",
      title: "Quick Ad Break",
      blockId: String(cfg["adsgramIntBlockId"] ?? ""),
      reward: Number(cfg["intAdReward"] ?? 50),
      cap: Number(cfg["intAdsDailyCap"] ?? 10),
      seen: Number(u["intAdsToday"] ?? 0),
    },
    {
      net: "reward",
      network: "Adsgram · Rewarded Video",
      title: "Rewarded Ad",
      blockId: String(cfg["adsgramRewardBlockId"] ?? ""),
      reward: Number(cfg["rewardAdReward"] ?? 5),
      cap: Number(cfg["rewardAdsDailyCap"] ?? 10),
      seen: Number(u["rewardAdsToday"] ?? 0),
    },
    {
      net: "giga",
      network: "Gigapub",
      title: "Gigapub Ad",
      blockId: String(cfg["gigaBlockId"] ?? ""),
      reward: Number(cfg["gigaAdReward"] ?? 20),
      cap: Number(cfg["gigaAdsDailyCap"] ?? 10),
      seen: Number(u["gigaAdsToday"] ?? 0),
    },
    {
      net: "monetag",
      network: "Monetag",
      title: "Monetag Ad",
      blockId: String(cfg["monetagBlockId"] ?? ""),
      reward: Number(cfg["monetagAdReward"] ?? 20),
      cap: Number(cfg["monetagAdsDailyCap"] ?? 10),
      seen: Number(u["monetagAdsToday"] ?? 0),
    },
    {
      net: "bitvex",
      network: "Adsbitvex",
      title: "Adsbitvex Ad",
      blockId: String(cfg["bitvexBlockId"] ?? ""),
      reward: Number(cfg["bitvexAdReward"] ?? 20),
      cap: Number(cfg["bitvexAdsDailyCap"] ?? 10),
      seen: Number(u["bitvexAdsToday"] ?? 0),
    },
  ] as NetworkCard[]).filter((c) => hasBlock(c.blockId));

  const totalCap = cards.reduce((sum, c) => sum + c.cap, 0);

  const watch = (card: NetworkCard) => {
    setPlaying(card.net);
    void (async () => {
      const r = await showAd(card.net, card.blockId, MIN_WATCH_MS);
      setPlaying(null);
      if (!r.ok) {
        const { toast } = await import("sonner");
        toast.error(adErrorMessage(r), { description: "Tap Watch Ad again to retry." });
        return;
      }
      await run(
        () => doRecordAd({ data: { initData: auth, network: card.net } }),
        (res) => `✅ View counted! +${res?.reward ?? 0} ${APP.tokenName}`
      );
    })();
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat
          emoji="📺"
          label="Views today"
          value={`${fmt(state.user.adsToday)}/${fmt(totalCap)}`}
        />
        <Stat emoji="🏆" label="Total views" value={fmt(state.user.adsTotal)} />
      </div>

      {cards.map((c) => (
        <AdBlockCard
          key={c.net}
          logo={LOGOS[c.net]}
          network={c.network}
          title={c.title}
          reward={c.reward}
          left={Math.max(0, c.cap - c.seen)}
          cap={c.cap}
          playing={playing === c.net}
          disabled={busy || playing !== null || c.cap - c.seen <= 0}
          onWatch={() => watch(c)}
        />
      ))}
      {!cards.length && (
        <Card>
          <SectionTitle icon="📺" title="Watch Ads" action={<Pill>Soon</Pill>} />
          <p className="text-[11px] text-muted-foreground">
            Ad networks are being configured — check back shortly.
          </p>
        </Card>
      )}

    </>
  );
}

function AdBlockCard({
  logo,
  network,
  title,
  reward,
  left,
  cap,
  playing,
  disabled,
  onWatch,
}: {
  logo?: string | undefined;
  network: string;
  title: string;
  reward: number;
  left: number;
  cap: number;
  playing: boolean;
  disabled: boolean;
  onWatch: () => void;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        {logo ? (
          <img
            src={logo}
            alt={`${network} logo`}
            width={128}
            height={128}
            loading="lazy"
            className="size-10 rounded-xl bg-background/60 object-contain p-1 ring-1 ring-border"
          />
        ) : (
          <span className="grid size-10 place-items-center rounded-xl bg-info/20 text-sm font-black text-info ring-1 ring-info/40">
            GP
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-tight">{title}</p>
          <p className="text-[10px] font-bold text-muted-foreground">{network}</p>
        </div>
        <span className="ml-auto">
          <Pill tone="info">
            {left}/{cap} left
          </Pill>
        </span>
      </div>
      <div className="mb-4 grid place-items-center rounded-2xl border border-primary/30 bg-background/50 py-8">
        <PlayCircle
          className={`size-14 text-primary ${playing ? "animate-pulse" : "animate-float"}`}
        />
        <p className="mt-3 text-sm font-bold">
          {playing ? "⏳ Ad playing…" : "Ready when you are 🐯"}
        </p>
      </div>
      {left <= 0 ? (
        <GhostButton disabled>🌙 Daily limit reached — resets 00:00 UTC</GhostButton>
      ) : (
        <GoldButton disabled={disabled} onClick={onWatch}>
          {playing ? "⏳ Watching ad…" : `▶️ Watch Ad (+${reward} ${APP.tokenName})`}
        </GoldButton>
      )}
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Optional bonus · watch the full ad to earn.
      </p>
    </Card>
  );
}

function SitesView() {
  const { auth, run, busy } = useAppState();
  const { data } = useQuery({
  queryKey: ["sites"],
  queryFn: () => getSites({ data: { initData: auth } }),
  refetchInterval: false,
refetchOnWindowFocus: false,
staleTime: 30000,
});
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const [visiting, setVisiting] = useState<string | null>(null); // siteId
  const [openedAt, setOpenedAt] = useState(0);

  const sites = data?.sites ?? [];
  const status = data?.status ?? {};

  if (!sites.length) {
    return (
      <Card>
        <SectionTitle icon="🌐" title="Visit Sites" action={<Pill>Soon</Pill>} />
        <div className="grid place-items-center rounded-2xl border border-border bg-background/40 py-10 text-center">
          <Globe className="size-14 animate-float text-info" />
          <p className="mt-3 text-sm font-bold">Paid site visits arriving soon 🚀</p>
          <p className="mt-1 px-6 text-[11px] text-muted-foreground">
            We are onboarding partners. Follow the community channel to be first in line.
          </p>
        </div>
        <div className="mt-3">
          <GhostButton onClick={() => openLink(APP.communityChannel)}>
            📣 Follow Community
          </GhostButton>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle icon="🌐" title="Visit Sites" />
      <Guide>
        Open a site, stay at least 10 seconds, then claim your bonus. Each site can be claimed
        once every 24 hours.
      </Guide>
      <div className="space-y-2">
        {sites.map((s) => {
          const nextAt = status[s.id] ?? 0;
          const cooling = nextAt > now;
          const leftMs = nextAt - now;
          const leftH = Math.floor(leftMs / 3600000);
          const leftM = Math.ceil((leftMs % 3600000) / 60000);
          const isVisiting = visiting === s.id;
          const canClaim = isVisiting && now - openedAt >= 10000;
          return (
            <div
              key={s.id}
              className="rounded-xl border border-border bg-background/40 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <Globe className="size-4 shrink-0 text-info" />
                <p className="min-w-0 flex-1 truncate text-xs font-bold">{s.title}</p>
                <span className="shrink-0 text-xs font-black text-primary">
                  +{fmt(s.reward)} {APP.tokenName}
                </span>
              </div>
              <div className="mt-2">
                {cooling ? (
                  <GhostButton disabled>
                    ⏳ Available again in {leftH}h {leftM}m
                  </GhostButton>
                ) : canClaim ? (
                  <GoldButton
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          doClaimSite({
                            data: { initData: auth, siteId: s.id, openedAt },
                          }),
                        (r) => `✅ +${r?.reward ?? 0} ${APP.tokenName} for visiting ${s.title}`
                      ).then(() => setVisiting(null))
                    }
                  >
                    🎁 Claim {fmt(s.reward)} {APP.tokenName}
                  </GoldButton>
                ) : isVisiting ? (
                  <GhostButton disabled>
                    ⏱ Keep the site open… {Math.max(0, 10 - Math.floor((now - openedAt) / 1000))}s
                  </GhostButton>
                ) : (
                  <GoldButton
                    disabled={busy || visiting !== null}
                    onClick={() => {
                      setVisiting(s.id);
                      setOpenedAt(Date.now());
                      openLink(s.url);
                    }}
                  >
                    <ExternalLink className="size-4" /> Visit Site
                  </GoldButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
