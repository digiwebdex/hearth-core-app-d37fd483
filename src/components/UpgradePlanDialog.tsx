import { useNavigate } from "react-router-dom";
import { Lock, ArrowUpCircle, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type LockReason = "plan" | "feature" | "service" | "module";

export interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Human label of the locked module/service. */
  moduleName: string;
  /** The plan that unlocks it (e.g. "Business"). Null when it's a service-focus lock. */
  requiredPlanLabel?: string | null;
  reason: LockReason;
}

/**
 * ONE reusable "this is locked → upgrade" dialog for the whole app. Opened by
 * clicking any locked sidebar item (or reused by page-level guards). It never
 * hardcodes plan logic — callers pass the resolved plan label + lock reason.
 */
export function UpgradePlanDialog({
  open,
  onOpenChange,
  moduleName,
  requiredPlanLabel,
  reason,
}: UpgradePlanDialogProps) {
  const navigate = useNavigate();
  const planLabel = requiredPlanLabel || "a higher";

  const message =
    reason === "service"
      ? `${moduleName} isn't enabled for your agency yet. Turn it on in your service settings, or upgrade your plan to unlock more services.`
      : `${moduleName} is available in the ${planLabel} plan. Upgrade to unlock this feature and more.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="flex items-center justify-center gap-2 text-center">
            {moduleName}
            {requiredPlanLabel && reason !== "service" && (
              <Badge variant="secondary" className="capitalize">
                <Sparkles className="mr-1 h-3 w-3" /> {requiredPlanLabel}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-center">{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate("/subscription");
            }}
          >
            <ArrowUpCircle className="mr-2 h-4 w-4" /> Upgrade Plan
          </Button>
          {reason === "service" && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate("/settings");
              }}
            >
              Manage Services
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradePlanDialog;
