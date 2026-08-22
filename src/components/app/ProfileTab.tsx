import { useState } from "react";
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
import { doSetWallet, doWithdraw, getFinance, getLeaderboard } from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, Field, GhostButton, GoldButton, Guide, Pill, SectionTitle, Stat } from "./ui";

type View = "root" | "wallet" | "transactions" | "leaderboard" | "about";

export function ProfileTab({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const { state } = useAppState();
  const [view, setView] = useState<View>("root");

  if (view !== "root") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView("root")}
          className="flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <ArrowLeft className="size-4" /> Back to profile
        </button>
        {view === "wallet" && <WalletView />}
        {view === "transactions" && <TransactionsView />}
        {view === "leaderboard" && <LeaderboardView />}
        {view === "about" && <AboutView />}
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

      <Group title="💼 Finance">
        <Row icon={<WalletIcon className="size-4" />} label="Wallet & Withdraw" onClick={() => setView("wallet")} />
        <Row icon={<Receipt className="size-4" />} label="Transactions" onClick={() => setView("transactions")} />
      </Group>

      <Group title="🌍 Social">
        <Row icon={<Users className="size-4" />} label="Refer Friends" onClick={() => openLink(`https://t.me/share/url?url=${encodeURIComponent(`${APP.miniAppLink}?startapp=${user.id}`)}`)} />
        <Row icon={<Trophy className="size-4" />} label="Leaderboard" onClick={() => setView("leaderboard")} />
      </Group>

      <Group title="📣 Community">
        <Row icon={<MessageCircle className="size-4" />} label="Community Channel" onClick={() => openLink(APP.communityChannel)} />
        <Row icon={<Globe2 className="size-4" />} label="Payment Channel" onClick={() => openLink(APP.paymentChannel)} />
        <Row
          icon={<Receipt className="size-4" />}
          label="Payout Proofs (public)"
          onClick={() =>
            openLink(
              typeof window === "undefined" ? APP.paymentChannel : `${window.location.origin}/payouts`
            )
          }
        />
      </Group>

      <Group title="⚙️ Preferences">
        <Row icon={<Bell className="size-4" />} label="Notifications" value={user.notifications ? "On" : "Off"} />
        <Row icon={<Languages className="size-4" />} label="Language" value={(user.language || "en").toUpperCase()} />
        <Row icon={<Info className="size-4" />} label="About Tigorix" onClick={() => setView("about")} />
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
    refetchInterval: 15000,
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
        <div className="space-y-2">
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
          <GoldButton
            disabled={busy || tokens < min}
            onClick={() =>
              void run(
                () => doWithdraw({ data: { initData: auth, tokens } }),
                () => "💸 Withdrawal requested — admin will review it soon!"
              ).then(() => setAmount(""))
            }
          >
            🚀 Request Withdrawal
          </GoldButton>
        </div>
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

function AboutView() {
  return (
    <Card>
      <SectionTitle icon="ℹ️" title="About Tigorix" />
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          🐯 <b className="text-foreground">Tigorix</b> — Earn • Play • Grow. Mine {APP.tokenName}{" "}
          tokens, complete tasks, invite friends and withdraw in USDT (BEP-20).
        </p>
        <p>🤖 Bot: @{APP.botUsername}</p>
        <p>📣 Community: {APP.communityChannel}</p>
        <p>💸 Payments: {APP.paymentChannel}</p>
        <p>🛡 Anti-fraud: one account per device/IP, ledger-verified balances.</p>
        <p>Version 1.0</p>
      </div>
    </Card>
  );
}