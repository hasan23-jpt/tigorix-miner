import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("surface-card p-4", className)}>{children}</div>;
}

export function SectionTitle({
  icon,
  title,
  action,
}: {
  icon: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
        <span className="text-lg">{icon}</span>
        {title}
      </h2>
      {action}
    </div>
  );
}

export function Guide({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex gap-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>{children}</p>
    </div>
  );
}

export function Stat({
  label,
  value,
  emoji,
}: {
  label: string;
  value: ReactNode;
  emoji: string;
}) {
  return (
    <div className="surface-card flex flex-col gap-1 p-3">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {emoji} {label}
      </span>
      <span className="text-lg font-extrabold text-foreground">{value}</span>
    </div>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "success" | "warn" | "info" | "danger";
}) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/20 text-success",
    warn: "bg-primary/20 text-primary",
    info: "bg-info/20 text-info",
    danger: "bg-destructive/20 text-destructive",
  } as const;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function GoldButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "bg-gold-gradient glow-gold w-full rounded-xl px-4 py-3 text-sm font-extrabold text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-40 disabled:shadow-none",
        className
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm font-bold text-secondary-foreground transition-transform active:scale-[0.97] disabled:opacity-40",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-input bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}