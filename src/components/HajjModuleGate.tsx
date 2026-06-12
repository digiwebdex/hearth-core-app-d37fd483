import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Redirects when tenant has disabled the Hajj/Umrah operations module. */
export function HajjModuleGate({ children }: { children: React.ReactNode }) {
  const { tenant, loading } = useAuth();

  if (loading) return null;
  if (tenant?.enableHajjUmrahModule === false) {
    return <Navigate to="/bookings/hajj" replace />;
  }

  return <>{children}</>;
}

export function useHajjModuleEnabled(): boolean {
  const { tenant } = useAuth();
  return tenant?.enableHajjUmrahModule !== false;
}
