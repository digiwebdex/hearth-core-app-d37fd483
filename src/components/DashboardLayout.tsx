import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import TopNavbar from "@/components/TopNavbar";
import TrialBanner from "@/components/TrialBanner";
import ProductHelpBanner from "@/components/ProductHelpBanner";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <TopNavbar />
          <main className="flex-1 p-6 space-y-4">
            <TrialBanner />
            <ProductHelpBanner />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
