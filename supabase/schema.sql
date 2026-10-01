-- Tigorix database. Paste this whole file into Supabase → SQL Editor → Run.
-- Only the server (secret key) can touch the data; browsers have zero access.

create table if not exists public.docs (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists docs_data_gin on public.docs using gin (data jsonb_path_ops);

revoke all on public.docs from anon, authenticated, public;
grant all on public.docs to service_role;
alter table public.docs enable row level security;
-- No policies on purpose: anon/authenticated users can never read or write.

-- Merge a patch into a document (create if missing).
create or replace function public.doc_merge(c text, i text, p jsonb)
returns void language sql as $$
  insert into public.docs (collection, id, data) values (c, i, p)
  on conflict (collection, id) do update
    set data = public.docs.data || excluded.data, updated_at = now();
$$;

-- Create a document only if it does not exist. Returns true when created.
-- Used as an atomic lock so parallel requests can never claim a reward twice.
create or replace function public.doc_create(c text, i text, p jsonb)
returns boolean language plpgsql as $$
begin
  insert into public.docs (collection, id, data) values (c, i, p);
  return true;
exception when unique_violation then
  return false;
end;
$$;

-- Atomically add delta to a numeric field (never below zero). Returns new value.
create or replace function public.doc_incr(c text, i text, f text, delta numeric)
returns numeric language plpgsql as $$
declare v numeric;
begin
  insert into public.docs (collection, id, data)
    values (c, i, jsonb_build_object(f, greatest(0, delta)))
  on conflict (collection, id) do update
    set data = public.docs.data || jsonb_build_object(
      f, greatest(0, coalesce((public.docs.data->>f)::numeric, 0) + delta)),
      updated_at = now()
  returning (data->>f)::numeric into v;
  return v;
end;
$$;

revoke all on function public.doc_merge(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.doc_create(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.doc_incr(text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.doc_merge(text, text, jsonb) to service_role;
grant execute on function public.doc_create(text, text, jsonb) to service_role;
grant execute on function public.doc_incr(text, text, text, numeric) to service_role;

notify pgrst, 'reload schema';
