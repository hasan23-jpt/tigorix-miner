/**
 * Document store on Supabase (PostgREST over fetch, Worker-safe).
 * Keeps the old "collection/id" API so business logic is unchanged.
 * Only the server holds the secret key; the table has no public access.
 */
type Any = Record<string, unknown>;

const DEFAULT_URL = "https://lmyisyysgpplckmrobmy.supabase.co";

function conf() {
  const url = (process.env["TIGORIX_DB_URL"] ?? DEFAULT_URL).replace(/\/$/, "");
  const key = process.env["TIGORIX_DB_SECRET_KEY"];
  if (!key) throw new Error("TIGORIX_DB_SECRET_KEY is not configured");
  return { url, key: key.trim() };
}

async function rest(path: string, init: RequestInit = {}) {
  const { url, key } = conf();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  if (!key.startsWith("sb_")) headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${url}/rest/v1${path}`, { ...init, headers });
}

function split(path: string) {
  const i = path.indexOf("/");
  if (i < 1) throw new Error(`Bad document path: ${path}`);
  const c = path.slice(0, i);
  const id = path.slice(i + 1);
  if (!/^[A-Za-z0-9_]+$/.test(c) || !id || id.length > 300) throw new Error("Bad document path");
  return { c, id };
}

const q = encodeURIComponent;

async function rpc<T>(fn: string, body: Any): Promise<T> {
  const res = await rest(`/rpc/${fn}`, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Database ${fn} failed [${res.status}]: ${await res.text()}`);
  const txt = await res.text();
  return (txt ? JSON.parse(txt) : null) as T;
}

export async function getDoc<T = Any>(path: string): Promise<T | null> {
  const { c, id } = split(path);
  const res = await rest(`/docs?select=data&collection=eq.${q(c)}&id=eq.${q(id)}&limit=1`);
  if (!res.ok) throw new Error(`Database read failed [${res.status}]: ${await res.text()}`);
  const rows = (await res.json()) as { data: T }[];
  return rows[0]?.data ?? null;
}

/** Create-or-merge the listed fields. */
export async function setDoc(path: string, data: Any) {
  const { c, id } = split(path);
  await rpc("doc_merge", { c, i: id, p: data });
}

/** Atomic create; returns false if the document already exists (used as a lock). */
export async function createDoc(path: string, data: Any): Promise<boolean> {
  const { c, id } = split(path);
  return !!(await rpc<boolean>("doc_create", { c, i: id, p: data }));
}

/** Atomically adds `delta` to a numeric field (floored at 0). */
export async function incrField(path: string, field: string, delta: number): Promise<number> {
  const { c, id } = split(path);
  return Number(await rpc<number>("doc_incr", { c, i: id, f: field, delta }));
}

export async function deleteDoc(path: string) {
  const { c, id } = split(path);
  const res = await rest(`/docs?collection=eq.${q(c)}&id=eq.${q(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404)
    throw new Error(`Database delete failed [${res.status}]: ${await res.text()}`);
}

export type QueryOpts = {
  where?: { field: string; op: string; value: unknown }[];
  orderBy?: { field: string; dir?: "ASCENDING" | "DESCENDING" };
  limit?: number;
};

export async function queryDocs<T = Any>(
  collection: string,
  opts: QueryOpts = {}
): Promise<(T & { id: string })[]> {
  if (!/^[A-Za-z0-9_]+$/.test(collection)) throw new Error("Bad collection");
  const params = [`select=id,data`, `collection=eq.${q(collection)}`];
  const match: Any = {};
  for (const w of opts.where ?? []) {
    if (w.op !== "EQUAL") throw new Error(`Unsupported filter ${w.op}`);
    match[w.field] = w.value;
  }
  if (Object.keys(match).length) params.push(`data=cs.${q(JSON.stringify(match))}`);
  if (opts.orderBy) {
    if (!/^[A-Za-z0-9_]+$/.test(opts.orderBy.field)) throw new Error("Bad order field");
    params.push(
      `order=data->${opts.orderBy.field}.${opts.orderBy.dir === "ASCENDING" ? "asc" : "desc"}.nullslast`
    );
  }
  params.push(`limit=${Math.min(Math.max(1, opts.limit ?? 1000), 5000)}`);
  const res = await rest(`/docs?${params.join("&")}`);
  if (!res.ok) throw new Error(`Database query failed [${res.status}]: ${await res.text()}`);
  const rows = (await res.json()) as { id: string; data: T }[];
  return rows.map((r) => ({ ...(r.data as T), id: r.id }));
}

export async function countDocs(collection: string, opts: QueryOpts = {}) {
  const rows = await queryDocs(collection, { ...opts, limit: opts.limit ?? 5000 });
  return rows.length;
}

/** Atomic balance change + ledger entry. Throws if the balance would go negative. */
export async function ledgerCredit(
  userId: string,
  amount: number,
  type: string,
  note: string
): Promise<number> {
  const tid = `${userId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  try {
    return Number(
      await rpc<number>("ledger_credit", { uid: userId, amt: amount, t: type, note, tid })
    );
  } catch (e) {
    if (String(e).includes("insufficient balance")) throw new Error("⚠️ Insufficient balance.");
    throw e;
  }
}

export async function ledgerSum(userId: string) {
  const rows = await rpc<{ total: number; entries: number }[]>("ledger_sum", { uid: userId });
  const r = rows?.[0];
  return { total: Number(r?.total ?? 0), entries: Number(r?.entries ?? 0) };
}

/**
 * Per-user mutex so parallel requests can never double-claim a reward.
 * Stale locks (crashed requests) expire after 20 seconds.
 */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const path = `locks/${key}`;
  let got = await createDoc(path, { at: Date.now() });
  if (!got) {
    const cur = await getDoc<{ at: number }>(path);
    if (!cur || Date.now() - (cur.at ?? 0) > 20_000) {
      await deleteDoc(path);
      got = await createDoc(path, { at: Date.now() });
    }
  }
  if (!got) throw new Error("⏳ Please wait — your previous action is still processing.");
  try {
    return await fn();
  } finally {
    await deleteDoc(path).catch(() => undefined);
  }
}
