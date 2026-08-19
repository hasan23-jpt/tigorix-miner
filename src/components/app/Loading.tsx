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
      <div className="relative">
        <div className="absolute inset-0 animate-pulse-ring rounded-full" />
        <img
          src="/tigorix-logo.png"
          alt="Tigorix logo"
          className="animate-float relative size-44 drop-shadow-[0_10px_30px_rgba(255,170,0,0.35)]"
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
            <span className="text-primary">X</span>
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