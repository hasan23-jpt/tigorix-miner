<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Data lives in the user's own Supabase project as one `docs(collection,id,data jsonb)` table accessed only by the server via `TIGORIX_DB_SECRET_KEY` (src/lib/fsdb.server.ts) — keeps the old collection/id API and gives browsers zero DB access.
- All balance changes go through the `ledger_credit` SQL function (balance + transaction in one atomic step) — makes the ledger audit exact and blocks negative balances.
- Every reward/withdraw server function runs through `act()` (per-user lock + fresh reload + ledger audit) and one-time claims use `createDoc` atomic inserts — prevents parallel double-claims.
- Schema changes are shipped as `supabase/schema.sql` for the user to paste into their SQL editor — the project is not linked to Lovable's Supabase connector.
