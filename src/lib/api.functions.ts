import { createServerFn } from "@tanstack/react-start";
import { session, act, adminSession, clientIp, origin } from "./session.server";
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
  verifyTask,
  requiredChannelsStatus,
  recordWithdrawAd,
  withdrawAdsWatched,
  openTask,
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
  adminSearchUsers,
  adminUserDetail,
  adminFixBalance,
  saveCfg,
  isAdmin,
  getCfg,
  payoutProofs,
  withdrawEligibility,
  listSites,
  siteStatus,
  claimSite,
  adminSaveSite,
  adminDeleteSite,
  setPrefs,
} from "./core.server";
import type { AdNetwork } from "./core.server";
import { ensureTelegramWebhook, forceTelegramWebhook, verifyInitData } from "./bot.server";

type Auth = { initData: string };

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Only these config keys may be changed from the admin panel, with fixed types. */
const CFG_TYPES: Record<string, "number" | "boolean" | "string"> = {
  miningReward: "number", miningHours: "number", dailyTaskReward: "number",
  dailyReferReward: "number", refJoin: "number", refDay1: "number", refDay2: "number",
  day1Ads: "number", day2Ads: "number", adReward: "number", adsDailyCap: "number",
  adsgramIntBlockId: "string", adsgramRewardBlockId: "string", intAdReward: "number",
  intAdsDailyCap: "number", rewardAdReward: "number", rewardAdsDailyCap: "number",
  gigaBlockId: "string", gigaAdReward: "number", gigaAdsDailyCap: "number",
  monetagBlockId: "string", monetagAdReward: "number", monetagAdsDailyCap: "number",
  bitvexBlockId: "string", bitvexAdReward: "number", bitvexAdsDailyCap: "number",
  autoIntAd: "boolean", bannerUrl: "string", withdrawAdsRequired: "number",
  withdrawMinRefs: "number", withdrawCooldownHours: "number", withdrawAdsToWatch: "number",
  minWithdrawFirst: "number", minWithdrawNext: "number", feeFlatUsd: "number",
  feePercent: "number", adminPassword: "string", maintenance: "boolean",
  withdrawEnabled: "boolean", minAdGapSec: "number", maintenanceText: "string",
};

function cleanCfgPatch(patch: Record<string, unknown>) {
  const out: Record<string, number | boolean | string> = {};
  for (const [k, v] of Object.entries(patch ?? {})) {
    const t = CFG_TYPES[k];
    if (!t) continue;
    if (t === "number") {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 1e9) out[k] = n;
    } else if (t === "boolean") out[k] = v === true || v === "true";
    else out[k] = String(v ?? "").slice(0, 500);
  }
  if (typeof out["adminPassword"] === "string" && String(out["adminPassword"]).length < 8)
    delete out["adminPassword"];
  return out;
}

