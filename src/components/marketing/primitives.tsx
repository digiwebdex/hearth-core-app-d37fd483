import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ReactNode, ElementType } from "react";

// ── Shared marketing design primitives ──
// One consistent language for the public SaaS site: dark navy canvas, amber→orange
// accent, glass cards, generous spacing, professional typography. Every public
// page/section composes these so the whole site reads as one system.

/** A full-width vertical section with consistent padding and an optional alt (raised) background. */
export function Section({
  children,
  alt = false,
  className,
  id,
}: {
  children: ReactNode;
  alt?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-20 md:py-28", alt && "bg-[#0f1729]", className)}>
      <div className="container mx-auto px-4">{children}</div>
    </section>
  );
}

/** Centered eyebrow badge + gradient-capable heading + subtitle. */
export function SectionHeading({
  badge,
  title,
  subtitle,
  align = "center",
  className,
}: {
  badge?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-14 max-w-2xl",
        align === "center" ? "text-center mx-auto" : "text-left",
        className,
      )}
    >
      {badge && (
        <Badge className="mb-4 bg-amber-400/10 text-amber-400 border-amber-400/25 hover:bg-amber-400/15">
          {badge}
        </Badge>
      )}
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white">{title}</h2>
      {subtitle && <p className="text-white/45 text-base md:text-lg">{subtitle}</p>}
    </div>
  );
}

/** Amber→orange gradient text. */
export function GradientText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Glass card surface with a subtle hover lift. Use `interactive` for hoverable cards. */
export function GlassCard({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-white/[0.04] p-6 backdrop-blur-sm transition-all",
        interactive &&
          "hover:-translate-y-0.5 hover:border-amber-400/25 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-black/20",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Rounded gradient icon tile (the recurring amber glass square behind feature icons). */
export function IconTile({
  icon: Icon,
  className,
  size = "md",
}: {
  icon: ElementType;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const box = size === "lg" ? "w-14 h-14 rounded-2xl" : size === "sm" ? "w-10 h-10 rounded-lg" : "w-12 h-12 rounded-xl";
  const ic = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <div
      className={cn(
        box,
        "flex items-center justify-center border border-amber-500/10 bg-gradient-to-br from-amber-500/15 to-orange-500/15",
        className,
      )}
    >
      <Icon className={cn(ic, "text-amber-400")} />
    </div>
  );
}

/** A single big-number statistic. */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl font-extrabold text-amber-400">{value}</p>
      <p className="text-sm text-white/40 mt-1">{label}</p>
    </div>
  );
}

/** The recurring amber→orange primary button classes (for <Button className={PRIMARY_BTN}>). */
export const PRIMARY_BTN =
  "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25";

/** The recurring subtle ghost/outline button classes on dark surfaces. */
export const GHOST_BTN = "border-white/15 bg-white/5 text-white hover:bg-white/10";
