import { getRequestHeader } from "@tanstack/react-start/server";
import { verifyInitData, type AuthUser } from "./bot.server";
import {
  getCfg,
  ensureUser,
  loadUser,
  isAdmin,
  auditBalance,
  suspend,
  type Cfg,
  type UserDoc,
} from "./core.server";
import { deleteDoc, getDoc, setDoc, withLock } from "./fsdb.server";

export function clientIp() {
  return (
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-real-ip") ??
    (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() ??
    ""
  );
}

export function origin() {
  const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "";
  return host ? `https://${host}` : "";
}

function maintenanceError(cfg: Cfg) {
  return new Error(
    `🛠 ${cfg.maintenanceText?.trim() || "Tigorix is under maintenance right now. Please come back in a little while — your balance is safe."}`
  );
}

export async function session(initData: string): Promise<{
  auth: AuthUser;
  user: UserDoc;
  cfg: Cfg;
}> {
  const auth = await verifyInitData(String(initData ?? "").slice(0, 4096));
  const cfg = await getCfg();
  if (cfg.maintenance && !isAdmin(auth.id)) throw maintenanceError(cfg);
  let user = await loadUser(auth);
  if (!user) {
    const created = await ensureUser(auth, {
      ip: clientIp(),
      device: "",
      ref: auth.startParam,
      origin: origin(),
    });
    user = created.user;
  }
  return { auth, user, cfg };
}

/**
 * Session for any action that changes balances/claims. Runs under a per-user
 * lock (no parallel double-claims), reloads fresh data, and verifies the
 * balance against the full ledger first — a mismatched account is
 * auto-suspended and the admin is notified.
 */
export async function act<T>(
  initData: string,
  fn: (s: { auth: AuthUser; user: UserDoc; cfg: Cfg }) => Promise<T>
): Promise<T> {
  const s = await session(initData);
  return withLock(`u_${s.auth.id}`, async () => {
    const user = (await loadUser(s.auth)) ?? s.user;
    if (user.suspended)
      throw new Error(`🚫 Your account is suspended. ${user.suspendReason || "Contact support."}`);
    if (!isAdmin(user.id) && !(await auditBalance(user))) {
      await suspend(user, "Balance does not match recorded activity (ledger audit).");
      throw new Error("🚫 Your account is suspended. Balance does not match recorded activity.");
    }
    return fn({ ...s, user });
  });
}

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function adminSession(initData: string, password: string) {
  const { auth, user, cfg } = await session(initData);
  if (!isAdmin(auth.id)) throw new Error("Not authorized");
  const failPath = `adminFails/${auth.id}`;
  const fails = await getDoc<{ count: number; at: number }>(failPath);
  if (fails && fails.count >= MAX_FAILS && Date.now() - fails.at < LOCK_MS)
    throw new Error("🔒 Too many wrong passwords. Admin panel locked for 15 minutes.");
  if (!safeEqual(String(password ?? ""), cfg.adminPassword)) {
    const count = fails && Date.now() - fails.at < LOCK_MS ? fails.count + 1 : 1;
    await setDoc(failPath, { count, at: Date.now() });
    throw new Error("Invalid admin password");
  }
  if (fails) await deleteDoc(failPath);
  return { auth, user, cfg };
}
