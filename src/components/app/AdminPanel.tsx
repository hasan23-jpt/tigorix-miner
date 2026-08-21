import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { APP, fmt } from "@/lib/config";
import {
  adminCodeDelete,
  adminCodeSave,
  adminLoad,
  adminSaveConfig,
  adminSendBroadcast,
  adminTaskDelete,
  adminTaskSave,
  adminUpdateUser,
  adminWithdrawDecision,
} from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, Field, GhostButton, GoldButton, Guide, Pill, SectionTitle, Stat } from "./ui";

const TABS = ["overview", "withdrawals", "users", "tasks", "codes", "settings"] as const;
type Tab = (typeof TABS)[number];

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const { auth, run, busy } = useAppState();
  const [password, setPassword] = useState("");
  const [pw, setPw] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  const { data, refetch, error } = useQuery({
    queryKey: ["admin", pw],
    enabled: !!pw,
    retry: false,
    refetchInterval: 20000,
    queryFn: () => adminLoad({ data: { initData: auth, password: pw } }),
  });

  if (!pw || error) {
    return (
      <div className="space-y-4">
        <BackBtn onClick={onClose} />
        <Card>
          <SectionTitle icon="🛡" title="Admin Login" />
          <Guide>Restricted area. Only the registered admin Telegram ID can unlock this panel.</Guide>
          <div className="space-y-2">
            <Field
              label="Admin password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-xs text-destructive">❌ Invalid password or access denied.</p>}
            <GoldButton onClick={() => setPw(password)}>🔓 Unlock Panel</GoldButton>
          </div>
        </Card>
      </div>
    );
  }

  const admin = { initData: auth, password: pw };

  return (
    <div className="space-y-4">
      <BackBtn onClick={onClose} />

      <div className="surface-card flex gap-1 overflow-x-auto p-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-extrabold capitalize ${
              tab === t ? "bg-gold-gradient text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Loading admin data… ⏳</p>
      ) : tab === "overview" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat emoji="👥" label="Users" value={fmt(data.stats.users)} />
            <Stat emoji="🟢" label="Online" value={fmt(data.stats.online)} />
            <Stat emoji="🆕" label="New today" value={fmt(data.stats.newToday)} />
            <Stat emoji="🚫" label="Suspended" value={fmt(data.stats.suspended)} />
            <Stat emoji="🪙" label="Token supply" value={fmt(data.stats.supply)} />
            <Stat emoji="💵" label="Paid out" value={`$${data.stats.paidUsd.toFixed(2)}`} />
          </div>
          <Card>
            <SectionTitle icon="📢" title="Broadcast" />
            <BroadcastForm admin={admin} />
          </Card>
        </>
      ) : tab === "withdrawals" ? (
        <Card>
          <SectionTitle icon="💸" title="Withdrawals" action={<Pill tone="warn">{`$${data.stats.pendingUsd.toFixed(2)} pending`}</Pill>} />
          <div className="space-y-3">
            {data.withdrawals.map((w) => (
              <WithdrawRow key={w.id} w={w} admin={admin} onDone={() => void refetch()} />
            ))}
            {!data.withdrawals.length && (
              <p className="py-4 text-center text-xs text-muted-foreground">No withdrawals yet.</p>
            )}
          </div>
        </Card>
      ) : tab === "users" ? (
        <Card>
          <SectionTitle icon="👥" title="Users" />
          <div className="space-y-2">
            {data.users.map((u) => (
              <div key={u.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {u.id} · {fmt(u.balance)} {APP.tokenName} · {u.refs} refs
                    </p>
                  </div>
                  <Pill tone={u.suspended ? "danger" : "success"}>
                    {u.suspended ? "suspended" : "active"}
                  </Pill>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <GhostButton
                    disabled={busy}
                    onClick={() => {
                      const v = window.prompt("Set balance", String(u.balance));
                      if (v === null) return;
                      void run(
                        () => adminUpdateUser({ data: { ...admin, userId: u.id, balance: Number(v) } }),
                        () => "✅ Balance updated"
                      ).then(() => void refetch());
                    }}
                  >
                    🪙 Balance
                  </GhostButton>
                  <GhostButton
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          adminUpdateUser({
                            data: { ...admin, userId: u.id, suspended: !u.suspended },
                          }),
                        () => (u.suspended ? "✅ Unsuspended" : "🚫 Suspended")
                      ).then(() => void refetch())
                    }
                  >
                    {u.suspended ? "✅ Unsuspend" : "🚫 Suspend"}
                  </GhostButton>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : tab === "tasks" ? (
        <TasksAdmin admin={admin} tasks={data.tasks} onDone={() => void refetch()} />
      ) : tab === "codes" ? (
        <CodesAdmin admin={admin} codes={data.codes} onDone={() => void refetch()} />
      ) : (
        <SettingsAdmin admin={admin} cfg={data.cfg} onDone={() => void refetch()} />
      )}
    </div>
  );
}

