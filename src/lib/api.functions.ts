import { createServerFn } from "@tanstack/react-start";
import { session, adminSession, clientIp, origin } from "./session.server";
import {
  ensureUser,
  miningState,
  startMining,
  claimMining,
  dailyState,
  claimDaily,
  listTasks,
  taskStatus,
  claimTask,
  claimDailyTask,
  recordAdView,
  referralOverview,
  claimReferralEarnings,
  redeemCode,
  setWallet,
  requestWithdraw,
  withdrawQuote,
  listTransactions,
  listWithdrawals,
  leaderboard,
  adminOverview,
  decideWithdraw,
  adminSetUser,
  adminSaveTask,
  adminDeleteTask,
  adminSaveCode,
  adminDeleteCode,
  adminBroadcast,
  saveCfg,
  isAdmin,
  getCfg,
} from "./core.server";
import { verifyInitData } from "./bot.server";

type Auth = { initData: string };

export const bootstrap = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { device: string; ref: string }) => d)
  .handler(async ({ data }) => {
    const auth = await verifyInitData(data.initData);
    const cfg = await getCfg();
    const { user, isNew } = await ensureUser(auth, {
      ip: clientIp(),
      device: String(data.device ?? "").slice(0, 40),
      ref: String(data.ref ?? "").slice(0, 32),
      origin: origin(),
    });
    return {
      isNew,
      admin: isAdmin(auth.id),
      cfg: {
        miningReward: cfg.miningReward,
        miningHours: cfg.miningHours,
        dailyTaskReward: cfg.dailyTaskReward,
        dailyReferReward: cfg.dailyReferReward,
        refJoin: cfg.refJoin,
        refDay1: cfg.refDay1,
        refDay2: cfg.refDay2,
        day1Ads: cfg.day1Ads,
        day2Ads: cfg.day2Ads,
        minWithdrawFirst: cfg.minWithdrawFirst,
        minWithdrawNext: cfg.minWithdrawNext,
        feeFlatUsd: cfg.feeFlatUsd,
        feePercent: cfg.feePercent,
        tokensPerUsd: cfg.tokensPerUsd,
        maintenance: cfg.maintenance,
      },
      user: publicUser(user),
      mining: miningState(user, cfg),
      daily: dailyState(user),
    };
  });

function publicUser(u: {
  id: string;
  username: string;
  firstName: string;
  photoUrl: string;
  balance: number;
  totalEarned: number;
  suspended: boolean;
  suspendReason: string;
  refCount: number;
  refActive: number;
  refEarnPending: number;
  refEarnClaimed: number;
  adsToday: number;
  adsTotal: number;
  wallet: string;
  withdrawCount: number;
  totalPaidUsd: number;
  createdAt: number;
  notifications: boolean;
  language: string;
}) {
  return {
    id: u.id,
    username: u.username ?? "",
    firstName: u.firstName ?? "",
    photoUrl: u.photoUrl ?? "",
    balance: u.balance ?? 0,
    totalEarned: u.totalEarned ?? 0,
    suspended: !!u.suspended,
    suspendReason: u.suspendReason ?? "",
    refCount: u.refCount ?? 0,
    refActive: u.refActive ?? 0,
    refEarnPending: u.refEarnPending ?? 0,
    refEarnClaimed: u.refEarnClaimed ?? 0,
    adsToday: u.adsToday ?? 0,
    adsTotal: u.adsTotal ?? 0,
    wallet: u.wallet ?? "",
    withdrawCount: u.withdrawCount ?? 0,
    totalPaidUsd: u.totalPaidUsd ?? 0,
    createdAt: u.createdAt ?? 0,
    notifications: u.notifications !== false,
    language: u.language ?? "en",
  };
}

export const getState = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user, cfg, auth } = await session(data.initData);
    return {
      admin: isAdmin(auth.id),
      user: publicUser(user),
      mining: miningState(user, cfg),
      daily: dailyState(user),
    };
  });

export const doStartMining = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user, cfg } = await session(data.initData);
    return startMining(user, cfg);
  });

export const doClaimMining = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user, cfg } = await session(data.initData);
    return claimMining(user, cfg);
  });

export const doClaimDaily = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user } = await session(data.initData);
    return claimDaily(user);
  });

