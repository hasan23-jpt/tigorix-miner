import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Globe, PlayCircle, ShieldCheck } from "lucide-react";
import { APP, fmt } from "@/lib/config";
import { openLink } from "@/lib/telegram";
import { hasAdsgramBlock, showAdsgramAd } from "@/lib/adsgram";
import { doClaimSite, doRecordAd, getPayoutProofs, getSites } from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, GhostButton, GoldButton, Guide, Pill, SectionTitle, Stat } from "./ui";
import adsgramLogo from "@/assets/adsgram-logo.png";

/**
 * Rewarded ads are entirely optional: the user opts in before any ad is shown
 * and no other app feature depends on them.
 */
export function AdsTab() {
  const [sub, setSub] = useState<"ads" | "sites">("ads");

  return (
    <div className="space-y-4">
      <Guide>
        Watching ads here is completely optional. Mining, daily rewards, tasks and referrals all
        work without ever opening an ad. If you choose to watch one, you get a small token bonus
        per view.
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

function AdsView() {
  const { state, boot, auth, run, busy } = useAppState();
  const [consent, setConsent] = useState(false);
  const [playing, setPlaying] = useState<"int" | "reward" | null>(null);
  const { data: proofs } = useQuery({
    queryKey: ["payout-proofs"],
    queryFn: () => getPayoutProofs(),
    refetchInterval: 60000,
  });
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const intCap = boot.cfg.intAdsDailyCap ?? 10;
  const intReward = boot.cfg.intAdReward ?? 50;
  const rewardCap = boot.cfg.rewardAdsDailyCap ?? 10;
  const rewardReward = boot.cfg.rewardAdReward ?? 5;
  const intLeft = Math.max(0, intCap - (state.user.intAdsToday ?? 0));
  const rewardLeft = Math.max(0, rewardCap - (state.user.rewardAdsToday ?? 0));

  const watch = (network: "int" | "reward") => {
    const blockId =
      network === "int" ? boot.cfg.adsgramIntBlockId : boot.cfg.adsgramRewardBlockId;
    setPlaying(network);
    void (async () => {
      const ok = hasAdsgramBlock(blockId ?? "") ? await showAdsgramAd(blockId!) : false;
      if (!ok) {
        setPlaying(null);
        const { toast } = await import("sonner");
        toast.error("📺 Ad was not watched fully — no reward this time.");
        return;
      }
      setPlaying(null);
      await run(
        () => doRecordAd({ data: { initData: auth, network } }),
        (r) => `✅ View counted! +${r?.reward ?? 0} ${APP.tokenName}`
      );
    })();
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat emoji="📺" label="Views today" value={`${fmt(state.user.adsToday)}/${fmt(intCap + rewardCap)}`} />
        <Stat emoji="🏆" label="Total views" value={fmt(state.user.adsTotal)} />
      </div>

      <label className="flex items-start gap-2.5 rounded-xl border border-border bg-background/40 p-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
        />
        <span className="text-[11px] text-muted-foreground">
          I agree to be shown advertisements for these optional bonuses. I can decline and keep
          using every other feature of the app.
        </span>
      </label>

      <AdBlockCard
        logo={adsgramLogo}
        network="Adsgram · Interstitial"
        title="Quick Ad Break"
        reward={intReward}
        left={intLeft}
        cap={intCap}
        playing={playing === "int"}
        disabled={busy || playing !== null || !consent || intLeft <= 0}
        onWatch={() => watch("int")}
      />
      <AdBlockCard
        logo={adsgramLogo}
        network="Adsgram · Rewarded Video"
        title="Rewarded Ad"
        reward={rewardReward}
        left={rewardLeft}
        cap={rewardCap}
        playing={playing === "reward"}
        disabled={busy || playing !== null || !consent || rewardLeft <= 0}
        onWatch={() => watch("reward")}
      />

      <Card>
        <SectionTitle icon="🧾" title="Proof of Payouts" action={<Pill tone="success">Public</Pill>} />
        <p className="mb-3 text-[11px] text-muted-foreground">
          Every approved withdrawal is published here and in our public payment channel with
          amount, fee and on-chain transaction ID, so rewards can be verified by anyone.
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Stat emoji="✅" label="Total paid out" value={`$${(proofs?.totalPaidUsd ?? 0).toFixed(4)}`} />
          <Stat emoji="🧾" label="Payouts" value={fmt(proofs?.totalPayouts ?? 0)} />
        </div>
        <div className="mb-3 space-y-2">
          {(proofs?.payouts ?? []).slice(0, 5).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px]"
            >
              <div className="min-w-0">
                <p className="font-bold">
                  #{p.number} · {p.user} · {fmt(p.tokens)} {APP.tokenName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(p.at).toISOString().slice(0, 16).replace("T", " ")} UTC ·{" "}
                  {p.txId ? `tx ${p.txId.slice(0, 10)}…` : "tx pending"}
                </p>
              </div>
              <span className="font-black text-success">${p.netUsd.toFixed(4)}</span>
            </div>
          ))}
          {proofs && !proofs.payouts.length && (
            <p className="py-3 text-center text-[11px] text-muted-foreground">
              No payouts approved yet — confirmations appear here automatically.
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <GoldButton onClick={() => openLink(APP.paymentChannel)}>
            💳 View Payout Proofs Channel
          </GoldButton>
          <GhostButton onClick={() => openLink(`${origin}/payouts`)}>
            🌐 Public Payout Page
          </GhostButton>
          <GhostButton onClick={() => openLink(APP.communityChannel)}>
            📣 Community Channel
          </GhostButton>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-success" /> 100,000 {APP.tokenName} = $1 USDT
          (BEP-20)
        </p>
      </Card>
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
  logo: string;
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
        <img
          src={logo}
          alt="Adsgram"
          width={512}
          height={512}
          loading="lazy"
          className="size-7 rounded-lg"
        />
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
    refetchInterval: 30000,
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
