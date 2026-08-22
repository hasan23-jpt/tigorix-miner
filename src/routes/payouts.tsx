import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { APP, fmt } from "@/lib/config";
import { getPayoutProofs } from "@/lib/api.functions";

export const Route = createFileRoute("/payouts")({
  head: () => ({
    meta: [
      { title: "Tigorix Payout Proofs — Verified TGX Reward Payments" },
      {
        name: "description",
        content:
          "Public proof of payouts: every approved Tigorix reward withdrawal with amount, fee, net USDT and on-chain transaction ID.",
      },
      { property: "og:title", content: "Tigorix Payout Proofs — Publicly Verified Rewards" },
      {
        property: "og:description",
        content:
          "Browse every approved Tigorix payout with its BEP-20 transaction ID and verify rewards on-chain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PayoutsPage,
});

function PayoutsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["payout-proofs"],
    queryFn: () => getPayoutProofs(),
    refetchInterval: 30000,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6 text-center">
        <img src="/tigorix-logo.png" alt="Tigorix logo" className="mx-auto size-20 rounded-full" />
        <h1 className="mt-3 text-2xl font-black">
          <span className="text-gold-gradient">Proof of Payouts</span>
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Every approved Tigorix reward payout is published here and in our public payment channel,
          with the BEP-20 transaction ID so anyone can verify it on-chain.{" "}
          {fmt(APP.tokensPerUsd)} {APP.tokenName} = $1 USDT.
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <a
            href={APP.paymentChannel}
            className="rounded-xl border border-primary/40 px-3 py-2 text-xs font-bold text-primary"
          >
            💳 Payment channel
          </a>
          <a
            href={APP.communityChannel}
            className="rounded-xl border border-border px-3 py-2 text-xs font-bold"
          >
            📣 Community
          </a>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="surface-card p-4 text-center">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total paid out</p>
          <p className="text-xl font-black text-success">
            ${(data?.totalPaidUsd ?? 0).toFixed(4)}
          </p>
        </div>
        <div className="surface-card p-4 text-center">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Payouts</p>
          <p className="text-xl font-black">{fmt(data?.totalPayouts ?? 0)}</p>
        </div>
      </div>

      {isLoading && <p className="text-center text-xs text-muted-foreground">Loading payouts…</p>}
      {error && (
        <p className="text-center text-xs text-destructive">
          Could not load payouts right now. Please refresh.
        </p>
      )}

      <div className="space-y-2">
        {(data?.payouts ?? []).map((p) => (
          <article
            key={p.id}
            className="surface-card flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
          >
            <div className="min-w-0">
              <p className="font-bold">
                #{p.number} · {p.user} · {fmt(p.tokens)} {APP.tokenName}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(p.at).toISOString().slice(0, 16).replace("T", " ")} UTC · wallet{" "}
                {p.wallet} · fee ${p.feeUsd.toFixed(4)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-black text-success">${p.netUsd.toFixed(4)}</p>
              {p.txUrl ? (
                <a href={p.txUrl} className="text-[10px] font-bold text-primary underline">
                  🔗 View transaction
                </a>
              ) : (
                <span className="text-[10px] text-muted-foreground">tx pending</span>
              )}
            </div>
          </article>
        ))}
        {data && !data.payouts.length && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No payouts approved yet — new confirmations appear here automatically.
          </p>
        )}
      </div>
    </main>
  );
}
