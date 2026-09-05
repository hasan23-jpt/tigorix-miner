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
  adminSiteDelete,
  adminSiteSave,
  adminUpdateUser,
  adminWithdrawDecision,
  adminFindUsers,
  adminUserInfo,
  adminRepairBalance,
} from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, Field, GhostButton, GoldButton, Guide, Pill, SectionTitle, Stat } from "./ui";

const TABS = ["overview", "withdrawals", "users", "tasks", "codes", "ads", "settings"] as const;
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
        <UsersAdmin admin={admin} onDone={() => void refetch()} />
      ) : tab === "tasks" ? (
        <TasksAdmin admin={admin} tasks={data.tasks} onDone={() => void refetch()} />
      ) : tab === "codes" ? (
        <CodesAdmin admin={admin} codes={data.codes} onDone={() => void refetch()} />
      ) : tab === "ads" ? (
        <AdsAdmin
          admin={admin}
          cfg={data.cfg}
          sites={data.sites ?? []}
          onDone={() => void refetch()}
        />
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
  const [photo, setPhoto] = useState("");
  const [btnText, setBtnText] = useState("");
  const [btnUrl, setBtnUrl] = useState("");
  return (
    <div className="space-y-2">
      <Guide>
        Messages always include the Open Mini App, Community and Payments buttons. Add an image URL
        to send it as a photo post, and an extra custom button if you need one.
      </Guide>
      <Field label="Message" value={text} onChange={(e) => setText(e.target.value)} />
      <Field
        label="Image URL (optional)"
        placeholder="https://…/banner.png"
        value={photo}
        onChange={(e) => setPhoto(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Extra button text"
          value={btnText}
          onChange={(e) => setBtnText(e.target.value)}
        />
        <Field
          label="Extra button URL"
          value={btnUrl}
          onChange={(e) => setBtnUrl(e.target.value)}
        />
      </div>
      <GoldButton
        disabled={busy || !text.trim()}
        onClick={() =>
          void run(
            () =>
              adminSendBroadcast({
                data: {
                  ...admin,
                  text,
                  photo: photo.trim(),
                  buttons:
                    btnText.trim() && btnUrl.trim()
                      ? [{ text: btnText.trim(), url: btnUrl.trim() }]
                      : [],
                },
              }),
            (r) => `📢 Sent to ${r?.sent ?? 0} users`
          ).then(() => {
            setText("");
            setPhoto("");
            setBtnText("");
            setBtnUrl("");
          })
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
    audit?: {
      ledger: number;
      balance: number;
      diff: number;
      ok: boolean;
      entries: number;
      adsTotal: number;
      refs: number;
      refActive: number;
      withdrawCount: number;
    } | null;
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
      {w.audit && (
        <div
          className={`mt-2 rounded-lg border p-2 text-[10px] ${
            w.audit.ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          <p className="font-bold">
            {w.audit.ok ? "✅ Balance matches activity" : "🚨 Balance mismatch — check before paying"}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Ledger {fmt(w.audit.ledger)} · Balance {fmt(w.audit.balance)} · Diff{" "}
            {fmt(Math.abs(w.audit.diff))} · {w.audit.entries} entries
          </p>
          <p className="text-muted-foreground">
            📺 {fmt(w.audit.adsTotal)} ads · 👥 {fmt(w.audit.refs)} refs ({fmt(w.audit.refActive)}{" "}
            active) · 💸 {fmt(w.audit.withdrawCount)} withdrawals
          </p>
        </div>
      )}
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
  const [maintenance, setMaintenance] = useState(cfg["maintenance"] === true);
  const [banner, setBanner] = useState(String(cfg["bannerUrl"] ?? ""));
  return (
    <>
      <Card>
        <SectionTitle
          icon="🛠️"
          title="Maintenance Mode"
          action={
            <Pill tone={maintenance ? "danger" : "success"}>{maintenance ? "on" : "off"}</Pill>
          }
        />
        <Guide>
          While maintenance is on, everyone except you sees a friendly “we are upgrading” screen and
          no earning action can run. You keep full access to the app and this panel.
        </Guide>
        <label className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-3 text-xs font-bold">
          <input
            type="checkbox"
            checked={maintenance}
            onChange={(e) => setMaintenance(e.target.checked)}
            className="size-4 accent-[hsl(var(--primary))]"
          />
          Put the app into maintenance mode
        </label>
        <div className="mt-2">
          <Field
            label="Welcome / broadcast banner image URL"
            placeholder="https://…/tigorix-banner.png"
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Used for the bot welcome message. Leave empty to use the built-in logo banner.
          </p>
        </div>
        <div className="mt-2">
          <GoldButton
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  adminSaveConfig({
                    data: { ...admin, patch: { maintenance, bannerUrl: banner.trim() } },
                  }),
                () => (maintenance ? "🛠️ Maintenance mode ON" : "✅ App is live")
              ).then(onDone)
            }
          >
            💾 Save
          </GoldButton>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="⚙️" title="Economy Settings" />
        <Guide>
          Values apply instantly to every user. Mining reward and duration are live-editable.
        </Guide>
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
    </>
  );
}

/* --------------------------------- ads & sites -------------------------------- */

const AD_TEXT_FIELDS = [
  ["adsgramIntBlockId", "Adsgram interstitial block ID"],
  ["adsgramRewardBlockId", "Adsgram rewarded block ID"],
  ["gigaBlockId", "Gigapub project ID"],
  ["monetagBlockId", "Monetag zone ID"],
  ["bitvexBlockId", "Adsbitvex zone ID"],
] as const;

const AD_NUMBER_FIELDS = [
  ["intAdReward", "Interstitial reward (tokens per ad)"],
  ["intAdsDailyCap", "Interstitial daily ad limit"],
  ["rewardAdReward", "Rewarded block reward (tokens per ad)"],
  ["rewardAdsDailyCap", "Rewarded block daily ad limit"],
  ["gigaAdReward", "Gigapub reward (tokens per ad)"],
  ["gigaAdsDailyCap", "Gigapub daily ad limit"],
  ["monetagAdReward", "Monetag reward (tokens per ad)"],
  ["monetagAdsDailyCap", "Monetag daily ad limit"],
  ["bitvexAdReward", "Adsbitvex reward (tokens per ad)"],
  ["bitvexAdsDailyCap", "Adsbitvex daily ad limit"],
  ["withdrawAdsRequired", "Daily ads required to withdraw"],
  ["withdrawMinRefs", "Valid referrals required to withdraw"],
  ["withdrawCooldownHours", "Withdrawal cooldown (hours)"],
  ["withdrawAdsToWatch", "Ads to watch when submitting a withdrawal"],
  ["day1Ads", "Referral day-1 ads required"],
  ["day2Ads", "Referral day-2 ads required"],
] as const;

type SiteRow = { id: string; title: string; url: string; reward: number; active: boolean };

function AdsAdmin({
  admin,
  cfg,
  sites,
  onDone,
}: {
  admin: AdminAuth;
  cfg: Record<string, unknown>;
  sites: SiteRow[];
  onDone: () => void;
}) {
  const { run, busy } = useAppState();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(
      [...AD_TEXT_FIELDS, ...AD_NUMBER_FIELDS].map(([k]) => [k, String(cfg[k] ?? "")])
    )
  );
  const [autoAd, setAutoAd] = useState(cfg["autoIntAd"] !== false);
  const [site, setSite] = useState<{ id?: string; title: string; url: string; reward: string }>({
    title: "",
    url: "",
    reward: "50",
  });

  return (
    <>
      <Card>
        <SectionTitle
          icon="📺"
          title="Ad Networks"
          action={<Pill tone="info">Adsgram · Gigapub · Monetag · Adsbitvex</Pill>}
        />
        <Guide>
          Set the Adsgram block IDs and rewards. The interstitial block gates mining, reward codes and
          claims; the rewarded block pays per view. Changes apply instantly.
        </Guide>
        <div className="space-y-2">
          {AD_TEXT_FIELDS.map(([k, label]) => (
            <Field
              key={k}
              label={label}
              value={form[k] ?? ""}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          ))}
          {AD_NUMBER_FIELDS.map(([k, label]) => (
            <Field
              key={k}
              label={label}
              inputMode="numeric"
              value={form[k] ?? ""}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          ))}
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-3 text-xs font-bold">
            <input
              type="checkbox"
              checked={autoAd}
              onChange={(e) => setAutoAd(e.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            Show one interstitial ad on app open / Home visit
          </label>
          <GoldButton
            disabled={busy}
            onClick={() => {
              const patch: Record<string, string | number | boolean> = { autoIntAd: autoAd };
              for (const [k] of AD_TEXT_FIELDS) patch[k] = (form[k] ?? "").trim();
              for (const [k] of AD_NUMBER_FIELDS) {
                const v = Number(form[k]);
                if (Number.isFinite(v)) patch[k] = v;
              }
              void run(
                () => adminSaveConfig({ data: { ...admin, patch } }),
                () => "✅ Ad settings saved"
              ).then(onDone);
            }}
          >
            💾 Save Ad Settings
          </GoldButton>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="🌐" title="Visit Sites" action={<Pill>{sites.length} sites</Pill>} />
        <Guide>
          Each site must be viewed for 10 seconds before the claim button unlocks, and can be claimed
          once every 24 hours per user.
        </Guide>
        <div className="mb-4 space-y-2">
          <Field
            label="Site title"
            value={site.title}
            onChange={(e) => setSite({ ...site, title: e.target.value })}
          />
          <Field
            label="Site URL"
            value={site.url}
            onChange={(e) => setSite({ ...site, url: e.target.value })}
          />
          <Field
            label="Reward (tokens)"
            inputMode="numeric"
            value={site.reward}
            onChange={(e) => setSite({ ...site, reward: e.target.value })}
          />
          <GoldButton
            disabled={busy || !site.title.trim() || !site.url.trim()}
            onClick={() =>
              void run(
                () =>
                  adminSiteSave({
                    data: {
                      ...admin,
                      site: {
                        ...(site.id ? { id: site.id } : {}),
                        title: site.title.trim(),
                        url: site.url.trim(),
                        reward: Number(site.reward) || 0,
                        active: true,
                      },
                    },
                  }),
                () => (site.id ? "✅ Site updated" : "✅ Site added")
              ).then(() => {
                setSite({ title: "", url: "", reward: "50" });
                onDone();
              })
            }
          >
            {site.id ? "💾 Update Site" : "➕ Add Site"}
          </GoldButton>
          {site.id && (
            <GhostButton onClick={() => setSite({ title: "", url: "", reward: "50" })}>
              ✖️ Cancel edit
            </GhostButton>
          )}
        </div>

        <div className="space-y-2">
          {sites.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{s.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{s.url}</p>
                </div>
                <Pill tone={s.active ? "success" : "warn"}>
                  {fmt(s.reward)} {APP.tokenName}
                </Pill>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <GhostButton
                  onClick={() =>
                    setSite({ id: s.id, title: s.title, url: s.url, reward: String(s.reward) })
                  }
                >
                  ✏️ Edit
                </GhostButton>
                <GhostButton
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        adminSiteSave({
                          data: { ...admin, site: { id: s.id, active: !s.active } },
                        }),
                      () => (s.active ? "⏸ Paused" : "▶️ Activated")
                    ).then(onDone)
                  }
                >
                  {s.active ? "⏸ Pause" : "▶️ Enable"}
                </GhostButton>
                <GhostButton
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete "${s.title}"?`)) return;
                    void run(
                      () => adminSiteDelete({ data: { ...admin, id: s.id } }),
                      () => "🗑 Site deleted"
                    ).then(onDone);
                  }}
                >
                  🗑 Delete
                </GhostButton>
              </div>
            </div>
          ))}
          {!sites.length && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No sites yet — add one above.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}

/* ---------------------------------- users -------------------------------- */

function UsersAdmin({ admin, onDone }: { admin: AdminAuth; onDone: () => void }) {
  const { run, busy } = useAppState();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: users, refetch: refetchList } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminFindUsers({ data: { ...admin, query: search } }),
  });

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ["admin-user", openId],
    enabled: !!openId,
    queryFn: () => adminUserInfo({ data: { ...admin, userId: openId! } }),
  });

  const reload = () => {
    void refetchList();
    if (openId) void refetchDetail();
    onDone();
  };

  if (openId && detail) {
    const u = detail.user;
    const a = detail.audit;
    return (
      <div className="space-y-4">
        <button
          onClick={() => setOpenId(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <ArrowLeft className="size-4" /> Back to user list
        </button>

        <Card>
          <SectionTitle
            icon="👤"
            title={u.name}
            action={<Pill tone={u.suspended ? "danger" : "success"}>{u.suspended ? "suspended" : "active"}</Pill>}
          />
          <p className="text-[11px] text-muted-foreground">
            🆔 {u.id} · joined {new Date(u.createdAt).toISOString().slice(0, 10)} · last seen{" "}
            {u.lastSeen ? new Date(u.lastSeen).toISOString().slice(5, 16).replace("T", " ") : "—"}
          </p>
          {u.suspended && u.suspendReason && (
            <p className="mt-1 text-[11px] text-destructive">⚠️ {u.suspendReason}</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat emoji="🪙" label="Balance" value={fmt(u.balance)} />
            <Stat emoji="📈" label="Total earned" value={fmt(u.totalEarned)} />
            <Stat emoji="📺" label="Ads (today/total)" value={`${fmt(u.adsToday)}/${fmt(u.adsTotal)}`} />
            <Stat emoji="👥" label="Refs (active)" value={`${fmt(u.refCount)} (${fmt(u.refActive)})`} />
            <Stat emoji="💸" label="Withdrawals" value={`${fmt(u.withdrawCount)}`} />
            <Stat emoji="💵" label="Paid out" value={`$${u.totalPaidUsd.toFixed(4)}`} />
            <Stat emoji="🎁" label="Ref pending" value={fmt(u.refEarnPending)} />
            <Stat emoji="🏦" label="Ref claimed" value={fmt(u.refEarnClaimed)} />
          </div>
          <p className="mt-2 truncate text-[10px] text-muted-foreground">
            💳 {u.wallet || "no wallet"} · 🌐 {u.ip || "—"} · 📱 {u.device || "—"}
          </p>
        </Card>

        <Card>
          <SectionTitle
            icon="🧮"
            title="Balance audit"
            action={<Pill tone={a.ok ? "success" : "danger"}>{a.ok ? "correct" : "mismatch"}</Pill>}
          />
          <p className="text-[11px] text-muted-foreground">
            Activity ledger: <b className="text-foreground">{fmt(a.ledger)}</b> · stored balance:{" "}
            <b className="text-foreground">{fmt(a.balance)}</b> · difference:{" "}
            <b className={a.ok ? "text-success" : "text-destructive"}>{fmt(Math.abs(a.diff))}</b> ·{" "}
            {a.entries} ledger entries
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            ✅ {detail.counts.tasks} tasks · 🌐 {detail.counts.sites} site visits · 💸{" "}
            {detail.counts.approvedWithdrawals}/{detail.counts.withdrawals} withdrawals approved
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <GhostButton
              disabled={busy || a.ok}
              onClick={() =>
                void run(
                  () => adminRepairBalance({ data: { ...admin, userId: u.id } }),
                  () => "✅ Balance rebuilt from activity"
                ).then(reload)
              }
            >
              🧮 Fix balance
            </GhostButton>
            <GhostButton
              disabled={busy}
              onClick={() => {
                const v = window.prompt("Set balance", String(u.balance));
                if (v === null) return;
                void run(
                  () => adminUpdateUser({ data: { ...admin, userId: u.id, balance: Number(v) } }),
                  () => "✅ Balance updated"
                ).then(reload);
              }}
            >
              🪙 Set balance
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
                ).then(reload)
              }
            >
              {u.suspended ? "✅ Unsuspend" : "🚫 Suspend"}
            </GhostButton>
          </div>
        </Card>

        <Card>
          <SectionTitle icon="🧾" title="Activity history" />
          <div className="space-y-1.5">
            {detail.transactions.map((t, i) => (
              <div
                key={`${t.at}-${i}`}
                className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px]"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {t.type} {t.note ? `· ${t.note}` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(t.at).toISOString().slice(0, 16).replace("T", " ")} UTC
                  </p>
                </div>
                <span className={t.amount >= 0 ? "font-black text-success" : "font-black text-destructive"}>
                  {t.amount >= 0 ? "+" : ""}
                  {fmt(t.amount)}
                </span>
              </div>
            ))}
            {!detail.transactions.length && (
              <p className="py-3 text-center text-[11px] text-muted-foreground">No activity yet.</p>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle icon="💸" title="Withdrawals" />
          <div className="space-y-1.5">
            {detail.withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px]"
              >
                <div>
                  <p className="font-bold">
                    #{w.number} · {fmt(w.tokens)} {APP.tokenName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    ${w.netUsd.toFixed(4)} net ·{" "}
                    {new Date(w.at).toISOString().slice(0, 16).replace("T", " ")} UTC
                  </p>
                </div>
                <Pill tone={w.status === "approved" ? "success" : w.status === "rejected" ? "danger" : "warn"}>
                  {w.status}
                </Pill>
              </div>
            ))}
            {!detail.withdrawals.length && (
              <p className="py-3 text-center text-[11px] text-muted-foreground">No withdrawals.</p>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle icon="👥" title="Referrals" />
          <div className="space-y-1.5">
            {detail.referrals.map((r, i) => (
              <div
                key={`${r.name}-${i}`}
                className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px]"
              >
                <span className="font-bold">{r.name}</span>
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
            {!detail.referrals.length && (
              <p className="py-3 text-center text-[11px] text-muted-foreground">No referrals.</p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <SectionTitle icon="👥" title="Users" action={<Pill>{users?.length ?? 0} shown</Pill>} />
      <Guide>
        Search by Telegram ID, username, name or wallet address. Open a user to see the full
        activity history and whether their balance matches their activity.
      </Guide>
      <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
        <Field
          label="Search user"
          placeholder="@username, 5419054691 or 0x…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="self-end">
          <GoldButton onClick={() => setSearch(query.trim())}>🔍 Search</GoldButton>
        </div>
      </div>
      <div className="space-y-2">
        {(users ?? []).map((u) => (
          <button
            key={u.id}
            onClick={() => setOpenId(u.id)}
            className="w-full rounded-xl border border-border bg-background/40 p-3 text-left"
          >
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
          </button>
        ))}
        {users && !users.length && (
          <p className="py-4 text-center text-xs text-muted-foreground">No users found.</p>
        )}
      </div>
    </Card>
  );
}
