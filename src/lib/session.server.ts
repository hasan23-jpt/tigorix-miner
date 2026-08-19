import { getRequestHeader } from "@tanstack/react-start/server";
import { verifyInitData, type AuthUser } from "./bot.server";
import { getCfg, ensureUser, loadUser, isAdmin, type Cfg, type UserDoc } from "./core.server";

export function clientIp() {
  return (
    getRequestHeader("cf-connecting-ip") ??
    (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() ??
    ""
  );
}

export function origin() {
  const host = getRequestHeader("host") ?? "";
  return host ? `https://${host}` : "";
}

export async function session(initData: string): Promise<{
  auth: AuthUser;
  user: UserDoc;
  cfg: Cfg;
}> {
  const auth = await verifyInitData(initData);
  const cfg = await getCfg();
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

export async function adminSession(initData: string, password: string) {
  const { auth, user, cfg } = await session(initData);
  if (!isAdmin(auth.id)) throw new Error("Not authorized");
  if (password !== cfg.adminPassword) throw new Error("Invalid admin password");
  return { auth, user, cfg };
}