/**
 * Minimal Firestore REST client (Worker-safe, no Node-only deps).
 * All app writes go through the server so clients never touch the database.
 */
const PROJECT = "tigorixbot";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

type Any = Record<string, unknown>;

function key() {
  const k = process.env["GOOGLE_API_KEY"];
  if (!k) throw new Error("GOOGLE_API_KEY is not configured");
  return k.trim();
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
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}key=${key()}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return res;
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