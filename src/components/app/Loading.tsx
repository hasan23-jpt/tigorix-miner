import { GoldButton } from "./ui";

export function LoadingScreen({
  error,
  onRetry,
}: {
  error?: string | null;
  onRetry?: () => void;
}) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const message = offline
    ? "📡 No internet connection. Check your network and try again."
    : error;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="animate-float relative grid size-48 place-items-center">
        <div className="animate-pulse-ring absolute inset-3 rounded-full" />
        <div className="ring-gradient animate-spin-slow absolute inset-0 rounded-full p-1 opacity-90 blur-[1px]" />
        <div className="absolute inset-[6px] rounded-full bg-background" />
        <img
          src="/tigorix-logo.png"
          alt="Tigorix logo"
          className="glow-gold relative size-40 rounded-full object-cover ring-2 ring-primary/50"
        />
      </div>

      {message ? (
        <div className="space-y-4">
          <h1 className="text-lg font-extrabold text-destructive">Connection problem</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          {onRetry && <GoldButton onClick={onRetry}>🔄 Retry</GoldButton>}
        </div>
      ) : (
        <div className="w-full max-w-xs space-y-3">
          <h1 className="text-2xl font-black tracking-tight">
            <span className="text-gold-gradient">TIGORI</span>
            <span className="text-ember-gradient">X</span>
          </h1>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Earn • Play • Grow
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="animate-shine h-full w-full bg-gold-gradient" />
          </div>
          <p className="text-xs text-muted-foreground">🐯 Waking up the tiger…</p>
        </div>
      )}
    </div>
  );
}