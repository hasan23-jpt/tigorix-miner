import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { APP } from "@/lib/config";
import { openLink } from "@/lib/telegram";
import { doClaimDailyTask, doClaimTask, getTasks } from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, GhostButton, GoldButton, Guide, Pill, SectionTitle } from "./ui";

export function TasksTab() {
  const { auth, run, busy } = useAppState();
  const [opened, setOpened] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => getTasks({ data: { initData: auth } }),
    refetchInterval: 15000,
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

      <Card>
        <SectionTitle icon="📅" title="Daily Tasks" action={<Pill tone="warn">Resets 00:00 UTC</Pill>} />
        <div className="space-y-3">
          {dailyTasks.map((t) => {
            const claimed = dailyDone.includes(t.key);
            return (
              <div key={t.key} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-xl">{t.emoji}</span>
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

      <TaskGroup
        icon="🎯"
        title="Main Tasks"
        tasks={main}
        done={done}
        opened={opened}
        setOpened={setOpened}
        empty={isLoading ? "Loading tasks…" : "No main tasks right now — check back soon! 🐯"}
      />
      <TaskGroup
        icon="🤝"
        title="Partner Tasks"
        tasks={partner}
        done={done}
        opened={opened}
        setOpened={setOpened}
        empty={isLoading ? "Loading tasks…" : "No partner tasks right now — check back soon! 🚀"}
      />
    </div>
  );
}

type Task = {
  id: string;
  kind: "channel" | "app";
  title: string;
  description: string;
  url: string;
  reward: number;
};

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
          {tasks.map((t) => {
            const claimed = done.includes(t.id);
            const openedAt = opened[t.id] ?? 0;
            const canClaim =
              t.kind === "channel" ? true : openedAt > 0 && Date.now() - openedAt >= 5000;
            return (
              <div key={t.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-xl">{t.kind === "channel" ? "📢" : "🕹"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{t.title}</p>
                    {t.description && (
                      <p className="text-[11px] text-muted-foreground">{t.description}</p>
                    )}
                  </div>
                  <Pill tone="success">+{t.reward}</Pill>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <GhostButton
                    onClick={() => {
                      setOpened({ ...opened, [t.id]: Date.now() });
                      openLink(t.url);
                    }}
                  >
                    🔗 Open
                  </GhostButton>
                  <GoldButton
                    disabled={busy || claimed || !canClaim}
                    onClick={() =>
                      void run(
                        () =>
                          doClaimTask({
                            data: { initData: auth, taskId: t.id, openedAt },
                          }),
                        (r) => `🎉 +${r?.reward} ${APP.tokenName}`
                      )
                    }
                  >
                    {claimed ? "✅ Done" : canClaim ? "🎁 Claim" : "⏱ Wait 5s"}
                  </GoldButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}