/** Tigorix business logic. Server only — never imported by the browser. */
import { APP, DAILY_REWARDS, utcDayKey } from "./config";
import { getDoc, setDoc, deleteDoc, queryDocs } from "./fsdb.server";
import { btn, isChannelMember, notifyAdmin, sendMessage } from "./bot.server";
import type { AuthUser } from "./bot.server";

export type Cfg = {
  miningReward: number;
  miningHours: number;
  dailyTaskReward: number;
  dailyReferReward: number;
  refJoin: number;
  refDay1: number;
  refDay2: number;
  day1Ads: number;
  day2Ads: number;
  minWithdrawFirst: number;
  minWithdrawNext: number;
  feeFlatUsd: number;
  feePercent: number;
  tokensPerUsd: number;
  adminPassword: string;
  maintenance: boolean;
};

const DEFAULT_CFG: Cfg = {
  miningReward: 100,
  miningHours: 1,
  dailyTaskReward: 50,
  dailyReferReward: 250,
  refJoin: 250,
  refDay1: 500,
  refDay2: 750,
  day1Ads: 10,
  day2Ads: 15,
  minWithdrawFirst: 10000,
  minWithdrawNext: 20000,
  feeFlatUsd: 0.01,
  feePercent: 5,
  tokensPerUsd: APP.tokensPerUsd,
  adminPassword: "Aabbcc.123",
  maintenance: false,
};

export async function getCfg(): Promise<Cfg> {
  const doc = (await getDoc<Partial<Cfg>>("config/app")) ?? {};
  return { ...DEFAULT_CFG, ...doc };
}

export async function saveCfg(patch: Partial<Cfg>) {
  await setDoc("config/app", patch as Record<string, unknown>);
  return getCfg();
}

export type UserDoc = {
  id: string;
  username: string;
  firstName: string;
  photoUrl: string;
  balance: number;
  totalEarned: number;
  createdAt: number;
  lastSeen: number;
  suspended: boolean;
  suspendReason: string;
  miningStart: number;
  miningClaimed: boolean;
  dailyStreak: number;
  dailyLast: string;
  refBy: string;
  refCount: number;
  refActive: number;
  refEarnPending: number;
  refEarnClaimed: number;
  adsTotal: number;
  adsDayKey: string;
  adsToday: number;
  wallet: string;
  withdrawCount: number;
  totalPaidUsd: number;
  ip: string;
  device: string;
  notifications: boolean;
  language: string;
};

function blankUser(a: AuthUser): UserDoc {
  return {
    id: a.id,
    username: a.username,
    firstName: a.firstName,
    photoUrl: a.photoUrl,
    balance: 0,
    totalEarned: 0,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    suspended: false,
    suspendReason: "",
    miningStart: 0,
    miningClaimed: true,
    dailyStreak: 0,
    dailyLast: "",
    refBy: "",
    refCount: 0,
    refActive: 0,
    refEarnPending: 0,
    refEarnClaimed: 0,
    adsTotal: 0,
    adsDayKey: "",
    adsToday: 0,
    wallet: "",
    withdrawCount: 0,
    totalPaidUsd: 0,
    ip: "",
    device: "",
    notifications: true,
    language: a.languageCode || "en",
  };
}

export function isAdmin(id: string) {
  return id === APP.adminTelegramId;
}

/* ------------------------------- ledger -------------------------------- */

