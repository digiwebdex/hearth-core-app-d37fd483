import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, tenantApi, type User, type Tenant } from "@/lib/api";
import type { PlanType } from "@/lib/plans";
import { mapLegacyRole, type AppRole } from "@/lib/permissions";
import { getSubscriptionBlockState, type SubscriptionBlockReason } from "@/lib/subscriptionAccess";

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  currentPlan: PlanType;
  appRole: AppRole;
  isSubscriptionExpired: boolean;
  isSubscriptionBlocked: boolean;
  subscriptionBlockReason: SubscriptionBlockReason | null;
  isTrialActive: boolean;
  trialDaysLeft: number;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; phone: string; password: string; tenantName: string; plan?: string }) => Promise<{ pendingApproval: boolean; message?: string; user?: User; trialDays?: number }>;
  logout: () => void;
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const currentPlan: PlanType = (tenant?.subscriptionPlan as PlanType) || "free";
  const appRole: AppRole = user ? mapLegacyRole(user.role) : "sales_agent";

  const isTrialActive =
    tenant?.subscriptionStatus === "trial" &&
    Boolean(
      tenant?.subscriptionExpiry && new Date(tenant.subscriptionExpiry) > new Date()
    );
  const trialDaysLeft = (() => {
    if (!isTrialActive || !tenant?.subscriptionExpiry) return 0;
    const diff = new Date(tenant.subscriptionExpiry).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const { isBlocked: isSubscriptionBlocked, reason: subscriptionBlockReason } =
    getSubscriptionBlockState(tenant, currentPlan);

  const isSubscriptionExpired = isSubscriptionBlocked;

  const fetchTenant = async () => {
    try {
      const t = await tenantApi.get();
      setTenant(t);
    } catch {
      // Tenant fetch failed, use defaults
    }
  };

  const refreshTenant = useCallback(async () => {
    await fetchTenant();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 12000);

    Promise.all([
      authApi.me().catch(() => {
        localStorage.removeItem("token");
        return null;
      }),
      tenantApi.get().catch(() => null),
    ])
      .then(([u, t]) => {
        if (cancelled) return;
        if (u) setUser(u);
        if (t) setTenant(t);
      })
      .finally(() => {
        cancelled = true;
        window.clearTimeout(timeout);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    localStorage.setItem("token", res.token);
    setUser(res.user);
    await fetchTenant();
    return res.user;
  }, []);

  const register = useCallback(
    async (data: { name: string; email: string; password: string; tenantName: string; plan?: string }) => {
      const res: any = await authApi.register(data);
      // New flow: instant token + 3-day trial
      if (res.token) {
        localStorage.setItem("token", res.token);
        if (res.user) setUser(res.user);
        if (res.tenant) setTenant(res.tenant);
        else fetchTenant();
        return { pendingApproval: false, user: res.user, trialDays: res.trialDays, message: res.message };
      }
      // Legacy fallback (older backend still in pending-approval mode)
      return { pendingApproval: true, message: res.message };
    },
    []
  );

  const logout = useCallback(() => {
    authApi.logout().catch(() => {}); // fire-and-forget audit log
    localStorage.removeItem("token");
    setUser(null);
    setTenant(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, tenant, currentPlan, appRole, isSubscriptionExpired, isSubscriptionBlocked, subscriptionBlockReason, isTrialActive, trialDaysLeft, loading, login, register, logout, refreshTenant }}>
      {children}
    </AuthContext.Provider>
  );
};
