import { useState } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import AdminConfigNotice from "@/components/admin/AdminConfigNotice";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Save, Loader2, Eye, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_PERMISSIONS,
  ROLE_METADATA,
  MODULE_METADATA,
  ALL_ACTIONS_LIST,
  getRoleMeta,
  type AppRole,
  type Module,
  type Action,
  type PermissionMatrix,
} from "@/lib/permissions";

const ALL_ROLES: AppRole[] = ["super_admin", "tenant_owner", "manager", "sales_agent", "accountant", "operations"];

const AdminRoles = () => {
  const [permOverrides, setPermOverrides] = useState<Record<AppRole, PermissionMatrix>>(
    JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS))
  );
  const [saving, setSaving] = useState(false);
  const [viewRole, setViewRole] = useState<AppRole | null>(null);
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  const text = {
    title: isBn ? "রোল ও পারমিশন ম্যানেজমেন্ট" : "Role & Permission Management",
    subtitle: isBn ? "সব মডিউলে প্রতিটি রোলের পারমিশন কনফিগার করুন" : "Configure permissions for each role across all modules",
    saveAll: isBn ? "সব পরিবর্তন সংরক্ষণ করুন" : "Save All Changes",
    permissions: isBn ? "পারমিশন" : "permissions",
    view: isBn ? "দেখুন" : "View",
    reset: isBn ? "রিসেট" : "Reset",
    permissionEditor: isBn ? "পারমিশন এডিটর" : "Permission Editor",
    fullPermissionView: isBn ? "পূর্ণ পারমিশন ভিউ" : "Full Permission View",
    module: isBn ? "মডিউল" : "Module",
    close: isBn ? "বন্ধ করুন" : "Close",
    saveSuccess: isBn ? "পারমিশন কনফিগারেশন সংরক্ষিত হয়েছে" : "Permission configuration saved",
    saveDesc: isBn ? "পরিবর্তন সব টেন্যান্টে প্রযোজ্য হবে।" : "Changes will apply to all tenants.",
  };

  const roleLabelMap: Record<AppRole, string> = {
    super_admin: isBn ? "সুপার অ্যাডমিন" : "Super Admin",
    tenant_owner: isBn ? "টেন্যান্ট ওনার" : "Tenant Owner",
    manager: isBn ? "ম্যানেজার" : "Manager",
    sales_agent: isBn ? "সেলস এজেন্ট" : "Sales Agent",
    accountant: isBn ? "অ্যাকাউন্ট্যান্ট" : "Accountant",
    operations: isBn ? "অপারেশনস" : "Operations",
  };

  const roleDescriptionMap: Record<AppRole, string> = {
    super_admin: isBn ? "পুরো প্ল্যাটফর্মের সম্পূর্ণ নিয়ন্ত্রণ।" : "Complete control over the entire platform.",
    tenant_owner: isBn ? "টেন্যান্টের সেটিংস, টিম ও সাবস্ক্রিপশন পরিচালনা করতে পারে।" : "Can manage tenant settings, team, and subscription.",
    manager: isBn ? "দৈনন্দিন অপারেশন ও অধিকাংশ ব্যবসায়িক কাজ পরিচালনা করে।" : "Manages day-to-day operations and most business workflows.",
    sales_agent: isBn ? "লিড, ক্লায়েন্ট ও সেলস কাজ সামলায়।" : "Handles leads, clients, and sales tasks.",
    accountant: isBn ? "ইনভয়েস, পেমেন্ট ও আর্থিক রেকর্ড সামলায়।" : "Handles invoices, payments, and financial records.",
    operations: isBn ? "বুকিং, সার্ভিস ডেলিভারি ও ফলো-আপ সামলায়।" : "Handles bookings, service delivery, and follow-up.",
  };

  const moduleLabelMap: Partial<Record<Module, string>> = {
    dashboard: isBn ? "ড্যাশবোর্ড" : "Dashboard",
    clients: isBn ? "ক্লায়েন্ট" : "Clients",
    agents: isBn ? "এজেন্ট" : "Agents",
    vendors: isBn ? "ভেন্ডর" : "Vendors",
    leads: isBn ? "লিড" : "Leads",
    tasks: isBn ? "টাস্ক" : "Tasks",
    quotations: isBn ? "কোটেশন" : "Quotations",
    bookings: isBn ? "বুকিং" : "Bookings",
    invoices: isBn ? "ইনভয়েস" : "Invoices",
    accounts: isBn ? "অ্যাকাউন্টস" : "Accounts",
    reports: isBn ? "রিপোর্ট" : "Reports",
    subscription: isBn ? "সাবস্ক্রিপশন" : "Subscription",
    team: isBn ? "টিম" : "Team",
    organization: isBn ? "অর্গানাইজেশন" : "Organization",
    settings: isBn ? "সেটিংস" : "Settings",
    website: isBn ? "ওয়েবসাইট" : "Website",
    admin_panel: isBn ? "অ্যাডমিন প্যানেল" : "Admin Panel",
  };

  const actionLabelMap: Record<Action, string> = {
    view: isBn ? "দেখুন" : "View",
    create: isBn ? "তৈরি" : "Create",
    edit: isBn ? "এডিট" : "Edit",
    delete: isBn ? "মুছুন" : "Delete",
    approve: isBn ? "অনুমোদন" : "Approve",
    export: isBn ? "এক্সপোর্ট" : "Export",
  };

  const categoryLabel = (value: string) => {
    const map: Record<string, string> = {
      core: isBn ? "মূল" : "Core",
      sales: isBn ? "সেলস" : "Sales",
      finance: isBn ? "ফাইন্যান্স" : "Finance",
      admin: isBn ? "অ্যাডমিন" : "Admin",
      setup: isBn ? "সেটআপ" : "Setup",
      operations: isBn ? "অপারেশনস" : "Operations",
      reporting: isBn ? "রিপোর্টিং" : "Reporting",
      communication: isBn ? "কমিউনিকেশন" : "Communication",
    };
    return map[value] || value;
  };

  const togglePerm = (role: AppRole, module: Module, action: Action) => {
    if (role === "super_admin") return;
    setPermOverrides((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [module]: {
          ...prev[role]?.[module],
          [action]: !prev[role]?.[module]?.[action],
        },
      },
    }));
  };

  const resetRole = (role: AppRole) => {
    setPermOverrides((prev) => ({
      ...prev,
      [role]: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS[role])),
    }));
    toast({ title: `${roleLabelMap[role]} ${isBn ? "পারমিশন ডিফল্টে রিসেট হয়েছে" : "permissions reset to defaults"}` });
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 300));
    setSaving(false);
    toast({
      title: isBn ? "প্রিভিউ মোড" : "Preview mode",
      description: isBn ? "লাইভ পারমিশন ম্যাট্রিক্স src/lib/permissions.ts ফাইলে পরিচালিত হয়।" : "Live permission matrix is managed in src/lib/permissions.ts.",
    });
  };

  const countPerms = (role: AppRole) => {
    let total = 0;
    const perms = permOverrides[role];
    if (!perms) return 0;
    for (const mod of Object.values(perms)) {
      for (const val of Object.values(mod)) {
        if (val) total++;
      }
    }
    return total;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminConfigNotice sourceFile="src/lib/permissions.ts" />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8" /> {text.title}
            </h1>
            <p className="text-muted-foreground">{text.subtitle}</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {text.saveAll}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_METADATA.map((role) => (
            <Card key={role.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${role.color}`}>
                      {roleLabelMap[role.id]}
                    </span>
                    <p className="text-xs text-muted-foreground">{roleDescriptionMap[role.id]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{countPerms(role.id)}</p>
                    <p className="text-[10px] text-muted-foreground">{text.permissions}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setViewRole(role.id)}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> {text.view}
                  </Button>
                  {role.id !== "super_admin" && (
                    <Button variant="ghost" size="sm" onClick={() => resetRole(role.id)}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> {text.reset}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="tenant_owner" className="space-y-4">
          <TabsList className="flex-wrap">
            {ALL_ROLES.filter((r) => r !== "super_admin").map((r) => {
              const meta = getRoleMeta(r);
              return (
                <TabsTrigger key={r} value={r} className="gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: "currentColor" }} />
                  {roleLabelMap[meta.id]}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {ALL_ROLES.filter((r) => r !== "super_admin").map((role) => (
            <TabsContent key={role} value={role}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleMeta(role).color}`}>
                      {roleLabelMap[role]}
                    </span>
                    {text.permissionEditor}
                  </CardTitle>
                  <CardDescription>{roleDescriptionMap[role]}</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">{text.module}</TableHead>
                        {ALL_ACTIONS_LIST.map((a) => (
                          <TableHead key={a} className="text-center text-xs min-w-[70px]">{actionLabelMap[a]}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MODULE_METADATA.filter((m) => m.id !== "admin_panel").map((mod) => {
                        const perms = permOverrides[role]?.[mod.id as Module] || {};
                        return (
                          <TableRow key={mod.id}>
                            <TableCell>
                              <p className="font-medium text-sm">{moduleLabelMap[mod.id as Module] || mod.label}</p>
                              <p className="text-[10px] text-muted-foreground">{categoryLabel(mod.category)}</p>
                            </TableCell>
                            {ALL_ACTIONS_LIST.map((action) => (
                              <TableCell key={action} className="text-center">
                                <div className="flex justify-center">
                                  <Switch
                                    checked={perms[action] ?? false}
                                    onCheckedChange={() => togglePerm(role, mod.id as Module, action)}
                                  />
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <Dialog open={!!viewRole} onOpenChange={(open) => { if (!open) setViewRole(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {viewRole && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleMeta(viewRole).color}`}>
                      {roleLabelMap[viewRole]}
                    </span>
                    {text.fullPermissionView}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground mb-4">{roleDescriptionMap[viewRole]}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{text.module}</TableHead>
                      {ALL_ACTIONS_LIST.map((a) => (
                        <TableHead key={a} className="text-center text-xs">{actionLabelMap[a]}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MODULE_METADATA.map((mod) => {
                      const perms = permOverrides[viewRole]?.[mod.id as Module] || {};
                      return (
                        <TableRow key={mod.id}>
                          <TableCell className="font-medium text-sm">{moduleLabelMap[mod.id as Module] || mod.label}</TableCell>
                          {ALL_ACTIONS_LIST.map((action) => (
                            <TableCell key={action} className="text-center">
                              {perms[action] ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">✓</span>
                              ) : (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/30 text-xs">✗</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <DialogClose asChild><Button variant="outline" className="w-full mt-4">{text.close}</Button></DialogClose>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRoles;
