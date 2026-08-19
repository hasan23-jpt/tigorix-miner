import { useEffect, useState } from "react";
import { Globe, PlayCircle } from "lucide-react";
import { APP, fmt } from "@/lib/config";
import { openLink } from "@/lib/telegram";
import { doRecordAd } from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, GhostButton, GoldButton, Guide, Pill, SectionTitle, Stat } from "./ui";

/** Ad networks plug in here in a later version; the counter already drives referral verification. */
export function AdsTab() {
  const { state, auth, run, busy } = useAppState();
  const [watching, setWatching] = useState(0);
  const [sub, setSub] = useState<"ads" | "sites">("ads");

  useEffect(() => {
    if (!watching) return;
    const t = setInterval(() => setWatching((w) => (w > 1 ? w - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [watching]);

  const finish = () =>
    void run(() => doRecordAd({ data: { initData: auth } }), () => "✅ View counted!");

  return (
    <div className="space-y-4">
      <Guide>
        Watching ads powers your referral verification: 10 ads on day 1 and 15 ads on day 2 unlock
        the full referral bonus for whoever invited you. More ad networks and paid site visits are
        coming in the next version.
      </Guide>

      <div className="grid grid-cols-2 gap-3">
        <Stat emoji="📺" label="Ads today" value={fmt(state.user.adsToday)} />
        <Stat emoji="🏆" label="Total ads" value={fmt(state.user.adsTotal)} />
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
        <Card>
          <SectionTitle icon="📺" title="Watch Ads" action={<Pill tone="info">Live</Pill>} />
          <div className="mb-4 grid place-items-center rounded-2xl border border-primary/30 bg-background/50 py-10">
            <PlayCircle
              className={`size-16 text-primary ${watching ? "animate-pulse" : "animate-float"}`}
            />
            <p className="mt-3 text-sm font-bold">
              {watching ? `⏳ Watching… ${watching}s` : "Ready to earn 🐯"}
            </p>
          </div>
          {watching ? (
            <GhostButton disabled>⏳ Please wait {watching}s</GhostButton>
          ) : (
            <GoldButton
              disabled={busy}
              onClick={() => {
                setWatching(15);
                setTimeout(() => void finish(), 15000);
              }}
            >
              ▶️ Watch Ad
            </GoldButton>
          )}
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Each verified view counts toward your referral progress.
          </p>
        </Card>
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