export const bootstrap = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { device: string; ref: string }) => d)
  .handler(async ({ data }) => {
    const auth = await verifyInitData(data.initData);
    const cfg = await getCfg();
    const appOrigin = origin();
    await ensureTelegramWebhook(appOrigin).catch((error) =>
      console.error("Telegram webhook registration failed", error)
    );
    const { user, isNew } = await ensureUser(auth, {
      ip: clientIp(),
      device: String(data.device ?? "").slice(0, 40),
      ref: String(data.ref ?? "").slice(0, 32),
      origin: appOrigin,
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
        adReward: cfg.adReward,
        adsDailyCap: cfg.adsDailyCap,
        adsgramIntBlockId: cfg.adsgramIntBlockId,
        adsgramRewardBlockId: cfg.adsgramRewardBlockId,
        intAdReward: cfg.intAdReward,
        intAdsDailyCap: cfg.intAdsDailyCap,
        rewardAdReward: cfg.rewardAdReward,
        rewardAdsDailyCap: cfg.rewardAdsDailyCap,
        gigaBlockId: cfg.gigaBlockId,
        gigaAdReward: cfg.gigaAdReward,
        gigaAdsDailyCap: cfg.gigaAdsDailyCap,
        monetagBlockId: cfg.monetagBlockId,
        monetagAdReward: cfg.monetagAdReward,
        monetagAdsDailyCap: cfg.monetagAdsDailyCap,
        bitvexBlockId: cfg.bitvexBlockId,
        bitvexAdReward: cfg.bitvexAdReward,
        bitvexAdsDailyCap: cfg.bitvexAdsDailyCap,
        autoIntAd: cfg.autoIntAd !== false,
        withdrawAdsRequired: cfg.withdrawAdsRequired,
        withdrawMinRefs: cfg.withdrawMinRefs,
        withdrawCooldownHours: cfg.withdrawCooldownHours,
        withdrawAdsToWatch: cfg.withdrawAdsToWatch,
        minWithdrawFirst: cfg.minWithdrawFirst,
        minWithdrawNext: cfg.minWithdrawNext,
        feeFlatUsd: cfg.feeFlatUsd,
        feePercent: cfg.feePercent,
        tokensPerUsd: cfg.tokensPerUsd,
        maintenance: cfg.maintenance,
        withdrawEnabled: cfg.withdrawEnabled !== false,
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
  adsDayKey: string;
  intAdsToday: number;
  intAdsDayKey: string;
  rewardAdsToday: number;
  rewardAdsDayKey: string;
  gigaAdsToday: number;
  gigaAdsDayKey: string;
  monetagAdsToday: number;
  monetagAdsDayKey: string;
  bitvexAdsToday: number;
  bitvexAdsDayKey: string;
  wallet: string;
  withdrawCount: number;
  totalPaidUsd: number;
  createdAt: number;
  notifications: boolean;
  language: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
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
    adsToday: u.adsDayKey === today ? (u.adsToday ?? 0) : 0,
    adsTotal: u.adsTotal ?? 0,
    intAdsToday: u.intAdsDayKey === today ? (u.intAdsToday ?? 0) : 0,
    rewardAdsToday: u.rewardAdsDayKey === today ? (u.rewardAdsToday ?? 0) : 0,
    gigaAdsToday: u.gigaAdsDayKey === today ? (u.gigaAdsToday ?? 0) : 0,
    monetagAdsToday: u.monetagAdsDayKey === today ? (u.monetagAdsToday ?? 0) : 0,
    bitvexAdsToday: u.bitvexAdsDayKey === today ? (u.bitvexAdsToday ?? 0) : 0,
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
  .handler(async ({ data }) => act(data.initData, ({ user, cfg }) => startMining(user, cfg)));

export const doClaimMining = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => act(data.initData, ({ user, cfg }) => claimMining(user, cfg)));

export const doClaimDaily = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => act(data.initData, ({ user }) => claimDaily(user)));

export const doRedeemCode = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { code: string }) => d)
  .handler(async ({ data }) => act(data.initData, ({ user }) => redeemCode(user, str(data.code, 32))));

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
  .handler(async ({ data }) => act(data.initData, ({ user }) => claimTask(user, str(data.taskId, 60), num(data.openedAt))));

export const doOpenTask = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { taskId: string }) => d)
  .handler(async ({ data }) => act(data.initData, ({ user }) => openTask(user, str(data.taskId, 60))));

export const doClaimDailyTask = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { key: string }) => d)
  .handler(async ({ data }) => act(data.initData, ({ user, cfg }) => claimDailyTask(user, cfg, str(data.key, 20))));

export const doRecordAd = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { network: AdNetwork }) => d)
  .handler(async ({ data }) => act(data.initData, ({ user, cfg }) => recordAdView(user, cfg, (["int", "reward", "giga", "monetag", "bitvex"] as AdNetwork[]).includes(data.network) ? data.network : "int")));

export const getReferrals = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user, cfg } = await session(data.initData);
    const overview = await referralOverview(user);
    return {
      ...overview,
      rewards: { join: cfg.refJoin, day1: cfg.refDay1, day2: cfg.refDay2 },
      activity: { day1: cfg.day1Ads, day2: cfg.day2Ads },
    };
  });

export const doClaimReferral = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => act(data.initData, ({ user }) => claimReferralEarnings(user)));

export const doSetWallet = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { address: string }) => d)
  .handler(async ({ data }) => act(data.initData, ({ user }) => setWallet(user, str(data.address, 64))));

export const doWithdraw = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { tokens: number }) => d)
  .handler(async ({ data }) => act(data.initData, ({ user, cfg }) => requestWithdraw(user, cfg, num(data.tokens))));

export const doVerifyTask = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { taskId: string }) => d)
  .handler(async ({ data }) => act(data.initData, ({ user }) => verifyTask(user, str(data.taskId, 60))));

export const getRequiredChannels = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user } = await session(data.initData);
    return requiredChannelsStatus(user.id);
  });

