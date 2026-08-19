import { useEffect, useState } from "react";
import { Gift, Pickaxe, ShieldCheck, Ticket, Users, Wallet } from "lucide-react";
import { APP, DAILY_REWARDS, fmt } from "@/lib/config";
import { openLink, haptic } from "@/lib/telegram";
import {
  doClaimDaily,
  doClaimMining,
  doRedeemCode,
  doStartMining,
} from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, Field, GhostButton, GoldButton, Guide, Pill, SectionTitle } from "./ui";

function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

export function HomeTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { state, auth, run, busy, refresh } = useAppState();
  const { user, mining, daily } = state;
  const [now, setNow] = useState(Date.now());
  const [code, setCode] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (mining.status === "running" && now > mining.endsAt) void refresh();
  }, [now, mining, refresh]);

  const running = mining.status === "running" && now < mining.endsAt;
  const progress = running
    ? Math.min(100, Math.round(((mining.endsAt - (mining.endsAt - now)) / mining.endsAt) * 100))
    : mining.status === "claimable"
      ? 100
      : 0;

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden">
        <div className="flex items-center gap-3">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt=""
              className="size-11 rounded-full border-2 border-primary object-cover"
            />
          ) : (
            <div className="bg-gold-gradient grid size-11 place-items-center rounded-full text-lg">
              🐯
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">
              {user.username ? `@${user.username}` : user.firstName}
            </p>
            <p className="text-[11px] text-muted-foreground">ID: {user.id}</p>
          </div>
          <Pill tone={user.suspended ? "danger" : "success"}>
            {user.suspended ? "Suspended" : "Active"}
          </Pill>
        </div>

        <div className="mt-4 rounded-xl border border-primary/30 bg-background/50 p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Your Balance
          </p>
          <p className="mt-1 flex items-center justify-center gap-2 text-3xl font-black">
            <span className="text-2xl">🪙</span>
            <span className="text-gold-gradient">{fmt(user.balance)}</span>
            <span className="text-sm font-bold text-muted-foreground">{APP.tokenName}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ≈ ${(user.balance / APP.tokensPerUsd).toFixed(4)} USD
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle
          icon="⛏"
          title="Tiger Mining"
          action={<Pill tone={running ? "info" : mining.status === "claimable" ? "success" : "muted"}>
            {running ? "Mining" : mining.status === "claimable" ? "Ready" : "Idle"}
          </Pill>}
        />
        <Guide>
          Start mining to earn {fmt(mining.reward || 100)} {APP.tokenName} per session. Mining runs
          for 1 hour, then stops automatically — claim your reward to start again. You also get a
          bot notification when the session finishes.
        </Guide>

        <div className="mb-3 flex items-center gap-3">
          <div className="grid size-14 place-items-center rounded-full border border-primary/40 bg-background/60">
            <Pickaxe className={running ? "size-6 animate-bounce text-primary" : "size-6 text-primary"} />
          </div>
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-gold-gradient h-full transition-all"
                style={{ width: `${running ? progress : mining.status === "claimable" ? 100 : 0}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {running
                ? `⏳ ${countdown(mining.endsAt - now)} left`
                : mining.status === "claimable"
                  ? "✅ Session complete — claim your tokens!"
                  : "💤 Not mining right now"}
            </p>
          </div>
        </div>

        {mining.status === "claimable" ? (
          <GoldButton
            disabled={busy}
            onClick={() => {
              haptic("medium");
              void run(() => doClaimMining({ data: { initData: auth } }), (r) =>
                `🎉 Claimed ${r?.reward ?? 0} ${APP.tokenName}!`
              );
            }}
          >
            🎁 Claim Mining Reward
          </GoldButton>
        ) : (
          <GoldButton
            disabled={busy || running}
            onClick={() => {
              haptic();
              void run(() => doStartMining({ data: { initData: auth } }), () => "⛏ Mining started!");
            }}
          >
            {running ? "⛏ Mining in progress…" : "🚀 Start Mining"}
          </GoldButton>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <QuickAction icon={<Ticket className="size-5" />} label="Tasks" onClick={() => onNavigate("tasks")} />
        <QuickAction icon={<Users className="size-5" />} label="Refer" onClick={() => onNavigate("refer")} />
        <QuickAction icon={<Wallet className="size-5" />} label="Withdraw" onClick={() => onNavigate("profile")} />
      </div>

      <Card>
        <SectionTitle icon="🎫" title="Reward Code" />
        <Guide>
          Reward codes are published in our community channel. Grab a code there and redeem it here
          for instant tokens.
        </Guide>
        <div className="space-y-2">
          <Field
            label="Enter reward code"
            placeholder="TIGORIX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <GoldButton
            disabled={busy || !code.trim()}
            onClick={() =>
              void run(
                () => doRedeemCode({ data: { initData: auth, code } }),
                (r) => `🎉 Code redeemed: +${r?.reward ?? 0} ${APP.tokenName}`
              ).then(() => setCode(""))
            }
          >
            🎟 Redeem Code
          </GoldButton>
          <GhostButton onClick={() => openLink(APP.communityChannel)}>
            📣 Get codes from Community
          </GhostButton>
        </div>
      </Card>

      <Card>
        <SectionTitle
          icon="🎁"
          title="Daily Reward"
          action={<Pill tone="warn">Day {daily.nextDay}/7</Pill>}
        />
        <Guide>
          Claim every day to climb the streak. Rewards reset at <b>00:00:00 UTC</b>, and missing a
          day sends you back to Day 1.
        </Guide>
        <div className="mb-3 grid grid-cols-7 gap-1.5">
          {DAILY_REWARDS.map((r, i) => {
            const day = i + 1;
            const done = day <= daily.streak;
            const active = day === daily.nextDay && !daily.claimedToday;
            return (
              <div
                key={day}
                className={`rounded-lg border p-1.5 text-center text-[10px] font-bold ${
                  done
                    ? "border-success/50 bg-success/15 text-success"
                    : active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                <div>D{day}</div>
                <div className="mt-0.5">{r}</div>
              </div>
            );
          })}
        </div>
        <GoldButton
          disabled={busy || daily.claimedToday}
          onClick={() => {
            haptic("medium");
            void run(
              () => doClaimDaily({ data: { initData: auth } }),
              (r) => `🎉 Day ${r?.day}: +${r?.reward} ${APP.tokenName}`
            );
          }}
        >
          {daily.claimedToday
            ? "✅ Claimed — back after 00:00 UTC"
            : `🎁 Claim ${daily.nextReward} ${APP.tokenName}`}
        </GoldButton>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <GhostButton onClick={() => openLink(APP.communityChannel)}>📣 Community</GhostButton>
        <GhostButton onClick={() => openLink(APP.paymentChannel)}>💸 Payments</GhostButton>
      </div>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-success" /> Secured by Tigorix anti-fraud engine
      </p>

      <div className="hidden">
        <Gift />
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="surface-card flex flex-col items-center gap-2 py-3 text-xs font-bold transition-transform active:scale-95"
    >
      <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary">
        {icon}
      </span>
      {label}
    </button>
  );
}