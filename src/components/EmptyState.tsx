import { Button } from "@/components/ui/button";
import { Inbox, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = ({ icon: Icon = Inbox, title, description, hint, actionLabel, onAction }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/40 ring-1 ring-border/50">
      <Icon className="h-7 w-7 text-muted-foreground" />
    </div>
    <h3 className="text-base font-semibold">{title}</h3>
    {(description || hint) && (
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {description}
        {description && hint ? " " : ""}
        {hint}
      </p>
    )}
    {actionLabel && onAction && (
      <Button className="mt-5" onClick={onAction}>{actionLabel}</Button>
    )}
  </div>
);

/** Compact inline empty message for cards and tabs */
export function InlineEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <p className="text-sm text-muted-foreground text-center py-4">
      {title}
      {hint ? (
        <>
          <br />
          <span className="text-xs">{hint}</span>
        </>
      ) : null}
    </p>
  );
}

export default EmptyState;
