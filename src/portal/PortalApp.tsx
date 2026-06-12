import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getPortalToken } from "@/lib/portalApi";
import PortalLogin from "./pages/PortalLogin";
import PortalVerify from "./pages/PortalVerify";
import PortalLayout from "./PortalLayout";
import MyBookings from "./pages/MyBookings";
import BookingDetail from "./pages/BookingDetail";
import AgentCommissions from "./pages/AgentCommissions";
import MyPurchaseOrders from "./pages/MyPurchaseOrders";

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getPortalToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function PortalApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PortalLogin />} />
            <Route path="/verify" element={<PortalVerify />} />
            <Route
              element={
                <RequireAuth>
                  <PortalLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/bookings" replace />} />
              <Route path="/bookings" element={<MyBookings />} />
              <Route path="/bookings/:id" element={<BookingDetail />} />
              <Route path="/agent" element={<AgentCommissions />} />
              <Route path="/purchase-orders" element={<MyPurchaseOrders />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
