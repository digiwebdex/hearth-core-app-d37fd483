import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Redirects when tenant has disabled the Student/Manpower operations module. */
export function BdModuleGate({ children }: { children: React.ReactNode }) {
  const { tenant, loading } = useAuth();

  if (loading) return null;
  if (tenant?.enableBdOperationsModule !== true) {
    return <Navigate to="/bookings/student" replace />;
  }

  return <>{children}</>;
}

export function useBdModuleEnabled(): boolean {
  const { tenant } = useAuth();
  return tenant?.enableBdOperationsModule === true;
}
