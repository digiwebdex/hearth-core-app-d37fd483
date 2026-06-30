import { LayoutDashboard, Building2, CreditCard, Crown, Ban, LogOut, ArrowLeft, Globe, ListChecks, Settings, Shield, MessageSquare, ScrollText, UserCog, FileText, BarChart3, UserPlus, Database, MessageCircle, Tag, Layout, ShieldCheck, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const adminItems = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Landing Page CMS", url: "/admin/landing-cms", icon: Layout },
  { title: "Agencies", url: "/admin/tenants", icon: Building2 },
  { title: "Master Data", url: "/admin/master-data", icon: Database },
  { title: "Pending Signups", url: "/admin/pending-users", icon: UserPlus },
  { title: "Domains", url: "/admin/domains", icon: Globe },
  { title: "Payment Requests", url: "/admin/payments", icon: CreditCard },
  { title: "Manage Plans", url: "/admin/plans", icon: Crown },
  { title: "Subscriptions", url: "/admin/subscriptions", icon: ListChecks },
  { title: "Feature Control", url: "/admin/features", icon: Shield },
  { title: "Roles & Permissions", url: "/admin/roles", icon: UserCog },
  { title: "SMS Templates", url: "/admin/sms-templates", icon: MessageSquare },
  { title: "WhatsApp Templates", url: "/admin/whatsapp-templates", icon: MessageCircle },
  { title: "Coupons", url: "/admin/coupons", icon: Tag },
  { title: "SMS Logs", url: "/admin/sms-logs", icon: ScrollText },
  { title: "WhatsApp Logs", url: "/admin/whatsapp-logs", icon: MessageCircle },
  { title: "Audit Log", url: "/admin/audit-log", icon: FileText },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
  { title: "Two-Factor Auth", url: "/admin/two-factor", icon: ShieldCheck },
  { title: "Platform Staff", url: "/admin/staff", icon: Users },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-3 py-3">
          {!collapsed && (
            <div className="space-y-1">
              <span className="text-sm font-bold tracking-tight text-destructive">Admin Panel</span>
              <Link to="/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" />
                Back to App
              </Link>
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed ? "Administration" : ""}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && user && (
          <div className="px-3 pb-1">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Logout"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