export const doRedeemCode = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { code: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await session(data.initData);
    return redeemCode(user, data.code);
  });

export const getTasks = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user, cfg } = await session(data.initData);
    const [tasks, status] = await Promise.all([listTasks(), taskStatus(user)]);
    return {
      tasks,
      ...status,
      dailyTaskReward: cfg.dailyTaskReward,
      dailyReferReward: cfg.dailyReferReward,
    };
  });

export const doClaimTask = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { taskId: string; openedAt: number }) => d)
  .handler(async ({ data }) => {
    const { user } = await session(data.initData);
    return claimTask(user, data.taskId, Number(data.openedAt ?? 0));
  });

export const doClaimDailyTask = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { key: string }) => d)
  .handler(async ({ data }) => {
    const { user, cfg } = await session(data.initData);
    return claimDailyTask(user, cfg, data.key);
  });

export const doRecordAd = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user, cfg } = await session(data.initData);
    return recordAdView(user, cfg);
  });

export const getReferrals = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user, cfg } = await session(data.initData);
    const overview = await referralOverview(user);
    return {
      ...overview,
      rewards: { join: cfg.refJoin, day1: cfg.refDay1, day2: cfg.refDay2 },
      ads: { day1: cfg.day1Ads, day2: cfg.day2Ads },
    };
  });

export const doClaimReferral = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user } = await session(data.initData);
    return claimReferralEarnings(user);
  });

export const doSetWallet = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { address: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await session(data.initData);
    return setWallet(user, data.address);
  });

export const doWithdraw = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { tokens: number }) => d)
  .handler(async ({ data }) => {
    const { user, cfg } = await session(data.initData);
    return requestWithdraw(user, cfg, Number(data.tokens));
  });

export const getFinance = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user, cfg } = await session(data.initData);
    const [tx, wd] = await Promise.all([listTransactions(user), listWithdrawals(user.id)]);
    const quote = withdrawQuote(user.balance, cfg);
    return { transactions: tx, withdrawals: wd, quote, wallet: user.wallet ?? "" };
  });

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    await session(data.initData);
    return leaderboard();
  });

/* --------------------------------- admin -------------------------------- */

type AdminAuth = Auth & { password: string };

export const adminLoad = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth) => d)
  .handler(async ({ data }) => {
    const { cfg } = await adminSession(data.initData, data.password);
    const overview = await adminOverview();
    return { ...overview, cfg };
  });

export const adminWithdrawDecision = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth & { id: string; approve: boolean; txId: string }) => d)
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return decideWithdraw(data.id, data.approve, String(data.txId ?? ""), origin());
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .inputValidator(
    (d: AdminAuth & { userId: string; balance?: number; suspended?: boolean; reason?: string }) => d
  )
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminSetUser(data.userId, {
      ...(typeof data.balance === "number" ? { balance: data.balance } : {}),
      ...(typeof data.suspended === "boolean" ? { suspended: data.suspended } : {}),
      ...(data.reason ? { suspendReason: data.reason } : {}),
    });
  });

export const adminSaveConfig = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth & { patch: Record<string, number | boolean | string> }) => d)
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return saveCfg(data.patch);
  });

export const adminTaskSave = createServerFn({ method: "POST" })
  .inputValidator(
    (
      d: AdminAuth & {
        task: {
          id?: string;
          group?: "main" | "partner";
          kind?: "channel" | "app";
          title?: string;
          description?: string;
          url?: string;
          chatId?: string;
          reward?: number;
          active?: boolean;
        };
      }
    ) => d
  )
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminSaveTask(data.task);
  });

export const adminTaskDelete = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth & { id: string }) => d)
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminDeleteTask(data.id);
  });

export const adminCodeSave = createServerFn({ method: "POST" })
  .inputValidator(
    (d: AdminAuth & { code: string; reward: number; maxUses: number; active: boolean }) => d
  )
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminSaveCode(data.code, data.reward, data.maxUses, data.active);
  });

export const adminCodeDelete = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth & { code: string }) => d)
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminDeleteCode(data.code);
  });

export const adminSendBroadcast = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth & { text: string }) => d)
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminBroadcast(String(data.text ?? "").slice(0, 3000));
  });