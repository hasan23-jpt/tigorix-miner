/**
 * Minimal Firestore REST client (Worker-safe, no Node-only deps).
 * All app writes go through the server so clients never touch the database.
 */
const PROJECT = "tigorixbot";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

type Any = Record<string, unknown>;

/**
 * Server access uses a Google service account (OAuth2 JWT bearer) so the
 * deny-all Firestore rules do not apply. An API key alone is subject to the
 * rules and returns PERMISSION_DENIED.
 */
type ServiceAccount = { client_email: string; private_key: string; project_id?: string };

function serviceAccount(): ServiceAccount | null {
  const raw =
    process.env["FIREBASE_SERVICE_ACCOUNT"] ??
    process.env["GOOGLE_SERVICE_ACCOUNT"] ??
    process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (!raw) return null;
  const txt = raw.trim();
  const json = txt.startsWith("{") ? txt : new TextDecoder().decode(b64ToBytes(txt));
  const sa = JSON.parse(json) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) throw new Error("Service account JSON is incomplete");
  return { ...sa, private_key: sa.private_key.replace(/\\n/g, "\n") };
}

function b64ToBytes(b64: string) {
  const clean = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(pem: string) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  return crypto.subtle.importKey(
    "pkcs8",
    b64ToBytes(body),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

let cachedToken: { token: string; exp: number } | null = null;

async function accessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const signing = `${header}.${claims}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await importKey(sa.private_key),
    new TextEncoder().encode(signing)
  );
  const jwt = `${signing}.${b64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google auth failed [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.token;
}

function enc(value: unknown): Any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number")
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(enc) } };
  const fields: Any = {};
  for (const [k2, v] of Object.entries(value as Any)) fields[k2] = enc(v);
  return { mapValue: { fields } };
}

function dec(value: Any): unknown {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value["booleanValue"];
  if ("integerValue" in value) return Number(value["integerValue"]);
  if ("doubleValue" in value) return Number(value["doubleValue"]);
  if ("stringValue" in value) return value["stringValue"];
  if ("timestampValue" in value) return value["timestampValue"];
  if ("arrayValue" in value)
    return (((value["arrayValue"] as Any)["values"] as Any[]) ?? []).map(dec);
  if ("mapValue" in value) return decFields(((value["mapValue"] as Any)["fields"] as Any) ?? {});
  return null;
}

function decFields(fields: Any): Any {
  const out: Any = {};
  for (const [k2, v] of Object.entries(fields)) out[k2] = dec(v as Any);
  return out;
}

function encFields(data: Any): Any {
  const fields: Any = {};
  for (const [k2, v] of Object.entries(data)) fields[k2] = enc(v);
  return fields;
}

async function call(path: string, init?: RequestInit) {
  const sa = serviceAccount();
  if (!sa) {
    // No service account: fall back to API-key access (Firestore rules apply).
    const k = process.env["GOOGLE_API_KEY"];
    if (!k) throw new Error("GOOGLE_API_KEY is not configured");
    const sep = path.includes("?") ? "&" : "?";
    return fetch(`${BASE}${path}${sep}key=${k.trim()}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  }
  const token = await accessToken(sa);
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

export async function getDoc<T = Any>(path: string): Promise<T | null> {
  const res = await call(`/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore read failed [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as Any;
  return decFields((json["fields"] as Any) ?? {}) as T;
}

/** Create-or-replace the listed fields (merge patch). */
export async function setDoc(path: string, data: Any) {
  const mask = Object.keys(data)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  const res = await call(`/${path}?${mask}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: encFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore write failed [${res.status}]: ${await res.text()}`);
}

export async function deleteDoc(path: string) {
  const res = await call(`/${path}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404)
    throw new Error(`Firestore delete failed [${res.status}]: ${await res.text()}`);
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
  const filters = (opts.where ?? []).map((w) => ({
    fieldFilter: { field: { fieldPath: w.field }, op: w.op, value: enc(w.value) },
  }));
  const structuredQuery: Any = { from: [{ collectionId: collection }] };
  if (filters.length === 1) structuredQuery["where"] = filters[0];
  if (filters.length > 1)
    structuredQuery["where"] = { compositeFilter: { op: "AND", filters } };
  if (opts.orderBy)
    structuredQuery["orderBy"] = [
      { field: { fieldPath: opts.orderBy.field }, direction: opts.orderBy.dir ?? "DESCENDING" },
    ];
  if (opts.limit) structuredQuery["limit"] = opts.limit;

  const res = await call(`:runQuery`, {
    method: "POST",
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`Firestore query failed [${res.status}]: ${await res.text()}`);
  const rows = (await res.json()) as Any[];
  return rows
    .filter((r) => r["document"])
    .map((r) => {
      const doc = r["document"] as Any;
      const name = String(doc["name"]);
      return {
        id: name.slice(name.lastIndexOf("/") + 1),
        ...(decFields((doc["fields"] as Any) ?? {}) as T),
      } as T & { id: string };
    });
}

export async function countDocs(collection: string, opts: QueryOpts = {}) {
  const rows = await queryDocs(collection, { ...opts, limit: opts.limit ?? 1000 });
  return rows.length;
}