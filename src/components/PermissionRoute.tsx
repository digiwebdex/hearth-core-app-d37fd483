import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import type { Module } from "@/lib/permissions";

interface PermissionRouteProps {
  module: Module;
  children: React.ReactNode;
}

/** Redirects to dashboard when the current user cannot access a module. */
const PermissionRoute = ({ module, children }: PermissionRouteProps) => {
  const { canAccess } = usePermissions();
  if (!canAccess(module)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default PermissionRoute;
