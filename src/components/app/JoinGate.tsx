import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getRequiredChannels } from "@/lib/api.functions";
import { openLink } from "@/lib/telegram";
import { useAppState } from "./useApp";
import { GoldButton } from "./ui";

/** Blocks the app until the user is in every required channel (checked by the bot). */
export function JoinGate() {
  const { auth } = useAppState();
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["required-channels"],
    queryFn: () => getRequiredChannels({ data: { initData: auth } }),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (data) setOpen(!data.allJoined);
  }, [data]);
  if (!open || !data) return null;

  const verify = async () => {
    const r = await refetch();
    if (r.data?.allJoined) {
      setOpen(false);
      toast.success("✅ Verified — welcome to Tigorix!");
    } else toast.error("📣 Please join every channel first.");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-5 backdrop-blur">
      <div className="surface-card w-full max-w-sm p-5">
        <img src="/tigorix-logo.png" alt="Tigorix" className="mx-auto size-16 rounded-full ring-2 ring-primary" />
        <h2 className="mt-3 text-center text-lg font-extrabold">📢 Join our channels</h2>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Stay joined to all 4 channels to use Tigorix.
        </p>
        <div className="mt-4 space-y-2">
          {data.channels.map((c) => (
            <button
              key={c.id}
              onClick={() => openLink(c.url)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/50 p-2.5 text-left active:scale-[0.98]"
            >
              <ChannelLogo id={c.id} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{c.name}</span>
                <span className="block text-[10px] text-muted-foreground">@{c.id}</span>
              </span>
              <span className={`text-xs font-extrabold ${c.joined ? "text-success" : "text-primary"}`}>
                {c.joined ? "✅ Joined" : "Join ➜"}
              </span>
            </button>
          ))}
        </div>
        <GoldButton className="mt-4" disabled={isFetching} onClick={() => void verify()}>
          {isFetching ? "🔎 Checking…" : "✅ Verify & Continue"}
        </GoldButton>
      </div>
    </div>
  );
}

function ChannelLogo({ id }: { id: string }) {
  const [bad, setBad] = useState(false);
  if (bad)
    return <img src="/tigorix-logo.png" alt="" className="size-10 rounded-full object-cover" />;
  return (
    <img
      src={`/api/public/chat-photo?c=${encodeURIComponent(id)}`}
      alt=""
      onError={() => setBad(true)}
      className="size-10 rounded-full object-cover ring-1 ring-border"
    />
  );
}