export const doRecordWithdrawAd = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => act(data.initData, ({ user, cfg }) => recordWithdrawAd(user, cfg)));

export const getFinance = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user, cfg } = await session(data.initData);
    const [tx, wd, eligibility] = await Promise.all([
      listTransactions(user),
      listWithdrawals(user.id),
      withdrawEligibility(user, cfg),
    ]);
    const adsWatched = await withdrawAdsWatched(user.id);
    const quote = withdrawQuote(user.balance, cfg);
    return {
      transactions: tx,
      withdrawals: wd,
      quote,
      wallet: user.wallet ?? "",
      eligibility,
      rules: {
        adsRequired: cfg.withdrawAdsRequired,
        minRefs: cfg.withdrawMinRefs,
        cooldownHours: cfg.withdrawCooldownHours,
        adsToWatch: cfg.withdrawAdsToWatch,
      },
      adsWatched,
    };
  });

export const getSites = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => d)
  .handler(async ({ data }) => {
    const { user } = await session(data.initData);
    const [sites, status] = await Promise.all([listSites(), siteStatus(user)]);
    return { sites, status };
  });

export const doClaimSite = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { siteId: string; openedAt: number }) => d)
  .handler(async ({ data }) => act(data.initData, ({ user }) => claimSite(user, str(data.siteId, 60), num(data.openedAt))));

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { kind?: "earn" | "refer" }) => d)
  .handler(async ({ data }) => {
    await session(data.initData);
    return leaderboard(data.kind === "refer" ? "refer" : "earn");
  });

/* --------------------------------- admin -------------------------------- */

type AdminAuth = Auth & { password: string };

export const adminLoad = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth) => d)
  .handler(async ({ data }) => {
    const { cfg } = await adminSession(data.initData, data.password);
    const overview = await adminOverview();
    const { adminPassword: _pw, ...safeCfg } = cfg;
    void _pw;
    return { ...overview, cfg: safeCfg };
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
    const saved = await saveCfg(cleanCfgPatch(data.patch));
    const { adminPassword: _pw, ...safeCfg } = saved;
    void _pw;
    return safeCfg;
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
          imageUrl?: string;
          order?: number;
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
  .inputValidator(
    (
      d: AdminAuth & {
        text: string;
        photo?: string;
        buttons?: { text: string; url: string }[];
        target?: "users" | "community" | "both";
      }
    ) => d
  )
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminBroadcast(String(data.text ?? "").slice(0, 4000), {
      target: data.target === "community" || data.target === "both" ? data.target : "users",
      photo: String(data.photo ?? "").slice(0, 500),
      buttons: (data.buttons ?? []).slice(0, 8).filter((b) => /^https:\/\//.test(String(b.url ?? ""))).map((b) => ({
        text: String(b.text ?? "").slice(0, 40),
        url: String(b.url ?? "").slice(0, 300),
      })),
    });
  });

export const adminFindUsers = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth & { query: string }) => d)
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminSearchUsers(String(data.query ?? "").slice(0, 60));
  });

export const adminUserInfo = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth & { userId: string }) => d)
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminUserDetail(String(data.userId ?? ""));
  });

export const adminRepairBalance = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth & { userId: string }) => d)
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminFixBalance(String(data.userId ?? ""));
  });
/* ---------------------------- public payout proof ---------------------------- */

/** Unauthenticated: powers the public /payouts proof page and the in-app card. */
export const getPayoutProofs = createServerFn({ method: "GET" }).handler(async () => payoutProofs());

export const adminSiteSave = createServerFn({ method: "POST" })
  .inputValidator(
    (
      d: AdminAuth & {
        site: { id?: string; title?: string; url?: string; reward?: number; active?: boolean };
      }
    ) => d
  )
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminSaveSite(data.site);
  });

export const adminSiteDelete = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth & { id: string }) => d)
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return adminDeleteSite(data.id);
  });

export const adminFixWebhook = createServerFn({ method: "POST" })
  .inputValidator((d: AdminAuth) => d)
  .handler(async ({ data }) => {
    await adminSession(data.initData, data.password);
    return forceTelegramWebhook(origin());
  });

export const doSetPrefs = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { language?: string; notifications?: boolean }) => d)
  .handler(async ({ data }) => {
    const { user } = await session(data.initData);
    return setPrefs(user, {
      ...(typeof data.language === "string" ? { language: str(data.language, 4) } : {}),
      ...(typeof data.notifications === "boolean" ? { notifications: data.notifications } : {}),
    });
  });
