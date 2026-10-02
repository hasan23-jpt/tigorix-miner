import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { APP } from "@/lib/config";
import { openLink } from "@/lib/telegram";
import { doClaimDailyTask, doClaimTask, doOpenTask, doVerifyTask, getTasks } from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, GhostButton, GoldButton, Guide, Pill, SectionTitle } from "./ui";

export function TasksTab() {
  const { auth } = useAppState();
  const [opened, setOpened] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"main" | "partner" | "daily">("main");

  const { data, isLoading } = useQuery({
  queryKey: ["tasks"],
  queryFn: () => getTasks({ data: { initData: auth } }),
  refetchInterval: false,
refetchOnWindowFocus: false,
staleTime: 30000,
});

  const dailyDone = data?.dailyDone ?? [];
  const done = data?.done ?? [];
  const main = (data?.tasks ?? []).filter((t) => t.group !== "partner");
  const partner = (data?.tasks ?? []).filter((t) => t.group === "partner");

  const dailyTasks = [
    {
      key: "community",
      emoji: "📣",
      title: "View Community Channel",
      desc: "Open and stay joined in our community channel.",
      url: APP.communityChannel,
      reward: data?.dailyTaskReward ?? 50,
    },
    {
      key: "payment",
      emoji: "💸",
      title: "View Payment Channel",
      desc: "Open and stay joined in the payment proofs channel.",
      url: APP.paymentChannel,
      reward: data?.dailyTaskReward ?? 50,
    },
    {
      key: "refer",
      emoji: "👥",
      title: "Invite 1 friend today",
      desc: "Share your link and bring 1 new friend today.",
      url: "",
      reward: data?.dailyReferReward ?? 250,
    },
  ];

  return (
    <div className="space-y-4">
      <Guide>
        Complete tasks to earn {APP.tokenName}. Channel tasks are verified by our bot — you must
        stay joined, otherwise the reward is blocked. Mini app tasks unlock the claim button 5
        seconds after you open the link. Daily tasks reset at 00:00 UTC.
      </Guide>

      <div className="surface-card grid grid-cols-3 gap-2 p-1.5">
        {(
          [
            { id: "main", label: "🎯 Main" },
            { id: "partner", label: "🤝 Partner" },
            { id: "daily", label: "📅 Daily" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg py-2.5 text-xs font-extrabold transition ${
              tab === t.id ? "bg-gold-gradient text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "daily" ? (
        <DailyTasks tasks={dailyTasks} done={dailyDone} />
      ) : (
        <TaskGroup
          icon={tab === "main" ? "🎯" : "🤝"}
          title={tab === "main" ? "Main Tasks" : "Partner Tasks"}
          tasks={tab === "main" ? main : partner}
          done={done}
          opened={opened}
          setOpened={setOpened}
          empty={
            isLoading
              ? "Loading tasks…"
              : tab === "main"
                ? "No main tasks right now — check back soon! 🐯"
                : "No partner tasks right now — check back soon! 🚀"
          }
        />
      )}
    </div>
  );
}

function DailyTasks({
  tasks,
  done,
}: {
  tasks: { key: string; emoji: string; title: string; desc: string; url: string; reward: number }[];
  done: string[];
}) {
  const { auth, run, busy } = useAppState();
  return (
    <Card>
      <SectionTitle icon="📅" title="Daily Tasks" action={<Pill tone="warn">Resets 00:00 UTC</Pill>} />
      <div className="space-y-3">
        {[...tasks].sort((a, b) => Number(done.includes(a.key)) - Number(done.includes(b.key))).map((t) => {
          const claimed = done.includes(t.key);
          return (
            <div key={t.key} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="flex items-start gap-2">
                <TaskLogo src="/tigorix-logo.png" fallback={t.emoji} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                </div>
                <Pill tone="success">+{t.reward}</Pill>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <GhostButton
                  onClick={() =>
                    t.url
                      ? openLink(t.url)
                      : openLink(
                          `https://t.me/share/url?url=${encodeURIComponent(APP.miniAppLink)}&text=${encodeURIComponent("🐯 Join Tigorix and earn real rewards!")}`
                        )
                  }
                >
                  {t.url ? "🔗 Open" : "📤 Share"}
                </GhostButton>
                <GoldButton
                  disabled={busy || claimed}
                  onClick={() =>
                    void run(
                      () => doClaimDailyTask({ data: { initData: auth, key: t.key } }),
                      (r) => `🎉 +${r?.reward} ${APP.tokenName}`
                    )
                  }
                >
                  {claimed ? "✅ Claimed" : "🎁 Claim"}
                </GoldButton>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

type Task = {
  id: string;
  kind: "channel" | "app";
  title: string;
  description: string;
  url: string;
  reward: number;
  imageUrl?: string;
};

function TaskLogo({ src, fallback }: { src?: string | undefined; fallback: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad)
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-xl">{fallback}</span>
    );
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBad(true)}
      className="size-10 shrink-0 rounded-xl border border-border object-cover"
    />
  );
}

function TaskGroup({
  icon,
  title,
  tasks,
  done,
  opened,
  setOpened,
  empty,
}: {
  icon: string;
  title: string;
  tasks: Task[];
  done: string[];
  opened: Record<string, number>;
  setOpened: (v: Record<string, number>) => void;
  empty: string;
}) {
  const { auth, run, busy } = useAppState();
  return (
    <Card>
      <SectionTitle icon={icon} title={title} action={<Pill>{tasks.length}</Pill>} />
      {!tasks.length ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {[...tasks].sort((a, b) => Number(done.includes(a.id)) - Number(done.includes(b.id))).map((t, i) => (
            <TaskRow
              key={t.id}
              n={i + 1}
              t={t}
              claimed={done.includes(t.id)}
              openedAt={opened[t.id] ?? 0}
              onOpened={(at) => setOpened({ ...opened, [t.id]: at })}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function TaskRow({
  n,
  t,
  claimed,
  openedAt,
  onOpened,
}: {
  n: number;
  t: Task;
  claimed: boolean;
  openedAt: number;
  onOpened: (at: number) => void;
}) {
  const { auth, run, busy } = useAppState();
  const [now, setNow] = useState(Date.now());
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!openedAt || verified || claimed) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [openedAt, verified, claimed]);
  const waitLeft = openedAt ? Math.max(0, 5 - Math.floor((now - openedAt) / 1000)) : 5;

  const start = () => {
    onOpened(Date.now());
    setNow(Date.now());
    void doOpenTask({ data: { initData: auth, taskId: t.id } }).catch(() => {});
    openLink(t.url);
  };
  const verify = async () => {
    setChecking(true);
    try {
      await doVerifyTask({ data: { initData: auth, taskId: t.id } });
      setVerified(true);
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error(e instanceof Error ? e.message : "Not verified yet");
    } finally {
      setChecking(false);
    }
  };
  const claim = () =>
    void run(
      () => doClaimTask({ data: { initData: auth, taskId: t.id, openedAt } }),
      (r) => `🎉 +${r?.reward} ${APP.tokenName}`
    );

  let label = "▶️ Start";
  let action: () => void = start;
  let disabled = busy;
  if (claimed) {
    label = "✅ Done";
    disabled = true;
  } else if (verified) {
    label = `🎁 Claim +${t.reward}`;
    action = claim;
  } else if (openedAt) {
    if (waitLeft > 0) {
      label = `⏱ Verify in ${waitLeft}s`;
      disabled = true;
    } else {
      label = checking ? "🔎 Verifying…" : "🔎 Verify";
      action = () => void verify();
      disabled = busy || checking;
    }
  }

  return (
    <div className={`rounded-xl border border-border bg-background/40 p-3 ${claimed ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <span className="mt-2 w-5 shrink-0 text-center text-xs font-black text-primary">{n}</span>
        <TaskLogo src={t.imageUrl} fallback={t.kind === "channel" ? "📢" : "🕹"} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t.title}</p>
          {t.description && <p className="text-[11px] text-muted-foreground">{t.description}</p>}
        </div>
        <Pill tone="success">+{t.reward}</Pill>
      </div>
      <div className="mt-3 flex gap-2">
        {openedAt > 0 && !claimed && (
          <GhostButton className="w-auto px-3" onClick={() => openLink(t.url)}>🔗</GhostButton>
        )}
        <GoldButton disabled={disabled} onClick={action}>{label}</GoldButton>
      </div>
    </div>
  );
}
