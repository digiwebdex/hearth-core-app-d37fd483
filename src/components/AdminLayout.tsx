import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AdminNotificationBell from "@/components/AdminNotificationBell";
import { applyAdminBilingualization } from "@/lib/adminBilingual";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "A";

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const language = String(i18n.resolvedLanguage || i18n.language || "en");
    let frame = 0;

    const run = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => applyAdminBilingualization(root, language));
    };

    run();

    const observer = new MutationObserver(() => run());
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [children, i18n.language, i18n.resolvedLanguage]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div ref={contentRef} className="flex-1 flex flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-card px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <AdminNotificationBell />
              <span className="text-sm text-muted-foreground hidden sm:inline">{user?.name}</span>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-destructive text-destructive-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