export async function credit(user: UserDoc, amount: number, type: string, note = "") {
  const balance = Math.max(0, Math.round(user.balance + amount));
  const totalEarned = user.totalEarned + Math.max(0, amount);
  await setDoc(`users/${user.id}`, { balance, totalEarned });
  await setDoc(`transactions/${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, {
    userId: user.id,
    type,
    amount,
    note,
    at: Date.now(),
    balanceAfter: balance,
  });
  user.balance = balance;
  user.totalEarned = totalEarned;
  return balance;
}

/** Recomputes the balance from the ledger; auto-suspends on mismatch. */
export async function auditBalance(user: UserDoc) {
  const tx = await queryDocs<{ amount: number }>("transactions", {
    where: [{ field: "userId", op: "EQUAL", value: user.id }],
    limit: 1000,
  });
  if (!tx.length) return true;
  const expected = tx.reduce((s, t) => s + (t.amount ?? 0), 0);
  if (Math.abs(expected - user.balance) > 1) {
    await suspend(user, `Balance mismatch: ledger ${expected} vs balance ${user.balance}`);
    return false;
  }
  return true;
}

export async function suspend(user: UserDoc, reason: string) {
  await setDoc(`users/${user.id}`, { suspended: true, suspendReason: reason });
  user.suspended = true;
  user.suspendReason = reason;
  await notifyAdmin(
    `🚨 <b>Account auto-suspended</b>\n\n👤 ${label(user)}\n🆔 <code>${user.id}</code>\n⚠️ ${reason}`
  );
}

export function label(u: { username?: string; firstName?: string; id?: string }) {
  return u.username ? `@${u.username}` : (u.firstName || `User ${u.id ?? ""}`);
}

export function assertActive(user: UserDoc) {
  if (user.suspended)
    throw new Error(`🚫 Your account is suspended. ${user.suspendReason || "Contact support."}`);
}

/* -------------------------- bootstrap / session ------------------------ */

export async function loadUser(auth: AuthUser) {
  return (await getDoc<UserDoc>(`users/${auth.id}`)) ?? null;
}

export async function ensureUser(
  auth: AuthUser,
  meta: { ip: string; device: string; ref: string; origin: string }
) {
  let user = await loadUser(auth);
  const isNew = !user;

  if (!user) {
    user = blankUser(auth);
    user.ip = meta.ip;
    user.device = meta.device;

    // Anti multi-account: first account per IP / device wins, the rest are suspended.
    const dupIp = meta.ip
      ? await queryDocs<UserDoc>("users", {
          where: [{ field: "ip", op: "EQUAL", value: meta.ip }],
          limit: 5,
        })
      : [];
    const dupDevice = meta.device
      ? await queryDocs<UserDoc>("users", {
          where: [{ field: "device", op: "EQUAL", value: meta.device }],
          limit: 5,
        })
      : [];
    const duplicate = [...dupIp, ...dupDevice].filter((u) => u.id !== auth.id);
    if (duplicate.length) {
      user.suspended = true;
      user.suspendReason = "Multiple accounts detected from the same device/IP.";
    }

    const refId = (meta.ref || "").replace(/[^0-9]/g, "");
    if (refId && refId !== auth.id) {
      const referrer = await getDoc<UserDoc>(`users/${refId}`);
      if (referrer) {
        const fraud = user.suspended || referrer.ip === meta.ip || referrer.device === meta.device;
        user.refBy = refId;
        const cfg = await getCfg();
        await setDoc(`referrals/${auth.id}`, {
          referrer: refId,
          referred: auth.id,
          name: label(user),
          status: "pending",
          fake: fraud,
          day1Ads: 0,
          day2Ads: 0,
          joinPaid: !fraud,
          day1Paid: false,
          day2Paid: false,
          createdAt: Date.now(),
        });
        await setDoc(`users/${refId}`, {
          refCount: (referrer.refCount ?? 0) + 1,
          refEarnPending: (referrer.refEarnPending ?? 0) + (fraud ? 0 : cfg.refJoin),
        });
        if (!fraud && referrer.notifications !== false) {
          await sendMessage(
            refId,
            `🎉 <b>New referral joined!</b>\n\n👤 ${label(user)}\n🎁 +${cfg.refJoin} ${APP.tokenName} ready to claim\n📈 Ask them to watch ads to unlock up to ${cfg.refJoin + cfg.refDay1 + cfg.refDay2} ${APP.tokenName}!`,
            [[btn.miniApp]]
          );
        }
      }
    }

    await setDoc(`users/${auth.id}`, user as unknown as Record<string, unknown>);
    await notifyAdmin(
      `🆕 <b>New user joined Tigorix</b>\n\n👤 ${label(user)}\n🆔 <code>${auth.id}</code>\n🔗 Ref: ${user.refBy || "direct"}\n🚦 ${user.suspended ? "Suspended (duplicate)" : "Active"}`
    );
    await sendMessage(
      auth.id,
      `🐯 <b>Welcome to Tigorix, ${user.firstName}!</b>\n\n⚡ Earn • Play • Grow\n⛏ Start mining, complete tasks and invite friends to earn ${APP.tokenName} tokens.\n💸 Withdraw in USDT (BEP-20).\n\n👇 Tap below to begin.`,
      [[btn.miniApp], [btn.community]]
    );
  } else {
    await setDoc(`users/${auth.id}`, {
      username: auth.username,
      firstName: auth.firstName,
      photoUrl: auth.photoUrl,
      lastSeen: Date.now(),
    });
    user.username = auth.username;
    user.firstName = auth.firstName;
    user.photoUrl = auth.photoUrl;
    user.lastSeen = Date.now();
    if (!user.suspended) await auditBalance(user);
  }
  return { user, isNew };
}

/* -------------------------------- mining ------------------------------- */

export function miningState(user: UserDoc, cfg: Cfg) {
  const duration = cfg.miningHours * 3600 * 1000;
  if (!user.miningStart) return { status: "idle" as const, endsAt: 0, progress: 0, reward: 0 };
  const endsAt = user.miningStart + duration;
  if (Date.now() < endsAt)
    return {
      status: "running" as const,
      endsAt,
      progress: (Date.now() - user.miningStart) / duration,
      reward: cfg.miningReward * cfg.miningHours,
    };
  if (user.miningClaimed) return { status: "idle" as const, endsAt: 0, progress: 0, reward: 0 };
  return {
    status: "claimable" as const,
    endsAt,
    progress: 1,
    reward: cfg.miningReward * cfg.miningHours,
  };
}

export async function startMining(user: UserDoc, cfg: Cfg) {
  assertActive(user);
  const state = miningState(user, cfg);
  if (state.status !== "idle") throw new Error("⛏ Mining is already in progress.");
  await setDoc(`users/${user.id}`, { miningStart: Date.now(), miningClaimed: false });
  user.miningStart = Date.now();
  user.miningClaimed = false;
  return miningState(user, cfg);
}

export async function claimMining(user: UserDoc, cfg: Cfg) {
  assertActive(user);
  const state = miningState(user, cfg);
  if (state.status !== "claimable") throw new Error("⏳ Mining is not finished yet.");
  await setDoc(`users/${user.id}`, { miningStart: 0, miningClaimed: true });
  user.miningStart = 0;
  user.miningClaimed = true;
  await credit(user, state.reward, "mining", "Mining claim");
  if (user.notifications !== false) {
    await sendMessage(
      user.id,
      `⛏ <b>Mining complete!</b>\n\n💰 +${state.reward} ${APP.tokenName} added to your balance\n🏦 Balance: <b>${user.balance} ${APP.tokenName}</b>\n\n🔁 Start a new mining session now!`,
      [[btn.miniApp]]
    );
  }
  return { reward: state.reward, balance: user.balance };
}

/* ------------------------------ daily bonus ---------------------------- */

export function dailyState(user: UserDoc) {
  const today = utcDayKey();
  const yesterday = utcDayKey(new Date(Date.now() - 86400000));
  const claimedToday = user.dailyLast === today;
  const continues = user.dailyLast === yesterday || user.dailyLast === today;
  const streak = continues ? user.dailyStreak : 0;
  const nextDay = claimedToday ? streak : Math.min(streak + 1, 7);
  return {
    claimedToday,
    streak,
    nextDay: nextDay || 1,
    nextReward: DAILY_REWARDS[(nextDay || 1) - 1] ?? DAILY_REWARDS[0]!,
    rewards: DAILY_REWARDS,
  };
}

export async function claimDaily(user: UserDoc) {
  assertActive(user);
  const state = dailyState(user);
  if (state.claimedToday) throw new Error("🎁 Daily reward already claimed. Come back after 00:00 UTC.");
  const day = state.nextDay;
  const reward = DAILY_REWARDS[day - 1] ?? DAILY_REWARDS[0]!;
  await setDoc(`users/${user.id}`, { dailyStreak: day >= 7 ? 0 : day, dailyLast: utcDayKey() });
  user.dailyStreak = day >= 7 ? 0 : day;
  user.dailyLast = utcDayKey();
  await credit(user, reward, "daily", `Daily reward day ${day}`);
  return { reward, day, balance: user.balance };
}

/* -------------------------------- tasks -------------------------------- */

export type TaskDoc = {
  id: string;
  group: "main" | "partner";
  kind: "channel" | "app";
  title: string;
  description: string;
  url: string;
  chatId: string;
  reward: number;
  active: boolean;
  createdAt: number;
};

export async function listTasks() {
  const tasks = await queryDocs<TaskDoc>("tasks", { limit: 200 });
  return tasks.filter((t) => t.active !== false);
}

export async function taskStatus(user: UserDoc) {
  const claims = await queryDocs<{ taskId: string }>("taskClaims", {
    where: [{ field: "userId", op: "EQUAL", value: user.id }],
    limit: 500,
  });
  const today = utcDayKey();
  const daily = await queryDocs<{ key: string }>("dailyTaskClaims", {
    where: [
      { field: "userId", op: "EQUAL", value: user.id },
      { field: "day", op: "EQUAL", value: today },
    ],
    limit: 50,
  });
  return {
    done: claims.map((c) => c.taskId),
    dailyDone: daily.map((d) => d.key),
  };
}

export async function claimDailyTask(user: UserDoc, cfg: Cfg, key: string) {
  assertActive(user);
  const today = utcDayKey();
  const id = `${user.id}_${key}_${today}`;
  if (await getDoc(`dailyTaskClaims/${id}`)) throw new Error("✅ Already claimed today.");

  let reward = cfg.dailyTaskReward;
  if (key === "community" || key === "payment") {
    const chatId = key === "community" ? APP.communityChatId : APP.paymentChatId;
    const member = await isChannelMember(chatId, user.id);
    if (!member) throw new Error("📣 Please join the channel first, then claim again.");
  } else if (key === "refer") {
    const refs = await queryDocs<{ createdAt: number }>("referrals", {
      where: [{ field: "referrer", op: "EQUAL", value: user.id }],
      limit: 200,
    });
    const todayRefs = refs.filter((r) => utcDayKey(new Date(r.createdAt ?? 0)) === today);
    if (!todayRefs.length) throw new Error("👥 Invite at least 1 friend today, then claim.");
    reward = cfg.dailyReferReward;
  } else {
    throw new Error("Unknown task");
  }

  await setDoc(`dailyTaskClaims/${id}`, { userId: user.id, key, day: today, at: Date.now(), reward });
  await credit(user, reward, "daily_task", `Daily task: ${key}`);
  return { reward, balance: user.balance };
}

export async function claimTask(user: UserDoc, taskId: string, openedAt: number) {
  assertActive(user);
  const task = await getDoc<TaskDoc>(`tasks/${taskId}`);
  if (!task || task.active === false) throw new Error("Task is no longer available.");
  const claimId = `${user.id}_${taskId}`;
  if (await getDoc(`taskClaims/${claimId}`)) throw new Error("✅ Task already completed.");

  if (task.kind === "channel") {
    const chatId = task.chatId || task.url.replace("https://t.me/", "@");
    const member = await isChannelMember(chatId, user.id);
    if (!member) throw new Error("📣 You are not a member yet. Join the channel and claim again.");
  } else if (!openedAt || Date.now() - openedAt < 5000) {
    throw new Error("⏱ Please stay on the link for at least 5 seconds.");
  }

  await setDoc(`taskClaims/${claimId}`, {
    userId: user.id,
    taskId,
    reward: task.reward,
    at: Date.now(),
  });
  await credit(user, task.reward, "task", task.title);
  return { reward: task.reward, balance: user.balance };
}

/* ------------------------------ ads / referrals ------------------------ */

export async function recordAdView(user: UserDoc, cfg: Cfg) {
  assertActive(user);
  const today = utcDayKey();
  const adsToday = user.adsDayKey === today ? user.adsToday + 1 : 1;
  await setDoc(`users/${user.id}`, {
    adsDayKey: today,
    adsToday,
    adsTotal: (user.adsTotal ?? 0) + 1,
  });
  user.adsDayKey = today;
  user.adsToday = adsToday;
  user.adsTotal = (user.adsTotal ?? 0) + 1;

  // Referral progression is driven by the referred user's ad views.
  const ref = await getDoc<{
    referrer: string;
    status: string;
    fake: boolean;
    day1Ads: number;
    day2Ads: number;
    day1Paid: boolean;
    day2Paid: boolean;
    createdAt: number;
  }>(`referrals/${user.id}`);
  if (ref && !ref.fake) {
    const dayIndex = Math.floor((Date.now() - (ref.createdAt ?? 0)) / 86400000) + 1;
    const patch: Record<string, unknown> = {};
    if (dayIndex <= 1) patch["day1Ads"] = (ref.day1Ads ?? 0) + 1;
    else if (dayIndex === 2) patch["day2Ads"] = (ref.day2Ads ?? 0) + 1;
    const day1 = Number(patch["day1Ads"] ?? ref.day1Ads ?? 0);
    const day2 = Number(patch["day2Ads"] ?? ref.day2Ads ?? 0);

    let bonus = 0;
    if (!ref.day1Paid && day1 >= cfg.day1Ads) {
      patch["day1Paid"] = true;
      patch["status"] = "mid";
      bonus += cfg.refDay1;
    }
    if (!ref.day2Paid && day2 >= cfg.day2Ads) {
      patch["day2Paid"] = true;
      patch["status"] = "verified";
      bonus += cfg.refDay2;
    }
    await setDoc(`referrals/${user.id}`, patch);
    if (bonus > 0) {
      const referrer = await getDoc<UserDoc>(`users/${ref.referrer}`);
      if (referrer) {
        await setDoc(`users/${ref.referrer}`, {
          refEarnPending: (referrer.refEarnPending ?? 0) + bonus,
          refActive:
            patch["day2Paid"] === true ? (referrer.refActive ?? 0) + 1 : (referrer.refActive ?? 0),
        });
        if (referrer.notifications !== false) {
          await sendMessage(
            ref.referrer,
            `🔥 <b>Referral progress!</b>\n\n👤 ${label(user)}\n🎁 +${bonus} ${APP.tokenName} unlocked\n💼 Claim it in the Refer tab.`,
            [[btn.miniApp]]
          );
        }
      }
    }
  }
  return { adsToday, adsTotal: user.adsTotal };
}

export async function referralOverview(user: UserDoc) {
  const refs = await queryDocs<{
    name: string;
    status: string;
    fake: boolean;
    createdAt: number;
  }>("referrals", {
    where: [{ field: "referrer", op: "EQUAL", value: user.id }],
    limit: 200,
  });
  return {
    total: refs.length,
    active: refs.filter((r) => r.status === "verified").length,
    pending: user.refEarnPending ?? 0,
    claimed: user.refEarnClaimed ?? 0,
    history: refs
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .map((r) => ({
        name: r.name ?? "User",
        status: r.fake ? "fake" : (r.status ?? "pending"),
        at: r.createdAt ?? 0,
      })),
  };
}

export async function claimReferralEarnings(user: UserDoc) {
  assertActive(user);
  const amount = Math.floor(user.refEarnPending ?? 0);
  if (amount <= 0) throw new Error("👥 No referral rewards to claim yet.");
  await setDoc(`users/${user.id}`, {
    refEarnPending: 0,
    refEarnClaimed: (user.refEarnClaimed ?? 0) + amount,
  });
  user.refEarnPending = 0;
  user.refEarnClaimed = (user.refEarnClaimed ?? 0) + amount;
  await credit(user, amount, "referral", "Referral rewards claim");
  return { reward: amount, balance: user.balance };
}

/* ------------------------------ reward codes --------------------------- */

export async function redeemCode(user: UserDoc, rawCode: string) {
  assertActive(user);
  const code = rawCode.trim().toUpperCase().slice(0, 32);
  if (!code) throw new Error("Enter a reward code.");
  const doc = await getDoc<{ reward: number; uses: number; maxUses: number; active: boolean }>(
    `codes/${code}`
  );
  if (!doc || doc.active === false) throw new Error("❌ Invalid or expired reward code.");
  if (doc.maxUses && (doc.uses ?? 0) >= doc.maxUses) throw new Error("❌ This code is fully used.");
  const claimId = `${user.id}_${code}`;
  if (await getDoc(`codeClaims/${claimId}`)) throw new Error("✅ You already used this code.");
  await setDoc(`codeClaims/${claimId}`, { userId: user.id, code, at: Date.now() });
  await setDoc(`codes/${code}`, { uses: (doc.uses ?? 0) + 1 });
  await credit(user, doc.reward, "code", `Reward code ${code}`);
  return { reward: doc.reward, balance: user.balance };
}

/* -------------------------------- wallet ------------------------------- */

export async function setWallet(user: UserDoc, address: string) {
  assertActive(user);
  const addr = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr))
    throw new Error("❌ Enter a valid USDT BEP-20 (BSC) address starting with 0x.");
  const existing = await queryDocs<UserDoc>("users", {
    where: [{ field: "wallet", op: "EQUAL", value: addr }],
    limit: 5,
  });
  if (existing.some((u) => u.id !== user.id))
    throw new Error("❌ This wallet address is already linked to another account.");
  await setDoc(`users/${user.id}`, { wallet: addr });
  user.wallet = addr;
  return { wallet: addr };
}

export function withdrawQuote(tokens: number, cfg: Cfg) {
  const gross = tokens / cfg.tokensPerUsd;
  const fee = cfg.feeFlatUsd + (gross * cfg.feePercent) / 100;
  return { gross, fee, net: Math.max(0, gross - fee) };
}

export async function requestWithdraw(user: UserDoc, cfg: Cfg, tokens: number) {
  assertActive(user);
  const amount = Math.floor(tokens);
  const min = (user.withdrawCount ?? 0) === 0 ? cfg.minWithdrawFirst : cfg.minWithdrawNext;
  if (!user.wallet) throw new Error("💳 Set your USDT BEP-20 wallet first.");
  if (!Number.isFinite(amount) || amount < min)
    throw new Error(`⚠️ Minimum withdrawal is ${min} ${APP.tokenName}.`);
  if (amount > user.balance) throw new Error("⚠️ Insufficient balance.");
  const pending = await queryDocs("withdrawals", {
    where: [
      { field: "userId", op: "EQUAL", value: user.id },
      { field: "status", op: "EQUAL", value: "pending" },
    ],
    limit: 5,
  });
  if (pending.length) throw new Error("⏳ You already have a pending withdrawal.");

  const q = withdrawQuote(amount, cfg);
  const number = (user.withdrawCount ?? 0) + 1;
  const id = `${user.id}_${Date.now()}`;
  await credit(user, -amount, "withdraw_hold", `Withdrawal #${number} requested`);
  await setDoc(`users/${user.id}`, { withdrawCount: number });
  user.withdrawCount = number;
  await setDoc(`withdrawals/${id}`, {
    userId: user.id,
    name: label(user),
    number,
    tokens: amount,
    grossUsd: q.gross,
    feeUsd: q.fee,
    netUsd: q.net,
    wallet: user.wallet,
    status: "pending",
    txId: "",
    at: Date.now(),
  });
  await notifyAdmin(
    `💸 <b>New withdrawal request</b>\n\n👤 ${label(user)} (<code>${user.id}</code>)\n🔢 Withdrawal #${number}\n🪙 Amount: <b>${amount} ${APP.tokenName}</b>\n🧾 Fee: $${q.fee.toFixed(4)}\n💵 Net: <b>$${q.net.toFixed(4)}</b>\n💳 <code>${user.wallet}</code>\n🕒 Status: pending`,
    [[btn.miniApp]]
  );
  return { id, ...q, balance: user.balance };
}

export async function listTransactions(user: UserDoc) {
  const tx = await queryDocs<{ type: string; amount: number; note: string; at: number }>(
    "transactions",
    { where: [{ field: "userId", op: "EQUAL", value: user.id }], limit: 300 }
  );
  return tx.sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 100);
}

