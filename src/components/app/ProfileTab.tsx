import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  Globe2,
  Info,
  Languages,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Trophy,
  Users,
  Wallet as WalletIcon,
} from "lucide-react";
import { APP, fmt } from "@/lib/config";
import { openLink } from "@/lib/telegram";
import { doSetPrefs, doSetWallet, doWithdraw, getFinance, getLeaderboard } from "@/lib/api.functions";
import { LANGS, useI18n } from "@/lib/i18n";
import { useAppState } from "./useApp";
import { useAdGate } from "./useAdGate";
import { Card, Field, GhostButton, GoldButton, Guide, Pill, SectionTitle, Stat } from "./ui";

type View = "root" | "wallet" | "transactions" | "leaderboard" | "about" | "language";

export function ProfileTab({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const { state, auth, run } = useAppState();
  const { t, lang } = useI18n();
  const [view, setView] = useState<View>("root");

  if (view !== "root") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView("root")}
          className="flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <ArrowLeft className="size-4" /> {t("back")}
        </button>
        {view === "wallet" && <WalletView />}
        {view === "transactions" && <TransactionsView />}
        {view === "leaderboard" && <LeaderboardView />}
        {view === "about" && <AboutView />}
        {view === "language" && <LanguageView onDone={() => setView("root")} />}
      </div>
    );
  }

  const { user } = state;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          {user.photoUrl ? (
            <img src={user.photoUrl} alt="" className="size-14 rounded-full border-2 border-primary" />
          ) : (
            <div className="bg-gold-gradient grid size-14 place-items-center rounded-full text-2xl">
              🐯
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold">
              {user.username ? `@${user.username}` : user.firstName}
            </p>
            <p className="text-[11px] text-muted-foreground">Telegram ID: {user.id}</p>
            <div className="mt-1 flex gap-1.5">
              <Pill tone={user.suspended ? "danger" : "success"}>
                {user.suspended ? "Suspended" : "Active"}
              </Pill>
              <Pill>Joined {new Date(user.createdAt).toISOString().slice(0, 10)}</Pill>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat emoji="🪙" label="Balance" value={fmt(user.balance)} />
          <Stat emoji="📈" label="Earned" value={fmt(user.totalEarned)} />
          <Stat emoji="👥" label="Refs" value={fmt(user.refCount)} />
        </div>
      </Card>

      <Group title={`💼 ${t("finance")}`}>
        <Row icon={<WalletIcon className="size-4" />} label={t("walletWithdraw")} onClick={() => setView("wallet")} />
        <Row icon={<Receipt className="size-4" />} label={t("transactions")} onClick={() => setView("transactions")} />
      </Group>

      <Group title={`🌍 ${t("social")}`}>
        <Row icon={<Users className="size-4" />} label={t("referFriends")} onClick={() => openLink(`https://t.me/share/url?url=${encodeURIComponent(`${APP.miniAppLink}?startapp=${user.id}`)}`)} />
        <Row icon={<Trophy className="size-4" />} label={t("leaderboard")} onClick={() => setView("leaderboard")} />
      </Group>

      <Group title={`📣 ${t("community")}`}>
        <Row icon={<MessageCircle className="size-4" />} label={t("communityChannel")} onClick={() => openLink(APP.communityChannel)} />
        <Row icon={<Globe2 className="size-4" />} label={t("paymentChannel")} onClick={() => openLink(APP.paymentChannel)} />
        <Row
          icon={<Receipt className="size-4" />}
          label={t("payoutProofs")}
          onClick={() =>
            openLink(
              typeof window === "undefined" ? APP.paymentChannel : `${window.location.origin}/payouts`
            )
          }
        />
      </Group>

      <Group title={`⚙️ ${t("preferences")}`}>
        <Row
          icon={<Bell className="size-4" />}
          label={t("notifications")}
          value={user.notifications ? `🔔 ${t("on")}` : `🔕 ${t("off")}`}
          onClick={() =>
            void run(
              () => doSetPrefs({ data: { initData: auth, notifications: !user.notifications } }),
              () => (user.notifications ? "🔕 Notifications off" : "🔔 Notifications on")
            )
          }
        />
        <Row
          icon={<Languages className="size-4" />}
          label={t("language")}
          value={`${LANGS.find((l) => l.code === lang)?.flag ?? ""} ${LANGS.find((l) => l.code === lang)?.label ?? "English"}`}
          onClick={() => setView("language")}
        />
        <Row icon={<Info className="size-4" />} label={t("about")} onClick={() => setView("about")} />
      </Group>

      {state.admin && (
        <Group title="🛡 Admin">
          <Row icon={<ShieldCheck className="size-4" />} label="Admin Panel" onClick={onOpenAdmin} />
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="surface-card divide-y divide-border overflow-hidden">{children}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition active:bg-muted/50"
    >
      <span className="text-primary">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted-foreground">{value ?? "›"}</span>
    </button>
  );
}

function WalletView() {
  const { state, auth, run, busy, boot } = useAppState();
  const [address, setAddress] = useState(state.user.wallet);
  const [amount, setAmount] = useState("");
  const cfg = boot.cfg;
  const min = state.user.withdrawCount === 0 ? cfg.minWithdrawFirst : cfg.minWithdrawNext;
  const tokens = Number(amount || 0);
  const gross = tokens / cfg.tokensPerUsd;
  const fee = cfg.feeFlatUsd + (gross * cfg.feePercent) / 100;

  const { data } = useQuery({
  queryKey: ["finance"],
  queryFn: () => getFinance({ data: { initData: auth } }),
  refetchInterval: false,
refetchOnWindowFocus: false,
staleTime: 30000,
});

  const paid = (data?.withdrawals ?? [])
    .filter((w) => w.status === "approved")
    .reduce((s, w) => s + (w.netUsd ?? 0), 0);
  const pending = (data?.withdrawals ?? [])
    .filter((w) => w.status === "pending")
    .reduce((s, w) => s + (w.netUsd ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Available Balance
        </p>
        <p className="mt-1 text-center text-3xl font-black">
          <span className="text-gold-gradient">{fmt(state.user.balance)}</span>{" "}
          <span className="text-sm text-muted-foreground">{APP.tokenName}</span>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          ≈ ${(state.user.balance / cfg.tokensPerUsd).toFixed(4)} USD
        </p>
      </Card>

      <Card>
        <SectionTitle icon="💳" title="USDT Wallet (BEP-20)" />
        <Guide>
          One wallet address can be linked to one account only. Double-check the address — payouts
          are final.
        </Guide>
        <div className="space-y-2">
          <Field
            label="BEP-20 address"
            placeholder="0x…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <GoldButton
            disabled={busy}
            onClick={() =>
              void run(() => doSetWallet({ data: { initData: auth, address } }), () => "💳 Wallet saved!")
            }
          >
            {state.user.wallet ? "🔁 Change Wallet" : "💾 Set Wallet"}
          </GoldButton>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="💸" title="Withdraw" action={<Pill tone="warn">Min {fmt(min)}</Pill>} />
        <Guide>
          {fmt(cfg.tokensPerUsd)} {APP.tokenName} = $1. Fee: ${cfg.feeFlatUsd} + {cfg.feePercent}%.
          First withdrawal minimum {fmt(cfg.minWithdrawFirst)} {APP.tokenName}, then{" "}
          {fmt(cfg.minWithdrawNext)} {APP.tokenName}.
        </Guide>
        <WithdrawGate data={data} tokens={tokens} min={min} busy={busy} onSubmit={() =>
          void run(
            () => doWithdraw({ data: { initData: auth, tokens } }),
            () => "💸 Withdrawal requested — admin will review it soon!"
          ).then(() => setAmount(""))
        }>
          <Field
            label={`Amount in ${APP.tokenName}`}
            inputMode="numeric"
            placeholder={String(min)}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <div className="rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Gross</span>
              <span className="text-foreground">${gross.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span>Fee</span>
              <span className="text-destructive">-${fee.toFixed(4)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-bold">
              <span>You receive</span>
              <span className="text-success">${Math.max(0, gross - fee).toFixed(4)}</span>
            </div>
          </div>
        </WithdrawGate>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat emoji="✅" label="Total paid out" value={`$${paid.toFixed(4)}`} />
        <Stat emoji="⏳" label="Pending" value={`$${pending.toFixed(4)}`} />
      </div>

      <Card>
        <SectionTitle icon="🧮" title="Converter" />
        <p className="text-xs text-muted-foreground">
          {fmt(cfg.tokensPerUsd)} {APP.tokenName} = <b className="text-foreground">$1.00</b> ·{" "}
          {fmt(state.user.balance)} {APP.tokenName} ={" "}
          <b className="text-foreground">${(state.user.balance / cfg.tokensPerUsd).toFixed(4)}</b>
        </p>
      </Card>

      <Card>
        <SectionTitle icon="📜" title="Withdrawal History" />
        {!data?.withdrawals?.length ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No withdrawals yet.</p>
        ) : (
          <div className="space-y-2">
            {data.withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-bold">
                    #{w.number} · {fmt(w.tokens)} {APP.tokenName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    ${(w.netUsd ?? 0).toFixed(4)} ·{" "}
                    {new Date(w.at).toISOString().slice(0, 16).replace("T", " ")} UTC
                  </p>
                </div>
                <Pill
                  tone={
                    w.status === "approved" ? "success" : w.status === "rejected" ? "danger" : "warn"
                  }
                >
                  {w.status}
                </Pill>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TransactionsView() {
  const { auth } = useAppState();
  const { data } = useQuery({
    queryKey: ["finance"],
    queryFn: () => getFinance({ data: { initData: auth } }),
  });
  return (
    <Card>
      <SectionTitle icon="🧾" title="All Transactions" />
      {!data?.transactions?.length ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No transactions yet.</p>
      ) : (
        <div className="space-y-2">
          {data.transactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-bold capitalize">{t.type.replace(/_/g, " ")}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(t.at).toISOString().slice(0, 16).replace("T", " ")} UTC
                </p>
              </div>
              <span className={t.amount >= 0 ? "font-bold text-success" : "font-bold text-destructive"}>
                {t.amount >= 0 ? "+" : ""}
                {fmt(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LeaderboardView() {
  const { auth } = useAppState();
  const { data } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard({ data: { initData: auth } }),
  });
  return (
    <Card>
      <SectionTitle icon="🏆" title="Top Tigers" />
      <div className="space-y-2">
        {(data ?? []).map((r) => (
          <div
            key={r.rank}
            className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs"
          >
            <span className="w-6 font-black text-primary">
              {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
            </span>
            <span className="flex-1 truncate font-bold">{r.name}</span>
            <span className="text-muted-foreground">{fmt(r.earned)}</span>
          </div>
        ))}
        {!data?.length && <p className="py-4 text-center text-xs text-muted-foreground">No data yet.</p>}
      </div>
    </Card>
  );
}

function LanguageView({ onDone }: { onDone: () => void }) {
  const { lang, setLang, t } = useI18n();
  const { auth } = useAppState();
  return (
    <Card>
      <SectionTitle icon="🌐" title={t("chooseLanguage")} />
      <div className="grid gap-2">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => {
              setLang(l.code);
              void doSetPrefs({ data: { initData: auth, language: l.code } }).catch(() => undefined);
              onDone();
            }}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold transition active:scale-[0.98] ${
              lang === l.code ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/40"
            }`}
          >
            <span className="text-xl">{l.flag}</span>
            {l.label}
            {lang === l.code && <span className="ml-auto">✅</span>}
          </button>
        ))}
      </div>
    </Card>
  );
}

function AboutView() {
  const { boot } = useAppState();
  const c = boot.cfg;
  const sections: { icon: string; title: string; body: React.ReactNode }[] = [
    {
      icon: "🐯",
      title: "What is Tigorix?",
      body: (
        <>
          Tigorix is a Telegram mini app where you earn <b>{APP.tokenName}</b> tokens every day by
          mining, completing tasks, watching ads and inviting friends — then withdraw them as real
          USDT (BEP-20).
        </>
      ),
    },
    {
      icon: "🪙",
      title: "The TGX token",
      body: (
        <>
          {fmt(c.tokensPerUsd)} {APP.tokenName} = $1 USDT. Every token you earn is recorded in your
          personal ledger, so your balance is always verifiable.
        </>
      ),
    },
    {
      icon: "⛏",
      title: "Mining",
      body: (
        <>
          Start a session and earn {fmt(c.miningReward)} {APP.tokenName} per hour. When the session
          ends the bot notifies you — claim it and start again.
        </>
      ),
    },
    {
      icon: "🎁",
      title: "Daily reward & codes",
      body: (
        <>
          Claim a daily bonus that grows for 7 days in a row (30 → 150 {APP.tokenName}). Missing a
          day restarts the streak. Daily resets happen at 00:00 UTC. Reward codes are posted in our
          community channel.
        </>
      ),
    },
    {
      icon: "👥",
      title: "Referrals",
      body: (
        <>
          Friend joins → {fmt(c.refJoin)} · Day 1 ({c.day1Ads} ads) → {fmt(c.refDay1)} · Day 2 (
          {c.day2Ads} ads) → {fmt(c.refDay2)}. Total {fmt(c.refJoin + c.refDay1 + c.refDay2)}{" "}
          {APP.tokenName} per real friend. Fake or duplicate accounts never pay.
        </>
      ),
    },
    {
      icon: "💸",
      title: "Withdrawals",
      body: (
        <>
          USDT BEP-20. First withdrawal from {fmt(c.minWithdrawFirst)} {APP.tokenName}, then from{" "}
          {fmt(c.minWithdrawNext)}. Fee ${c.feeFlatUsd} + {c.feePercent}%. One request every{" "}
          {c.withdrawCooldownHours}h. Every approved payout is posted in the payment channel with
          its transaction ID.
        </>
      ),
    },
    {
      icon: "🛡",
      title: "Fair play & security",
      body: (
        <>
          One account per person, device and IP. Every action is verified on our servers and
          balances are audited against your activity history. Cheating, multi-accounts or fake
          referrals lead to automatic suspension.
        </>
      ),
    },
    {
      icon: "📞",
      title: "Contact",
      body: (
        <>
          Bot: @{APP.botUsername} · Community: {APP.communityChannel} · Payments:{" "}
          {APP.paymentChannel}
        </>
      ),
    },
  ];
  return (
    <div className="space-y-3">
      <Card className="text-center">
        <img
          src="/tigorix-logo.png"
          alt="Tigorix logo"
          className="mx-auto size-20 animate-float rounded-full ring-4 ring-primary/40"
        />
        <h2 className="mt-3 text-xl font-black">
          <span className="text-gold-gradient">TIGORIX</span>
        </h2>
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Earn • Play • Grow
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground">Version 2.0</p>
      </Card>
      {sections.map((s) => (
        <Card key={s.title}>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-extrabold">
            <span className="text-lg">{s.icon}</span>
            {s.title}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{s.body}</p>
        </Card>
      ))}
    </div>
  );
}
function WithdrawGate({
  data,
  tokens,
  min,
  busy,
  onSubmit,
  children,
}: {
  data: Awaited<ReturnType<typeof getFinance>> | undefined;
  tokens: number;
  min: number;
  busy: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  const { gateWithRewardAds, watchingAd } = useAdGate();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const e = data?.eligibility;
  const rules = data?.rules;
  const adsToWatch = rules?.adsToWatch ?? 3;
  const cooldownLeft = e && e.nextWithdrawAt > now ? e.nextWithdrawAt - now : 0;

  const rows: { ok: boolean; label: string }[] = [];
  rows.push({ ok: !!data?.wallet, label: "💳 Wallet address set" });
  rows.push({ ok: tokens >= min, label: `🪙 Minimum ${fmt(min)} ${APP.tokenName}` });
  if (e) rows.push(...e.checks.map((c) => ({ ok: c.ok, label: c.label })));

  const allOk = !!e && rows.every((r) => r.ok);

  return (
    <div className="space-y-2">
      {children}
      {rows.length > 1 && (
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
            📋 Withdrawal requirements
          </p>
          <ul className="space-y-1.5 text-[11px]">
            {rows.map((r, i) => (
              <li key={i} className={r.ok ? "text-success" : "text-muted-foreground"}>
                {r.ok ? "✅" : "⬜"} {r.label}
              </li>
            ))}
          </ul>
          {cooldownLeft > 0 && (
            <p className="mt-2 text-[11px] font-bold text-warn">
              🕐 Next withdrawal in {Math.floor(cooldownLeft / 3600000)}h{" "}
              {Math.floor((cooldownLeft % 3600000) / 60000)}m {Math.floor((cooldownLeft % 60000) / 1000)}s
            </p>
          )}
          {!allOk && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Complete everything above, then watch {adsToWatch} short ads to submit.
            </p>
          )}
        </div>
      )}
      <GoldButton
        disabled={busy || watchingAd > 0 || !allOk}
        onClick={() => void gateWithRewardAds(adsToWatch, onSubmit)}
      >
        {watchingAd > 0
          ? `📺 Watch ads… ${adsToWatch - watchingAd + 1}/${adsToWatch}`
          : allOk
            ? `🚀 Watch ${adsToWatch} ads & Request Withdrawal`
            : "🔒 Complete requirements to withdraw"}
      </GoldButton>
    </div>
  );
}
