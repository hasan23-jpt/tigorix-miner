import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Home, ListChecks, PlayCircle, User, Users } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import logo from "@/assets/tigorix-logo.png.asset.json";
import { APP, fmt } from "@/lib/config";
import { AppProvider, useAppState, useBootstrap } from "@/components/app/useApp";
import { LoadingScreen } from "@/components/app/Loading";
import { HomeTab } from "@/components/app/HomeTab";
import { TasksTab } from "@/components/app/TasksTab";
import { AdsTab } from "@/components/app/AdsTab";
import { ReferTab } from "@/components/app/ReferTab";
import { ProfileTab } from "@/components/app/ProfileTab";
import { AdminPanel } from "@/components/app/AdminPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tigorix 🐯 — Mine, Earn & Withdraw TGX Tokens" },
      {
        name: "description",
        content:
          "Tigorix Telegram Mini App: mine TGX tokens hourly, complete tasks, watch ads, refer friends and withdraw in USDT (BEP-20).",
      },
      { property: "og:title", content: "Tigorix 🐯 — Earn Real Rewards Anytime, Anywhere" },
      {
        property: "og:description",
        content: "Mine TGX hourly, finish tasks, invite friends and cash out in USDT BEP-20.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { data, isLoading, error, refetch } = useBootstrap();

  if (isLoading || !data) {
    return (
      <>
        <LoadingScreen
          error={error instanceof Error ? error.message : null}
          onRetry={() => void refetch()}
        />
        <Toaster />
      </>
    );
  }

  return (
    <AppProvider boot={data}>
      <Shell />
      <Toaster />
    </AppProvider>
  );
}

const TABS = [
  { id: "home", label: "Home", Icon: Home },
  { id: "tasks", label: "Tasks", Icon: ListChecks },
  { id: "ads", label: "Earn", Icon: PlayCircle },
  { id: "refer", label: "Refer", Icon: Users },
  { id: "profile", label: "Profile", Icon: User },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Shell() {
  const { state } = useAppState();
  const [tab, setTab] = useState<TabId>("home");
  const [admin, setAdmin] = useState(false);

  if (state.user.suspended) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div className="surface-card max-w-sm p-6">
          <p className="text-5xl">🚫</p>
          <h1 className="mt-3 text-xl font-extrabold">Account suspended</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {state.user.suspendReason ||
              "Suspicious activity was detected on this account. Every feature is locked."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Contact support in the community channel if you believe this is a mistake.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
        <img src={logo.url} alt="Tigorix logo" className="size-9 rounded-full" />
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold leading-tight">
            {state.user.username ? `@${state.user.username}` : state.user.firstName || "Tiger"}
          </p>
          <p className="text-[10px] text-muted-foreground">🟢 Online · ID {state.user.id}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</p>
          <p className="text-sm font-black">
            <span className="text-gold-gradient">{fmt(state.user.balance)}</span>{" "}
            <span className="text-[10px] text-muted-foreground">{APP.tokenName}</span>
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-28">
        {admin ? (
          <AdminPanel onClose={() => setAdmin(false)} />
        ) : tab === "home" ? (
          <HomeTab onNavigate={(t) => setTab(t as TabId)} />
        ) : tab === "tasks" ? (
          <TasksTab />
        ) : tab === "ads" ? (
          <AdsTab />
        ) : tab === "refer" ? (
          <ReferTab />
        ) : (
          <ProfileTab onOpenAdmin={() => setAdmin(true)} />
        )}
      </main>

      {!admin && (
        <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-md -translate-x-1/2 items-end justify-around border-t border-border/60 bg-background/95 px-2 pb-3 pt-2 backdrop-blur">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            const center = id === "ads";
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={
                  center
                    ? `-mt-7 flex flex-col items-center gap-1 rounded-2xl px-4 py-2.5 text-[10px] font-extrabold ${active ? "bg-gold-gradient glow-gold text-primary-foreground" : "border border-primary/40 bg-secondary/70 text-primary"}`
                    : `flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`
                }
              >
                <Icon className={center ? "size-7" : "size-5"} />
                {label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