export type WithdrawRow = {
  id: string;
  userId: string;
  name: string;
  number: number;
  tokens: number;
  grossUsd: number;
  feeUsd: number;
  netUsd: number;
  wallet: string;
  status: string;
  txId: string;
  at: number;
};

export async function listWithdrawals(userId: string): Promise<WithdrawRow[]> {
  const rows = await queryDocs<WithdrawRow>("withdrawals", {
    where: [{ field: "userId", op: "EQUAL", value: userId }],
    limit: 100,
  });
  return rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

export async function leaderboard() {
  const users = await queryDocs<UserDoc>("users", {
    orderBy: { field: "totalEarned", dir: "DESCENDING" },
    limit: 30,
  });
  return users.map((u, i) => ({
    rank: i + 1,
    name: label(u),
    earned: u.totalEarned ?? 0,
    refs: u.refCount ?? 0,
  }));
}

/* --------------------------------- admin -------------------------------- */

export async function adminOverview() {
  const [users, withdrawals, tasks, codes] = await Promise.all([
    queryDocs<UserDoc>("users", { limit: 1000 }),
    queryDocs<WithdrawRow>("withdrawals", { limit: 300 }),
    listTasks(),
    queryDocs<{ reward: number; uses: number; maxUses: number; active: boolean }>("codes", {
      limit: 100,
    }),
  ]);
  const today = utcDayKey();
  return {
    stats: {
      users: users.length,
      suspended: users.filter((u) => u.suspended).length,
      newToday: users.filter((u) => utcDayKey(new Date(u.createdAt ?? 0)) === today).length,
      online: users.filter((u) => Date.now() - (u.lastSeen ?? 0) < 5 * 60000).length,
      supply: users.reduce((s, u) => s + (u.balance ?? 0), 0),
      paidUsd: withdrawals
        .filter((w) => w.status === "approved")
        .reduce((s, w) => s + (w.netUsd ?? 0), 0),
      pendingUsd: withdrawals
        .filter((w) => w.status === "pending")
        .reduce((s, w) => s + (w.netUsd ?? 0), 0),
    },
    users: users
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 100)
      .map((u) => ({
        id: u.id,
        name: label(u),
        balance: u.balance ?? 0,
        refs: u.refCount ?? 0,
        suspended: !!u.suspended,
        createdAt: u.createdAt ?? 0,
      })),
    withdrawals: withdrawals.sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 100),
    tasks,
    codes,
  };
}