type AdminAuth = { initData: string; password: string };

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-xs font-bold text-primary">
      <ArrowLeft className="size-4" /> Back to app
    </button>
  );
}

function BroadcastForm({ admin }: { admin: AdminAuth }) {
  const { run, busy } = useAppState();
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      <Field label="Message" value={text} onChange={(e) => setText(e.target.value)} />
      <GoldButton
        disabled={busy || !text.trim()}
        onClick={() =>
          void run(
            () => adminSendBroadcast({ data: { ...admin, text } }),
            (r) => `📢 Sent to ${r?.sent ?? 0} users`
          ).then(() => setText(""))
        }
      >
        📢 Send Broadcast
      </GoldButton>
    </div>
  );
}

function WithdrawRow({
  w,
  admin,
  onDone,
}: {
  w: {
    id: string;
    name: string;
    number: number;
    tokens: number;
    feeUsd: number;
    netUsd: number;
    wallet: string;
    status: string;
  };
  admin: AdminAuth;
  onDone: () => void;
}) {
  const { run, busy } = useAppState();
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-bold">
          #{w.number} · {w.name}
        </p>
        <Pill tone={w.status === "approved" ? "success" : w.status === "rejected" ? "danger" : "warn"}>
          {w.status}
        </Pill>
      </div>
      <p className="mt-1 text-muted-foreground">
        🪙 {fmt(w.tokens)} · 🧾 ${w.feeUsd.toFixed(4)} · 💵 ${w.netUsd.toFixed(4)}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">💳 {w.wallet}</p>
      {w.status === "pending" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <GoldButton
            disabled={busy}
            onClick={() => {
              const txId = window.prompt("Transaction ID (TX hash)") ?? "";
              if (!txId) {
                toast.error("TX ID is required to approve");
                return;
              }
              void run(
                () => adminWithdrawDecision({ data: { ...admin, id: w.id, approve: true, txId } }),
                () => "✅ Approved & notified"
              ).then(onDone);
            }}
          >
            ✅ Approve
          </GoldButton>
          <GhostButton
            disabled={busy}
            onClick={() =>
              void run(
                () => adminWithdrawDecision({ data: { ...admin, id: w.id, approve: false, txId: "" } }),
                () => "❌ Rejected & refunded"
              ).then(onDone)
            }
          >
            ❌ Reject
          </GhostButton>
        </div>
      )}
    </div>
  );
}

function TasksAdmin({
  admin,
  tasks,
  onDone,
}: {
  admin: AdminAuth;
  tasks: {
    id: string;
    group: string;
    kind: string;
    title: string;
    url: string;
    reward: number;
  }[];
  onDone: () => void;
}) {
  const { run, busy } = useAppState();
  const [form, setForm] = useState({
    title: "",
    url: "",
    chatId: "",
    reward: "100",
    group: "main" as "main" | "partner",
    kind: "channel" as "channel" | "app",
  });

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon="➕" title="Add / Edit Task" />
        <div className="space-y-2">
          <Field label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Field label="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <Field
            label="Channel chat id (@channel, for channel tasks)"
            value={form.chatId}
            onChange={(e) => setForm({ ...form, chatId: e.target.value })}
          />
          <Field
            label="Reward"
            inputMode="numeric"
            value={form.reward}
            onChange={(e) => setForm({ ...form, reward: e.target.value.replace(/[^0-9]/g, "") })}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value as "main" | "partner" })}
              className="rounded-xl border border-input bg-background/70 px-3 py-2.5 text-sm"
            >
              <option value="main">Main task</option>
              <option value="partner">Partner task</option>
            </select>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as "channel" | "app" })}
              className="rounded-xl border border-input bg-background/70 px-3 py-2.5 text-sm"
            >
              <option value="channel">Telegram channel</option>
              <option value="app">Mini app / link</option>
            </select>
          </div>
          <GoldButton
            disabled={busy || !form.title || !form.url}
            onClick={() =>
              void run(
                () =>
                  adminTaskSave({
                    data: {
                      ...admin,
                      task: {
                        title: form.title,
                        url: form.url,
                        chatId: form.chatId,
                        reward: Number(form.reward || 0),
                        group: form.group,
                        kind: form.kind,
                        active: true,
                      },
                    },
                  }),
                () => "✅ Task saved"
              ).then(() => {
                setForm({ ...form, title: "", url: "", chatId: "" });
                onDone();
              })
            }
          >
            💾 Save Task
          </GoldButton>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="📋" title="Existing Tasks" />
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-background/40 p-3 text-xs">
              <p className="font-bold">{t.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {t.group} · {t.kind} · +{t.reward} · {t.url}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <GhostButton
                  onClick={() =>
                    setForm({
                      title: t.title,
                      url: t.url,
                      chatId: "",
                      reward: String(t.reward),
                      group: t.group === "partner" ? "partner" : "main",
                      kind: t.kind === "app" ? "app" : "channel",
                    })
                  }
                >
                  ✏️ Load
                </GhostButton>
                <GhostButton
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => adminTaskDelete({ data: { ...admin, id: t.id } }),
                      () => "🗑 Task removed"
                    ).then(onDone)
                  }
                >
                  🗑 Remove
                </GhostButton>
              </div>
            </div>
          ))}
          {!tasks.length && <p className="py-4 text-center text-muted-foreground">No tasks yet.</p>}
        </div>
      </Card>
    </div>
  );
}

