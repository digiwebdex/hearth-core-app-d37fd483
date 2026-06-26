import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useInRouterContext, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { WebsiteProvider } from "@/contexts/WebsiteContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PermissionRoute from "@/components/PermissionRoute";
import AdminRoute from "@/components/AdminRoute";
import type { Module } from "@/lib/permissions";
import Login from "./pages/Login";
import { Navigate } from "react-router-dom";
import { getReservedSubdomain, resolveHostname } from "@/lib/domainResolver";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Team from "./pages/Team";
import StaffHrm from "./pages/StaffHrm";
import Organization from "./pages/Organization";
import SettingsPage from "./pages/SettingsPage";
import WebsiteCustomizer from "./pages/WebsiteCustomizer";
import WebsiteBuilderHome from "./pages/WebsiteBuilderHome";
import WebsitePublishGuide from "./pages/WebsitePublishGuide";
import Clients from "./pages/Clients";
import Agents from "./pages/Agents";
import AgentProfile from "./pages/AgentProfile";
import Vendors from "./pages/Vendors";
import VendorDetails from "./pages/VendorDetails";
import Leads from "./pages/Leads";
import FollowUps from "./pages/FollowUps";
import ActivityLog from "./pages/ActivityLog";
import Documents from "./pages/Documents";
import LeadDetails from "./pages/LeadDetails";
import ClientProfile from "./pages/ClientProfile";
import Tasks from "./pages/Tasks";
import Quotations from "./pages/Quotations";
import QuotationBuilder from "./pages/QuotationBuilder";
import QuotationDetails from "./pages/QuotationDetails";
import QuotationPrint from "./pages/QuotationPrint";
import Packages from "./pages/Packages";
import Bookings from "./pages/Bookings";
import BookingDetails from "./pages/BookingDetails";
import Invoices from "./pages/Invoices";
import InvoiceReceipt from "./pages/InvoiceReceipt";
import Accounts from "./pages/Accounts";
import Reports from "./pages/Reports";
import HajjUmrah from "./pages/HajjUmrah";
import { HajjModuleGate } from "@/components/HajjModuleGate";
import { BdModuleGate } from "@/components/BdModuleGate";
import BdOperations from "./pages/BdOperations";
import ServiceOperations from "./pages/ServiceOperations";
import SupportTickets from "./pages/SupportTickets";
import FinanceReminders from "./pages/FinanceReminders";
import SubscriptionRoute from "./components/SubscriptionRoute";
import PaymentCallback from "./pages/PaymentCallback";
import RoleManagement from "./pages/RoleManagement";
import NotificationLog from "./pages/NotificationLog";
import Onboarding from "./pages/Onboarding";
import VerifyEmail from "./pages/VerifyEmail";
import SettingsBilling from "./pages/SettingsBilling";
import UserGuide from "./pages/UserGuide";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTenants from "./pages/admin/AdminTenants";
import AdminPendingUsers from "./pages/admin/AdminPendingUsers";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminTenantDetails from "./pages/admin/AdminTenantDetails";
import AdminDomains from "./pages/admin/AdminDomains";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminFeatures from "./pages/admin/AdminFeatures";
import AdminSmsTemplates from "./pages/admin/AdminSmsTemplates";
import AdminWhatsAppTemplates from "./pages/admin/AdminWhatsAppTemplates";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminSmsLogs from "./pages/admin/AdminSmsLogs";
import AdminRoles from "./pages/admin/AdminRoles";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminReports from "./pages/admin/AdminReports";
import AdminMasterData from "./pages/admin/AdminMasterData";
import SiteHome from "./pages/site/SiteHome";
import SiteAbout from "./pages/site/SiteAbout";
import SitePackages from "./pages/site/SitePackages";
import SiteContact from "./pages/site/SiteContact";
import SiteBlog from "./pages/site/SiteBlog";
import SitePricing from "./pages/site/SitePricing";
import WebsiteBlog from "./pages/WebsiteBlog";
import CorporateTravel from "./pages/CorporateTravel";
import NotFound from "./pages/NotFound";
import BookingSegmentRoute from "./components/BookingSegmentRoute";
import { packagesDefaultPath } from "./config/navigation";
import Index from "./pages/Index";
import Features from "./pages/marketing/Features";
import Pricing from "./pages/marketing/Pricing";
import Demo from "./pages/marketing/Demo";
import ContactUs from "./pages/marketing/ContactUs";
import FAQ from "./pages/marketing/FAQ";
import Privacy from "./pages/marketing/Privacy";
import Terms from "./pages/marketing/Terms";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const SettingsTax = lazy(() => import("./pages/SettingsTax"));
const FinancialStatements = lazy(() => import("./pages/FinancialStatements"));
const Payroll = lazy(() => import("./pages/Payroll"));
const WebsiteSeo = lazy(() => import("./pages/WebsiteSeo"));
const Loyalty = lazy(() => import("./pages/Loyalty"));
const Referrals = lazy(() => import("./pages/Referrals"));
const SalesAnalytics = lazy(() => import("./pages/SalesAnalytics"));
const GroupTours = lazy(() => import("./pages/GroupTours"));
const MiceEvents = lazy(() => import("./pages/MiceEvents"));
const TravelApprovals = lazy(() => import("./pages/TravelApprovals"));
const VisaTracker = lazy(() => import("./pages/VisaTracker"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Recruitment = lazy(() => import("./pages/Recruitment"));
const TicketTransactions = lazy(() => import("./pages/TicketTransactions"));

const queryClient = new QueryClient();

type SitePage = "home" | "about" | "packages" | "contact" | "blog";

const P = ({ children }: { children: React.ReactNode }) => <ProtectedRoute>{children}</ProtectedRoute>;
const PM = ({ module, children }: { module: Module; children: React.ReactNode }) => (
  <ProtectedRoute>
    <PermissionRoute module={module}>{children}</PermissionRoute>
  </ProtectedRoute>
);
const A = ({ children }: { children: React.ReactNode }) => <AdminRoute>{children}</AdminRoute>;

const getSitePage = (page: SitePage) =>
  page === "about"
    ? SiteAbout
    : page === "packages"
      ? SitePackages
      : page === "contact"
        ? SiteContact
        : page === "blog"
          ? SiteBlog
          : SiteHome;

const TenantBlogPostRoute = () => {
  if (isTenantPublicHost()) return <WebsiteProvider><SiteBlog /></WebsiteProvider>;
  return <Navigate to="/site/blog" replace />;
};

const SiteSlugWrapper = ({ page }: { page: SitePage }) => {
  const { slug } = useParams<{ slug: string }>();
  const Page = getSitePage(page);
  return <WebsiteProvider slug={slug}><Page /></WebsiteProvider>;
};

const isTenantPublicHost = () => {
  const resolution = resolveHostname();
  return resolution.type === "slug" || resolution.type === "custom-domain";
};

const PublicSiteRoute = ({ page }: { page: SitePage }) => {
  const Page = getSitePage(page);
  if (isTenantPublicHost()) return <WebsiteProvider><Page /></WebsiteProvider>;
  if (page === "home") {
    return getReservedSubdomain(window.location.hostname) === "app" ? <Navigate to="/login" replace /> : <Index />;
  }
  return <NotFound />;
};

const AppContent = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<PublicSiteRoute page="home" />} />
          <Route path="/about" element={<PublicSiteRoute page="about" />} />
          <Route path="/packages" element={<PublicSiteRoute page="packages" />} />
          <Route path="/blog" element={<PublicSiteRoute page="blog" />} />
          <Route path="/blog/:postSlug" element={<TenantBlogPostRoute />} />
          <Route path="/contact" element={<PublicSiteRoute page="contact" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/onboarding" element={<P><Onboarding /></P>} />

          <Route path="/site" element={<WebsiteProvider><SiteHome /></WebsiteProvider>} />
          <Route path="/site/about" element={<WebsiteProvider><SiteAbout /></WebsiteProvider>} />
          <Route path="/site/packages" element={<WebsiteProvider><SitePackages /></WebsiteProvider>} />
          <Route path="/site/contact" element={<WebsiteProvider><SiteContact /></WebsiteProvider>} />
          <Route path="/site/blog" element={<WebsiteProvider><SiteBlog /></WebsiteProvider>} />
          <Route path="/site/blog/:postSlug" element={<WebsiteProvider><SiteBlog /></WebsiteProvider>} />
          <Route path="/site/pricing" element={<SitePricing />} />
          <Route path="/site/:slug" element={<SiteSlugWrapper page="home" />} />
          <Route path="/site/:slug/about" element={<SiteSlugWrapper page="about" />} />
          <Route path="/site/:slug/packages" element={<SiteSlugWrapper page="packages" />} />
          <Route path="/site/:slug/contact" element={<SiteSlugWrapper page="contact" />} />
          <Route path="/site/:slug/blog" element={<SiteSlugWrapper page="blog" />} />
          <Route path="/site/:slug/blog/:postSlug" element={<SiteSlugWrapper page="blog" />} />

          <Route path="/dashboard" element={<P><Dashboard /></P>} />
          <Route path="/clients" element={<P><Clients /></P>} />
          <Route path="/clients/:id" element={<P><ClientProfile /></P>} />
          <Route path="/corporate" element={<P><CorporateTravel /></P>} />
          <Route path="/agents" element={<P><Agents /></P>} />
          <Route path="/agents/:id" element={<P><AgentProfile /></P>} />
          <Route path="/vendors" element={<P><Vendors /></P>} />
          <Route path="/vendors/:id" element={<P><VendorDetails /></P>} />
          <Route path="/leads" element={<P><Leads /></P>} />
          <Route path="/leads/:id" element={<P><LeadDetails /></P>} />
          <Route path="/follow-ups" element={<P><FollowUps /></P>} />
          <Route path="/documents" element={<P><Documents /></P>} />
          <Route path="/tasks" element={<P><Tasks /></P>} />
          <Route path="/quotations" element={<P><Quotations /></P>} />
          <Route path="/quotations/new" element={<P><QuotationBuilder /></P>} />
          <Route path="/quotations/:id" element={<P><QuotationDetails /></P>} />
          <Route path="/quotations/:id/edit" element={<P><QuotationBuilder /></P>} />
          <Route path="/quotations/:id/print" element={<QuotationPrint />} />
          <Route path="/packages/:preset" element={<P><Packages /></P>} />
          <Route path="/packages" element={<Navigate to={packagesDefaultPath} replace />} />
          <Route path="/travel-packages" element={<Navigate to={packagesDefaultPath} replace />} />
          <Route path="/packages-and-services" element={<Navigate to={packagesDefaultPath} replace />} />
          <Route path="/services" element={<Navigate to={packagesDefaultPath} replace />} />
          <Route path="/app-packages" element={<Navigate to={packagesDefaultPath} replace />} />
          <Route path="/bookings" element={<P><Bookings /></P>} />
          <Route path="/bookings/:segment" element={<P><BookingSegmentRoute /></P>} />
          <Route path="/invoices" element={<P><Invoices /></P>} />
          <Route path="/payments" element={<P><Invoices /></P>} />
          <Route path="/invoices/:id/receipt" element={<P><InvoiceReceipt /></P>} />
          <Route path="/accounts" element={<PM module="accounts"><Accounts /></PM>} />
          <Route path="/expenses" element={<PM module="accounts"><Accounts /></PM>} />
          <Route path="/commissions" element={<PM module="agents"><Agents /></PM>} />
          <Route path="/reports" element={<PM module="reports"><Reports /></PM>} />
          <Route path="/hajj-umrah" element={<P><HajjModuleGate><HajjUmrah /></HajjModuleGate></P>} />
          <Route path="/hajj-umrah/operations" element={<Navigate to="/hajj-umrah" replace />} />
          <Route path="/operations/bd" element={<P><BdModuleGate><BdOperations /></BdModuleGate></P>} />
          <Route path="/operations/services" element={<P><ServiceOperations /></P>} />
          <Route path="/support" element={<P><SupportTickets /></P>} />
          <Route path="/finance/reminders" element={<P><FinanceReminders /></P>} />
          <Route path="/legacy/hajj-operations" element={<Navigate to="/hajj-umrah" replace />} />
          <Route path="/subscription" element={<P><SubscriptionRoute /></P>} />
          <Route path="/payment/callback" element={<P><PaymentCallback /></P>} />
          <Route path="/roles" element={<PM module="team"><RoleManagement /></PM>} />
          <Route path="/notifications" element={<P><NotificationLog /></P>} />
          <Route path="/team" element={<PM module="team"><Team /></PM>} />
          <Route path="/hrm" element={<PM module="team"><StaffHrm /></PM>} />
          <Route path="/organization" element={<PM module="organization"><Organization /></PM>} />
          <Route path="/settings" element={<PM module="settings"><SettingsPage /></PM>} />
          <Route path="/activity-log" element={<P><ActivityLog /></P>} />
          <Route path="/settings/billing" element={<PM module="subscription"><SettingsBilling /></PM>} />
          <Route path="/website" element={<PM module="website"><WebsiteBuilderHome /></PM>} />
          <Route path="/website/blog" element={<PM module="website"><WebsiteBlog /></PM>} />
          <Route path="/website/builder" element={<PM module="website"><WebsiteCustomizer /></PM>} />
          <Route path="/website/theme-builder" element={<PM module="website"><Navigate to="/website/builder" replace /></PM>} />
          <Route path="/website/publish" element={<PM module="website"><WebsitePublishGuide /></PM>} />
          <Route path="/website/domains" element={<PM module="website"><WebsitePublishGuide /></PM>} />
          <Route path="/website/seo" element={<PM module="website"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><WebsiteSeo /></Suspense></PM>} />
          <Route path="/settings/tax" element={<PM module="settings"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><SettingsTax /></Suspense></PM>} />
          <Route path="/financial-statements" element={<PM module="reports"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><FinancialStatements /></Suspense></PM>} />
          <Route path="/payroll" element={<PM module="team"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><Payroll /></Suspense></PM>} />
          <Route path="/loyalty" element={<PM module="clients"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><Loyalty /></Suspense></PM>} />
          <Route path="/referrals" element={<PM module="clients"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><Referrals /></Suspense></PM>} />
          <Route path="/sales-analytics" element={<PM module="reports"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><SalesAnalytics /></Suspense></PM>} />
          <Route path="/group-tours" element={<PM module="bookings"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><GroupTours /></Suspense></PM>} />
          <Route path="/mice" element={<PM module="bookings"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><MiceEvents /></Suspense></PM>} />
          <Route path="/travel-approvals" element={<PM module="bookings"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><TravelApprovals /></Suspense></PM>} />
          <Route path="/visa-tracker" element={<PM module="bookings"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><VisaTracker /></Suspense></PM>} />
          <Route path="/inventory" element={<PM module="bookings"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><Inventory /></Suspense></PM>} />
          <Route path="/recruitment" element={<PM module="team"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><Recruitment /></Suspense></PM>} />
          <Route path="/ticket-transactions" element={<PM module="bookings"><Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}><TicketTransactions /></Suspense></PM>} />
          <Route path="/user-guide" element={<P><UserGuide /></P>} />

          <Route path="/admin" element={<A><AdminDashboard /></A>} />
          <Route path="/admin/tenants" element={<A><AdminTenants /></A>} />
          <Route path="/admin/pending-users" element={<A><AdminPendingUsers /></A>} />
          <Route path="/admin/tenants/:tenantId" element={<A><AdminTenantDetails /></A>} />
          <Route path="/admin/payments" element={<A><AdminPayments /></A>} />
          <Route path="/admin/plans" element={<A><AdminPlans /></A>} />
          <Route path="/admin/domains" element={<A><AdminDomains /></A>} />
          <Route path="/admin/subscriptions" element={<A><AdminSubscriptions /></A>} />
          <Route path="/admin/settings" element={<A><AdminSettings /></A>} />
          <Route path="/admin/features" element={<A><AdminFeatures /></A>} />
          <Route path="/admin/roles" element={<A><AdminRoles /></A>} />
          <Route path="/admin/sms-templates" element={<A><AdminSmsTemplates /></A>} />
          <Route path="/admin/whatsapp-templates" element={<A><AdminWhatsAppTemplates /></A>} />
          <Route path="/admin/coupons" element={<A><AdminCoupons /></A>} />
          <Route path="/admin/sms-logs" element={<A><AdminSmsLogs /></A>} />
          <Route path="/admin/audit-log" element={<A><AdminAuditLog /></A>} />
          <Route path="/admin/reports" element={<A><AdminReports /></A>} />
          <Route path="/admin/master-data" element={<A><AdminMasterData /></A>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

const AppWithRouter = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

const App = () => {
  try {
    const inRouterContext = useInRouterContext();
    if (inRouterContext) return <AppContent />;
  } catch {
    // Not in a router context
  }
  return <AppWithRouter />;
};

export default App;
