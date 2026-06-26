import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  deriveModuleFlagsFromServiceTypes,
  normalizeEnabledServiceTypes,
} from "@/lib/enabledServiceTypes";

/** True when the agency sells Student/Manpower services (drives the BD ops desk). */
export function useBdModuleEnabled(): boolean {
  const { tenant } = useAuth();
  const flags = deriveModuleFlagsFromServiceTypes(
    normalizeEnabledServiceTypes(tenant?.enabledServiceTypes),
    tenant?.enabledSubcategories,
  );
  return flags.enableBdOperationsModule === true;
}

/** Redirects when the agency does not sell Student/Manpower services. */
export function BdModuleGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const enabled = useBdModuleEnabled();

  if (loading) return null;
  if (!enabled) {
    return <Navigate to="/bookings/student" replace />;
  }

  return <>{children}</>;
}