export async function decideWithdraw(
  id: string,
  approve: boolean,
  txId: string,
  origin: string
) {
  const w = await getDoc<{
    userId: string;
    name: string;
    number: number;
    tokens: number;
    feeUsd: number;
    netUsd: number;
    status: string;
  }>(`withdrawals/${id}`);
  if (!w) throw new Error("Withdrawal not found");
  if (w.status !== "pending") throw new Error("Already processed");
  const user = await getDoc<UserDoc>(`users/${w.userId}`);

  if (!approve) {
    await setDoc(`withdrawals/${id}`, { status: "rejected", decidedAt: Date.now() });
    if (user) await credit(user, w.tokens, "withdraw_refund", `Withdrawal #${w.number} rejected`);
    await sendMessage(
      w.userId,
      `❌ <b>Withdrawal rejected</b>\n\n🔢 Withdrawal #${w.number}\n🪙 ${w.tokens} ${APP.tokenName} refunded to your balance.\n💬 Contact support if you need help.`,
      [[btn.miniApp]]
    );
    return { ok: true };
  }

  await setDoc(`withdrawals/${id}`, {
    status: "approved",
    txId,
    decidedAt: Date.now(),
  });
  if (user) {
    await setDoc(`users/${w.userId}`, { totalPaidUsd: (user.totalPaidUsd ?? 0) + w.netUsd });
  }
  const txUrl = txId ? `https://bscscan.com/tx/${txId}` : APP.paymentChannel;
  const userMsg =
    `✅ <b>Withdrawal successful!</b>\n\n` +
    `🔢 Number of withdrawal: <b>#${w.number}</b>\n` +
    `🪙 Amount: <b>${w.tokens} ${APP.tokenName}</b>\n` +
    `🧾 Withdrawal fee: <b>$${w.feeUsd.toFixed(4)}</b>\n` +
    `💵 Net balance: <b>$${w.netUsd.toFixed(4)}</b>\n` +
    `🚦 Status: <b>success</b>`;
  await sendMessage(w.userId, userMsg, [
    [{ text: "🔎 View Transaction", url: txUrl }],
    [btn.payment],
    [btn.miniApp],
  ]);
  await notifyAdmin(
    `✅ <b>Withdrawal approved</b>\n\n👤 ${w.name}\n🔢 #${w.number}\n🪙 ${w.tokens} ${APP.tokenName}\n💵 Net $${w.netUsd.toFixed(4)}`,
    [[{ text: "🔎 View Transaction", url: txUrl }]]
  );
  const post =
    `🎉 <b>New withdrawal approved</b>\n\n` +
    `👤 User: <b>${w.name}</b>\n` +
    `🔢 Number: <b>#${w.number}</b>\n` +
    `🪙 Amount: <b>${w.tokens} ${APP.tokenName}</b>\n` +
    `🧾 Withdraw fee: <b>$${w.feeUsd.toFixed(4)}</b>\n` +
    `💵 Net: <b>$${w.netUsd.toFixed(4)}</b>\n` +
    `🚦 Status: <b>success</b>`;
  await sendMessage(APP.paymentChatId, post, [
    [{ text: "🔎 View Transaction", url: txUrl }],
    [btn.miniApp],
  ]);
  void origin;
  return { ok: true };
}

