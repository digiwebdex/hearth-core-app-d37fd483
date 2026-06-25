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
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="rounded-full bg-muted p-4 mb-4">
      <Icon className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold mb-1">{title}</h3>
    {(description || hint) && (
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        {description}
        {description && hint ? " " : ""}
        {hint}
      </p>
    )}
    {actionLabel && onAction && (
      <Button onClick={onAction}>{actionLabel}</Button>
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
