import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  deriveModuleFlagsFromServiceTypes,
  normalizeEnabledServiceTypes,
} from "@/lib/enabledServiceTypes";

/** True when the agency sells Hajj/Umrah services (drives the ops desk). */
export function useHajjModuleEnabled(): boolean {
  const { tenant } = useAuth();
  const flags = deriveModuleFlagsFromServiceTypes(
    normalizeEnabledServiceTypes(tenant?.enabledServiceTypes),
    tenant?.enabledSubcategories,
  );
  return flags.enableHajjUmrahModule === true;
}

/** Redirects when the agency does not sell Hajj/Umrah services. */
export function HajjModuleGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const enabled = useHajjModuleEnabled();

  if (loading) return null;
  if (!enabled) {
    return <Navigate to="/packages/hajj" replace />;
  }

  return <>{children}</>;
}
