import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useInRouterContext, useParams, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthProvider } from "@/contexts/AuthContext";
import { WebsiteProvider } from "@/contexts/WebsiteContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PermissionRoute from "@/components/PermissionRoute";
import AdminRoute from "@/components/AdminRoute";
import SubscriptionRoute from "./components/SubscriptionRoute";
import BookingSegmentRoute from "./components/BookingSegmentRoute";
import { HajjModuleGate } from "@/components/HajjModuleGate";
import { BdModuleGate } from "@/components/BdModuleGate";
import type { Module } from "@/lib/permissions";
import { getReservedSubdomain, resolveHostname } from "@/lib/domainResolver";
import { packagesDefaultPath } from "./config/navigation";

// ── All route pages are code-split (lazy) behind one top-level Suspense
// boundary — this keeps the initial bundle small (docs/v2-master/104-Codebase-Review.md §8).
// Guards/providers above stay eager because they wrap every route.
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Team = lazy(() => import("./pages/Team"));
const Branches = lazy(() => import("./pages/Branches"));
const StaffHrm = lazy(() => import("./pages/StaffHrm"));
const Organization = lazy(() => import("./pages/Organization"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const WebsiteCustomizer = lazy(() => import("./pages/WebsiteCustomizer"));
const WebsiteBuilderHome = lazy(() => import("./pages/WebsiteBuilderHome"));
const WebsitePublishGuide = lazy(() => import("./pages/WebsitePublishGuide"));
const Clients = lazy(() => import("./pages/Clients"));
const Crm = lazy(() => import("./pages/Crm"));
const Complaints = lazy(() => import("./pages/Complaints"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CrmAnalytics = lazy(() => import("./pages/CrmAnalytics"));
const CrmSettings = lazy(() => import("./pages/CrmSettings"));
const Agents = lazy(() => import("./pages/Agents"));
const VisaStock = lazy(() => import("./pages/VisaStock"));
const AgentProfile = lazy(() => import("./pages/AgentProfile"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDetails = lazy(() => import("./pages/VendorDetails"));
const Leads = lazy(() => import("./pages/Leads"));
const FollowUps = lazy(() => import("./pages/FollowUps"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const Documents = lazy(() => import("./pages/Documents"));
const LeadDetails = lazy(() => import("./pages/LeadDetails"));
const ClientProfile = lazy(() => import("./pages/ClientProfile"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Quotations = lazy(() => import("./pages/Quotations"));
const QuotationBuilder = lazy(() => import("./pages/QuotationBuilder"));
const QuotationDetails = lazy(() => import("./pages/QuotationDetails"));
const QuotationPrint = lazy(() => import("./pages/QuotationPrint"));
const Packages = lazy(() => import("./pages/Packages"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceReceipt = lazy(() => import("./pages/InvoiceReceipt"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Accounting = lazy(() => import("./pages/Accounting"));
const Reports = lazy(() => import("./pages/Reports"));
const HajjUmrah = lazy(() => import("./pages/HajjUmrah"));
const BdOperations = lazy(() => import("./pages/BdOperations"));
const ServiceOperations = lazy(() => import("./pages/ServiceOperations"));
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const FinanceReminders = lazy(() => import("./pages/FinanceReminders"));
const PaymentCallback = lazy(() => import("./pages/PaymentCallback"));
const RoleManagement = lazy(() => import("./pages/RoleManagement"));
const NotificationLog = lazy(() => import("./pages/NotificationLog"));
const SettingsBilling = lazy(() => import("./pages/SettingsBilling"));
const UserGuide = lazy(() => import("./pages/UserGuide"));
const WebsiteBlog = lazy(() => import("./pages/WebsiteBlog"));
const CorporateTravel = lazy(() => import("./pages/CorporateTravel"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Index = lazy(() => import("./pages/Index"));

// Admin console
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminLandingCMS = lazy(() => import("./pages/admin/AdminLandingCMS"));
const AdminTenants = lazy(() => import("./pages/admin/AdminTenants"));
const AdminPendingUsers = lazy(() => import("./pages/admin/AdminPendingUsers"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminPlans = lazy(() => import("./pages/admin/AdminPlans"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminTenantDetails = lazy(() => import("./pages/admin/AdminTenantDetails"));
const AdminDomains = lazy(() => import("./pages/admin/AdminDomains"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminFeatures = lazy(() => import("./pages/admin/AdminFeatures"));
const AdminSmsTemplates = lazy(() => import("./pages/admin/AdminSmsTemplates"));
const AdminWhatsAppTemplates = lazy(() => import("./pages/admin/AdminWhatsAppTemplates"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminSmsLogs = lazy(() => import("./pages/admin/AdminSmsLogs"));
const AdminWhatsAppLogs = lazy(() => import("./pages/admin/AdminWhatsAppLogs"));
const AdminRoles = lazy(() => import("./pages/admin/AdminRoles"));
const AdminAuditLog = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminMasterData = lazy(() => import("./pages/admin/AdminMasterData"));
const AdminTwoFactor = lazy(() => import("./pages/admin/AdminTwoFactor"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff"));

// Public tenant site + marketing
const SiteHome = lazy(() => import("./pages/site/SiteHome"));
const SiteAbout = lazy(() => import("./pages/site/SiteAbout"));
const SitePackages = lazy(() => import("./pages/site/SitePackages"));
const SiteContact = lazy(() => import("./pages/site/SiteContact"));
const SiteBlog = lazy(() => import("./pages/site/SiteBlog"));
const SitePricing = lazy(() => import("./pages/site/SitePricing"));
const Features = lazy(() => import("./pages/marketing/Features"));
const Modules = lazy(() => import("./pages/marketing/Modules"));
const Solutions = lazy(() => import("./pages/marketing/Solutions"));
const Pricing = lazy(() => import("./pages/marketing/Pricing"));
const Demo = lazy(() => import("./pages/marketing/Demo"));
const ContactUs = lazy(() => import("./pages/marketing/ContactUs"));
const FAQ = lazy(() => import("./pages/marketing/FAQ"));
const Privacy = lazy(() => import("./pages/marketing/Privacy"));
const Terms = lazy(() => import("./pages/marketing/Terms"));

// Heavier / less-common pages (already lazy before this cleanup)
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
const FlightReminders = lazy(() => import("./pages/FlightReminders"));

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
        <Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}>
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
          <Route path="/modules" element={<Modules />} />
          <Route path="/solutions" element={<Solutions />} />
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
          <Route path="/crm" element={<P><Crm /></P>} />
          <Route path="/complaints" element={<P><Complaints /></P>} />
          <Route path="/campaigns" element={<P><Campaigns /></P>} />
          <Route path="/crm-analytics" element={<P><CrmAnalytics /></P>} />
          <Route path="/crm-settings" element={<P><CrmSettings /></P>} />
          <Route path="/clients" element={<P><Clients /></P>} />
          <Route path="/clients/:id" element={<P><ClientProfile /></P>} />
          <Route path="/corporate" element={<P><CorporateTravel /></P>} />
          <Route path="/agents" element={<P><Agents /></P>} />
          <Route path="/agents/:id" element={<P><AgentProfile /></P>} />
          <Route path="/visa-stock" element={<P><VisaStock /></P>} />
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
          <Route path="/accounting" element={<PM module="accounts"><Accounting /></PM>} />
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
          <Route path="/branches" element={<PM module="branches"><Branches /></PM>} />
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
          <Route path="/website/seo" element={<PM module="website"><WebsiteSeo /></PM>} />
          <Route path="/settings/tax" element={<PM module="settings"><SettingsTax /></PM>} />
          <Route path="/financial-statements" element={<PM module="reports"><FinancialStatements /></PM>} />
          <Route path="/payroll" element={<PM module="team"><Payroll /></PM>} />
          <Route path="/loyalty" element={<PM module="clients"><Loyalty /></PM>} />
          <Route path="/referrals" element={<PM module="clients"><Referrals /></PM>} />
          <Route path="/sales-analytics" element={<PM module="reports"><SalesAnalytics /></PM>} />
          <Route path="/group-tours" element={<PM module="bookings"><GroupTours /></PM>} />
          <Route path="/mice" element={<PM module="bookings"><MiceEvents /></PM>} />
          <Route path="/travel-approvals" element={<PM module="bookings"><TravelApprovals /></PM>} />
          <Route path="/visa-tracker" element={<PM module="bookings"><VisaTracker /></PM>} />
          <Route path="/inventory" element={<PM module="bookings"><Inventory /></PM>} />
          <Route path="/recruitment" element={<PM module="team"><Recruitment /></PM>} />
          <Route path="/ticket-transactions" element={<PM module="bookings"><TicketTransactions /></PM>} />
          <Route path="/flight-reminders" element={<PM module="bookings"><FlightReminders /></PM>} />
          <Route path="/user-guide" element={<P><UserGuide /></P>} />

          <Route path="/admin" element={<A><AdminDashboard /></A>} />
          <Route path="/admin/landing-cms" element={<A><AdminLandingCMS /></A>} />
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
          <Route path="/admin/whatsapp-logs" element={<A><AdminWhatsAppLogs /></A>} />
          <Route path="/admin/audit-log" element={<A><AdminAuditLog /></A>} />
          <Route path="/admin/reports" element={<A><AdminReports /></A>} />
          <Route path="/admin/master-data" element={<A><AdminMasterData /></A>} />
          <Route path="/admin/two-factor" element={<A><AdminTwoFactor /></A>} />
          <Route path="/admin/staff" element={<A><AdminStaff /></A>} />

          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
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
