import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SubscriptionGate from "@/components/SubscriptionGate";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <SubscriptionGate>
      {children}
    </SubscriptionGate>
  );
};

export default ProtectedRoute;
