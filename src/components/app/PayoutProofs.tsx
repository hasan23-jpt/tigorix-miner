import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { APP, fmt } from "@/lib/config";
import { openLink } from "@/lib/telegram";
import { getPayoutProofs } from "@/lib/api.functions";
import { Card, GhostButton, GoldButton, Pill, SectionTitle, Stat } from "./ui";

/** Public proof-of-payout feed (shown at the bottom of Home). */
export function PayoutProofsCard() {
  const { data: proofs } = useQuery({
    queryKey: ["payout-proofs"],
    queryFn: () => getPayoutProofs(),
    refetchInterval: 60000,
  });
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <Card>
      <SectionTitle
        icon="🧾"
        title="Proof of Payouts"
        action={<Pill tone="success">Public</Pill>}
      />
      <p className="mb-3 text-[11px] text-muted-foreground">
        Every approved withdrawal is published here and in our public payment channel with amount,
        fee and on-chain transaction ID, so rewards can be verified by anyone.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Stat
          emoji="✅"
          label="Total paid out"
          value={`$${(proofs?.totalPaidUsd ?? 0).toFixed(4)}`}
        />
        <Stat emoji="🧾" label="Payouts" value={fmt(proofs?.totalPayouts ?? 0)} />
      </div>
      <div className="mb-3 space-y-2">
        {(proofs?.payouts ?? []).slice(0, 5).map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px]"
          >
            <div className="min-w-0">
              <p className="font-bold">
                #{p.number} · {p.user} · {fmt(p.tokens)} {APP.tokenName}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(p.at).toISOString().slice(0, 16).replace("T", " ")} UTC ·{" "}
                {p.txId ? `tx ${p.txId.slice(0, 10)}…` : "tx pending"}
              </p>
            </div>
            <span className="font-black text-success">${p.netUsd.toFixed(4)}</span>
          </div>
        ))}
        {proofs && !proofs.payouts.length && (
          <p className="py-3 text-center text-[11px] text-muted-foreground">
            No payouts approved yet — confirmations appear here automatically.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <GoldButton onClick={() => openLink(APP.paymentChannel)}>
          💳 View Payout Proofs Channel
        </GoldButton>
        <GhostButton onClick={() => openLink(`${origin}/payouts`)}>
          🌐 Public Payout Page
        </GhostButton>
        <GhostButton onClick={() => openLink(APP.communityChannel)}>
          📣 Community Channel
        </GhostButton>
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-success" /> 100,000 {APP.tokenName} = $1 USDT (BEP-20)
      </p>
    </Card>
  );
}