function CodesAdmin({
  admin,
  codes,
  onDone,
}: {
  admin: AdminAuth;
  codes: { id: string; reward: number; uses: number; maxUses: number; active: boolean }[];
  onDone: () => void;
}) {
  const { run, busy } = useAppState();
  const [form, setForm] = useState({ code: "", reward: "500", maxUses: "100" });
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon="🎫" title="Create Reward Code" />
        <div className="space-y-2">
          <Field
            label="Code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <Field
            label="Reward"
            inputMode="numeric"
            value={form.reward}
            onChange={(e) => setForm({ ...form, reward: e.target.value.replace(/[^0-9]/g, "") })}
          />
          <Field
            label="Max uses (0 = unlimited)"
            inputMode="numeric"
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value.replace(/[^0-9]/g, "") })}
          />
          <GoldButton
            disabled={busy || !form.code}
            onClick={() =>
              void run(
                () =>
                  adminCodeSave({
                    data: {
                      ...admin,
                      code: form.code,
                      reward: Number(form.reward || 0),
                      maxUses: Number(form.maxUses || 0),
                      active: true,
                    },
                  }),
                () => "✅ Code saved"
              ).then(() => {
                setForm({ ...form, code: "" });
                onDone();
              })
            }
          >
            💾 Save Code
          </GoldButton>
        </div>
      </Card>
      <Card>
        <SectionTitle icon="📋" title="Codes" />
        <div className="space-y-2">
          {codes.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3 text-xs"
            >
              <div>
                <p className="font-bold">{c.id}</p>
                <p className="text-[10px] text-muted-foreground">
                  +{c.reward} · {c.uses}/{c.maxUses || "∞"} used
                </p>
              </div>
              <button
                className="text-destructive"
                onClick={() =>
                  void run(
                    () => adminCodeDelete({ data: { ...admin, code: c.id } }),
                    () => "🗑 Code removed"
                  ).then(onDone)
                }
              >
                🗑
              </button>
            </div>
          ))}
          {!codes.length && <p className="py-4 text-center text-muted-foreground">No codes yet.</p>}
        </div>
      </Card>
    </div>
  );
}

const NUMERIC_FIELDS = [
  ["miningReward", "Mining reward / hour"],
  ["miningHours", "Mining duration (hours)"],
  ["dailyTaskReward", "Daily channel task reward"],
  ["dailyReferReward", "Daily refer task reward"],
  ["refJoin", "Referral join reward"],
  ["refDay1", "Referral day-1 reward"],
  ["refDay2", "Referral day-2 reward"],
  ["day1Ads", "Day-1 active check-ins required"],
  ["day2Ads", "Day-2 active check-ins required"],
  ["adReward", "Reward per optional ad view"],
  ["adsDailyCap", "Daily optional ad view limit"],

  ["minWithdrawFirst", "Min first withdrawal"],
  ["minWithdrawNext", "Min next withdrawals"],
  ["feeFlatUsd", "Flat fee (USD)"],
  ["feePercent", "Fee percent"],
  ["tokensPerUsd", "Tokens per USD"],
] as const;

function SettingsAdmin({
  admin,
  cfg,
  onDone,
}: {
  admin: AdminAuth;
  cfg: Record<string, unknown>;
  onDone: () => void;
}) {
  const { run, busy } = useAppState();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(NUMERIC_FIELDS.map(([k]) => [k, String(cfg[k] ?? "")]))
  );
  return (
    <Card>
      <SectionTitle icon="⚙️" title="Economy Settings" />
      <Guide>Values apply instantly to every user. Mining reward and duration are live-editable.</Guide>
      <div className="space-y-2">
        {NUMERIC_FIELDS.map(([k, label]) => (
          <Field
            key={k}
            label={label}
            value={form[k] ?? ""}
            onChange={(e) => setForm({ ...form, [k]: e.target.value })}
          />
        ))}
        <GoldButton
          disabled={busy}
          onClick={() => {
            const patch: Record<string, number> = {};
            for (const [k] of NUMERIC_FIELDS) {
              const v = Number(form[k]);
              if (Number.isFinite(v)) patch[k] = v;
            }
            void run(
              () => adminSaveConfig({ data: { ...admin, patch } }),
              () => "✅ Settings saved"
            ).then(onDone);
          }}
        >
          💾 Save Settings
        </GoldButton>
      </div>
    </Card>
  );
}