export async function adminSetUser(
  userId: string,
  patch: { balance?: number; suspended?: boolean; suspendReason?: string }
) {
  const user = await getDoc<UserDoc>(`users/${userId}`);
  if (!user) throw new Error("User not found");
  const update: Record<string, unknown> = {};
  if (typeof patch.suspended === "boolean") {
    update["suspended"] = patch.suspended;
    update["suspendReason"] = patch.suspended ? (patch.suspendReason ?? "Suspended by admin") : "";
  }
  if (typeof patch.balance === "number") {
    const delta = Math.floor(patch.balance) - (user.balance ?? 0);
    await credit(user, delta, "admin_adjust", "Admin balance adjustment");
  }
  if (Object.keys(update).length) await setDoc(`users/${userId}`, update);
  return { ok: true };
}

export async function adminSaveTask(task: Partial<TaskDoc> & { id?: string }) {
  const id = task.id || `t${Date.now()}`;
  await setDoc(`tasks/${id}`, {
    group: task.group ?? "main",
    kind: task.kind ?? "channel",
    title: task.title ?? "New task",
    description: task.description ?? "",
    url: task.url ?? "",
    chatId: task.chatId ?? "",
    reward: Math.max(0, Math.floor(task.reward ?? 100)),
    active: task.active !== false,
    createdAt: task.createdAt ?? Date.now(),
  });
  return { id };
}

export async function adminDeleteTask(id: string) {
  await deleteDoc(`tasks/${id}`);
  return { ok: true };
}

export async function adminSaveCode(code: string, reward: number, maxUses: number, active: boolean) {
  const c = code.trim().toUpperCase();
  if (!c) throw new Error("Code required");
  const existing = await getDoc<{ uses: number }>(`codes/${c}`);
  await setDoc(`codes/${c}`, {
    reward: Math.max(1, Math.floor(reward)),
    maxUses: Math.max(0, Math.floor(maxUses)),
    uses: existing?.uses ?? 0,
    active,
  });
  return { ok: true };
}

export async function adminDeleteCode(code: string) {
  await deleteDoc(`codes/${code.toUpperCase()}`);
  return { ok: true };
}

export async function adminBroadcast(text: string) {
  const users = await queryDocs<UserDoc>("users", { limit: 1000 });
  let sent = 0;
  for (const u of users) {
    if (u.notifications === false) continue;
    const r = await sendMessage(u.id, `📢 ${text}`, [[btn.miniApp]]);
    if (r) sent++;
  }
  return { sent };
}