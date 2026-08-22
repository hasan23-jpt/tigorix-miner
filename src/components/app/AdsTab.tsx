import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, PlayCircle, ShieldCheck } from "lucide-react";
import { APP, fmt } from "@/lib/config";
import { openLink } from "@/lib/telegram";
import { doRecordAd, getPayoutProofs } from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, GhostButton, GoldButton, Guide, Pill, SectionTitle, Stat } from "./ui";

/**
 * Rewarded ads are entirely optional: the user opts in before any ad is shown,
 * a simple view (no click) counts, and no other app feature depends on them.
 */
export function AdsTab() {
  const { state, boot, auth, run, busy } = useAppState();
  const [watching, setWatching] = useState(0);
  const [consent, setConsent] = useState(false);
  const [sub, setSub] = useState<"ads" | "sites">("ads");
  const { data: proofs } = useQuery({
    queryKey: ["payout-proofs"],
    queryFn: () => getPayoutProofs(),
    refetchInterval: 60000,
  });
  const origin = typeof window === "undefined" ? "" : window.location.origin;


  const adReward = boot.cfg.adReward ?? 2;
  const cap = boot.cfg.adsDailyCap ?? 20;
  const left = Math.max(0, cap - (state.user.adsToday ?? 0));

  useEffect(() => {
    if (!watching) return;
    const t = setInterval(() => setWatching((w) => (w > 1 ? w - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [watching]);

  const finish = () =>
    void run(
      () => doRecordAd({ data: { initData: auth } }),
      (r) => `✅ View counted! +${r?.reward ?? adReward} ${APP.tokenName}`
    );

  return (
    <div className="space-y-4">
      <Guide>
        Watching ads here is completely optional. Mining, daily rewards, tasks and referrals all work
        without ever opening an ad. If you choose to watch one, you simply view it — no clicking is
        required — and you get a small bonus of {adReward} {APP.tokenName} per view.
      </Guide>

      <div className="grid grid-cols-2 gap-3">
        <Stat emoji="📺" label="Views today" value={`${fmt(state.user.adsToday)}/${fmt(cap)}`} />
        <Stat emoji="🏆" label="Total views" value={fmt(state.user.adsTotal)} />
      </div>

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

      {sub === "ads" ? (
        <>
          <Card>
            <SectionTitle icon="📺" title="Optional Rewarded Ad" action={<Pill tone="info">Opt-in</Pill>} />
            <div className="mb-4 grid place-items-center rounded-2xl border border-primary/30 bg-background/50 py-10">
              <PlayCircle
                className={`size-16 text-primary ${watching ? "animate-pulse" : "animate-float"}`}
              />
              <p className="mt-3 text-sm font-bold">
                {watching ? `⏳ Watching… ${watching}s` : "Ready when you are 🐯"}
              </p>
            </div>

            <label className="mb-3 flex items-start gap-2.5 rounded-xl border border-border bg-background/40 p-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
              />
              <span className="text-[11px] text-muted-foreground">
                I agree to be shown an advertisement for this optional bonus. I can decline and keep
                using every other feature of the app.
              </span>
            </label>

            {watching ? (
              <GhostButton disabled>⏳ Please wait {watching}s</GhostButton>
            ) : left <= 0 ? (
              <GhostButton disabled>🌙 Daily limit reached — resets 00:00 UTC</GhostButton>
            ) : (
              <GoldButton
                disabled={busy || !consent}
                onClick={() => {
                  setWatching(15);
                  setTimeout(() => void finish(), 15000);
                }}
              >
                ▶️ Watch Ad (+{adReward} {APP.tokenName})
              </GoldButton>
            )}
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              {left} optional views left today · viewing is enough, no clicks needed.
            </p>
          </Card>

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
      ) : (
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
      )}
    </div>
  );
}
