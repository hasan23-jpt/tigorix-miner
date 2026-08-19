import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bootstrap, getState } from "@/lib/api.functions";
import { deviceFingerprint, initData, initTelegram, startParam } from "@/lib/telegram";

type Boot = Awaited<ReturnType<typeof bootstrap>>;
type State = Awaited<ReturnType<typeof getState>>;

type Ctx = {
  boot: Boot;
  state: State;
  auth: string;
  refresh: () => Promise<void>;
  run: <T>(fn: () => Promise<T>, success?: (r: T) => string) => Promise<T | null>;
  busy: boolean;
};

const AppCtx = createContext<Ctx | null>(null);

export function useAppState() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppState must be used inside AppProvider");
  return ctx;
}

export function AppProvider({
  boot,
  children,
}: {
  boot: Boot;
  children: ReactNode;
}) {
  const auth = initData();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["state"],
    queryFn: () => getState({ data: { initData: auth } }),
    initialData: { admin: boot.admin, user: boot.user, mining: boot.mining, daily: boot.daily },
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });

  const value = useMemo<Ctx>(
    () => ({
      boot,
      state: data,
      auth,
      busy,
      refresh: async () => {
        await qc.invalidateQueries();
      },
      run: async (fn, success) => {
        setBusy(true);
        try {
          const res = await fn();
          if (success) toast.success(success(res));
          await qc.invalidateQueries();
          return res;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong");
          return null;
        } finally {
          setBusy(false);
        }
      },
    }),
    [boot, data, auth, busy, qc]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Boots the mini app: Telegram bridge + server session, with error surfacing. */
export function useBootstrap() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let tries = 0;
    const tick = () => {
      initTelegram();
      tries += 1;
      // The Telegram bridge script can still be loading right after hydration.
      if (initData() || tries > 25) setReady(true);
      else setTimeout(tick, 200);
    };
    tick();
  }, []);

  return useQuery({
    queryKey: ["bootstrap", ready],
    enabled: ready,
    retry: 1,
    queryFn: () =>
      bootstrap({
        data: {
          initData: initData(),
          device: deviceFingerprint(),
          ref: startParam(),
        },
      }),
  });
}