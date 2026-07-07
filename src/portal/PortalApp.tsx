import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getPortalToken } from "@/lib/portalApi";
import { isPortalHost } from "@/lib/domainResolver";
import PortalLogin from "./pages/PortalLogin";
import PortalVerify from "./pages/PortalVerify";
import PortalLayout from "./PortalLayout";

// Lazy-load the authenticated screens for fast first paint.
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const BookingDetail = lazy(() => import("./pages/BookingDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Payments = lazy(() => import("./pages/Payments"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Visa = lazy(() => import("./pages/Visa"));
const Support = lazy(() => import("./pages/Support"));
const SupportDetail = lazy(() => import("./pages/SupportDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const AgentCommissions = lazy(() => import("./pages/AgentCommissions"));
const MyPurchaseOrders = lazy(() => import("./pages/MyPurchaseOrders"));

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30000 } } });

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getPortalToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

const Loading = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>
);

export default function PortalApp() {
  // On the portal.* host the app is served at root; under the /portal path
  // (dev / universal fallback) React Router runs with a /portal basename.
  const basename = isPortalHost() ? undefined : "/portal";
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={basename}>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<PortalLogin />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify" element={<PortalVerify />} />
              <Route
                element={
                  <RequireAuth>
                    <PortalLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/bookings" element={<MyBookings />} />
                <Route path="/bookings/:id" element={<BookingDetail />} />
                <Route path="/visa" element={<Visa />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/support" element={<Support />} />
                <Route path="/support/:id" element={<SupportDetail />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/agent" element={<AgentCommissions />} />
                <Route path="/purchase-orders" element={<MyPurchaseOrders />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
