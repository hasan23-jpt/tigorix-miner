import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { APP, fmt } from "@/lib/config";
import { openLink } from "@/lib/telegram";
import { doClaimReferral, getReferrals } from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, GhostButton, GoldButton, Guide, Pill, SectionTitle, Stat } from "./ui";

export function ReferTab() {
  const { state, auth, run, busy } = useAppState();
  const link = `${APP.miniAppLink}?startapp=${state.user.id}`;

  const { data } = useQuery({
    queryKey: ["referrals"],
    queryFn: () => getReferrals({ data: { initData: auth } }),
    refetchInterval: 15000,
  });

  const rewards = data?.rewards ?? { join: 250, day1: 500, day2: 750 };
  const ads = data?.ads ?? { day1: 10, day2: 15 };

  return (
    <div className="space-y-4">
      <Guide>
        Referral rewards are not added automatically — they collect as pending and you claim them
        here. Fake or duplicate device/IP referrals are marked as fake and pay nothing.
      </Guide>

      <div className="grid grid-cols-3 gap-3">
        <Stat emoji="👥" label="Referrals" value={fmt(data?.total ?? state.user.refCount)} />
        <Stat emoji="✅" label="Active" value={fmt(data?.active ?? state.user.refActive)} />
        <Stat emoji="🏦" label="Earned" value={fmt(data?.claimed ?? state.user.refEarnClaimed)} />
      </div>

      <Card>
        <SectionTitle icon="💼" title="Claimable Rewards" />
        <p className="mb-3 text-center text-3xl font-black">
          <span className="text-gold-gradient">{fmt(data?.pending ?? state.user.refEarnPending)}</span>{" "}
          <span className="text-sm text-muted-foreground">{APP.tokenName}</span>
        </p>
        <GoldButton
          disabled={busy || (data?.pending ?? state.user.refEarnPending) <= 0}
          onClick={() =>
            void run(
              () => doClaimReferral({ data: { initData: auth } }),
              (r) => `🎉 +${r?.reward} ${APP.tokenName} claimed!`
            )
          }
        >
          🎁 Claim Referral Rewards
        </GoldButton>
      </Card>

      <Card>
        <SectionTitle icon="🔗" title="Your Invite Link" />
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-background/50 p-3">
          <span className="truncate text-[11px] text-muted-foreground">{link}</span>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              toast.success("🔗 Link copied!");
            }}
            className="ml-auto text-primary"
            aria-label="Copy invite link"
          >
            <Copy className="size-4" />
          </button>
        </div>
        <GhostButton
          onClick={() =>
            openLink(
              `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("🐯 Join Tigorix — earn real rewards anytime, anywhere!")}`
            )
          }
        >
          📤 Share with friends
        </GhostButton>
      </Card>

      <Card>
        <SectionTitle icon="🏅" title="How rewards work" />
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>🤝 Friend joins → <b className="text-foreground">{rewards.join} {APP.tokenName}</b> (pending)</li>
          <li>📺 Day 1: friend watches {ads.day1} ads → <b className="text-foreground">{rewards.day1} {APP.tokenName}</b></li>
          <li>🔥 Day 2: friend watches {ads.day2} ads → <b className="text-foreground">{rewards.day2} {APP.tokenName}</b></li>
          <li>🏆 Total per friend: <b className="text-foreground">{rewards.join + rewards.day1 + rewards.day2} {APP.tokenName}</b></li>
        </ul>
      </Card>

      <Card>
        <SectionTitle icon="🧾" title="Referral History" />
        {!data?.history?.length ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No referrals yet — share your link to get started! 🚀
          </p>
        ) : (
          <div className="space-y-2">
            {data.history.map((r, i) => (
              <div
                key={`${r.name}-${i}`}
                className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2"
              >
                <div>
                  <p className="text-xs font-bold">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(r.at).toISOString().slice(0, 16).replace("T", " ")} UTC
                  </p>
                </div>
                <Pill
                  tone={
                    r.status === "verified"
                      ? "success"
                      : r.status === "mid"
                        ? "info"
                        : r.status === "fake"
                          ? "danger"
                          : "warn"
                  }
                >
                  {r.status === "mid" ? "half verified" : r.status}
                </Pill>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}