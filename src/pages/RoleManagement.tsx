import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield, UserCog, Eye, Pencil, Save, Loader2, Search, Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { tenantApi, type User } from "@/lib/api";
import {
  DEFAULT_PERMISSIONS,
  mapLegacyRole,
  ROLE_METADATA,
  MODULE_METADATA,
  ALL_ACTIONS_LIST,
  ACTION_LABELS,
  getTenantRoles,
  getRoleMeta,
  type AppRole,
  type Module,
  type Action,
  type PermissionMatrix,
} from "@/lib/permissions";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: "active" | "invited" | "suspended";
  joinedAt: string;
}

function toTeamMember(user: User): TeamMember {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: mapLegacyRole(user.role),
    status: "active",
    joinedAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—",
  };
}

const RoleManagement = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState<AppRole>("sales_agent");
  const [permViewOpen, setPermViewOpen] = useState(false);
  const [viewRole, setViewRole] = useState<AppRole>("sales_agent");
  const { toast } = useToast();
  const { canManageTeam } = usePermissions();

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await tenantApi.getMembers();
      setMembers(data.map(toTeamMember));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load team";
      toast({ title: "Failed to load team", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const tenantRoles = getTenantRoles();

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "all" || m.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [members, search, roleFilter]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => { counts[m.role] = (counts[m.role] || 0) + 1; });
    return counts;
  }, [members]);

  const handleChangeRole = async () => {
    if (!selectedMember) return;
    setSavingRole(true);
    try {
      const updated = await tenantApi.updateMember(selectedMember.id, { role: newRole });
      setMembers((prev) => prev.map((m) => (m.id === selectedMember.id ? toTeamMember(updated) : m)));
      toast({ title: "Role updated", description: `${selectedMember.name} is now ${getRoleMeta(newRole).label}` });
      setChangeRoleOpen(false);
      setSelectedMember(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update role";
      toast({ title: "Failed to update role", description: message, variant: "destructive" });
    } finally {
      setSavingRole(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      invited: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status] || ""}`}>{status}</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" /> Role Management
          </h1>
          <p className="text-muted-foreground">Manage team member roles and view permission matrix</p>
        </div>

        {/* Role summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {tenantRoles.map((role) => (
            <Card key={role.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setViewRole(role.id); setPermViewOpen(true); }}>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${role.color}`}>
                      {role.label}
                    </span>
                    <span className="text-2xl font-bold">{roleCounts[role.id] || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{role.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="members" className="space-y-4">
          <TabsList>
            <TabsTrigger value="members" className="gap-1.5"><Users className="h-4 w-4" /> Team Members</TabsTrigger>
            <TabsTrigger value="matrix" className="gap-1.5"><Shield className="h-4 w-4" /> Permission Matrix</TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter by role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {tenantRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Team Members ({filtered.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      {canManageTeam && <TableHead className="w-[120px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canManageTeam ? 6 : 5} className="text-center text-muted-foreground py-8">
                          No team members found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((m) => {
                        const meta = getRoleMeta(m.role);
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.name}</TableCell>
                            <TableCell className="text-muted-foreground">{m.email}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                                {meta.label}
                              </span>
                            </TableCell>
                            <TableCell>{statusBadge(m.status)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{m.joinedAt}</TableCell>
                            {canManageTeam && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" title="View permissions" onClick={() => { setViewRole(m.role); setPermViewOpen(true); }}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" title="Change role" onClick={() => { setSelectedMember(m); setNewRole(m.role); setChangeRoleOpen(true); }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permission Matrix Tab */}
          <TabsContent value="matrix">
            <Card>
              <CardHeader>
                <CardTitle>Permission Matrix</CardTitle>
                <CardDescription>Overview of what each role can do across all modules</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background min-w-[160px]">Module / Action</TableHead>
                      {tenantRoles.map((r) => (
                        <TableHead key={r.id} className="text-center min-w-[100px]">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${r.color}`}>
                            {r.label}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MODULE_METADATA.filter((m) => m.id !== "admin_panel").map((mod) => (
                      <TableRow key={mod.id}>
                        <TableCell className="sticky left-0 bg-background">
                          <div>
                            <p className="font-medium text-sm">{mod.label}</p>
                            <div className="flex gap-1 mt-0.5">
                              {ALL_ACTIONS_LIST.map((action) => {
                                const anyHas = tenantRoles.some((r) => DEFAULT_PERMISSIONS[r.id]?.[mod.id]?.[action]);
                                if (!anyHas) return null;
                                return (
                                  <span key={action} className="text-[9px] text-muted-foreground uppercase">{action.charAt(0)}</span>
                                );
                              })}
                            </div>
                          </div>
                        </TableCell>
                        {tenantRoles.map((role) => {
                          const perms = DEFAULT_PERMISSIONS[role.id]?.[mod.id as Module] || {};
                          const enabledActions = ALL_ACTIONS_LIST.filter((a) => perms[a]);
                          return (
                            <TableCell key={role.id} className="text-center">
                              {enabledActions.length === 0 ? (
                                <span className="text-muted-foreground/30">—</span>
                              ) : enabledActions.length === ALL_ACTIONS_LIST.length ? (
                                <Badge variant="secondary" className="text-[10px]">Full</Badge>
                              ) : (
                                <div className="flex flex-wrap justify-center gap-0.5">
                                  {enabledActions.map((a) => (
                                    <span key={a} className="inline-block rounded bg-primary/10 text-primary px-1 py-0 text-[9px] font-medium uppercase">
                                      {a.charAt(0) + a.slice(1, 3)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Change Role Dialog */}
        <Dialog open={changeRoleOpen} onOpenChange={(open) => { setChangeRoleOpen(open); if (!open) setSelectedMember(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Change Role</DialogTitle></DialogHeader>
            {selectedMember && (
              <div className="space-y-4">
                <div className="rounded-md border p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Member:</span>
                    <span className="font-medium">{selectedMember.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Role:</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleMeta(selectedMember.role).color}`}>
                      {getRoleMeta(selectedMember.role).label}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>New Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tenantRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${r.color}`}>{r.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newRole && (
                    <p className="text-xs text-muted-foreground">{getRoleMeta(newRole).description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleChangeRole} disabled={savingRole}>
                    {savingRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Update Role
                  </Button>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View Permissions Dialog */}
        <Dialog open={permViewOpen} onOpenChange={setPermViewOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleMeta(viewRole).color}`}>
                  {getRoleMeta(viewRole).label}
                </span>
                Permissions
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">{getRoleMeta(viewRole).description}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  {ALL_ACTIONS_LIST.map((a) => (
                    <TableHead key={a} className="text-center text-xs">{ACTION_LABELS[a]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODULE_METADATA.filter((m) => m.id !== "admin_panel").map((mod) => {
                  const perms = DEFAULT_PERMISSIONS[viewRole]?.[mod.id as Module] || {};
                  return (
                    <TableRow key={mod.id}>
                      <TableCell className="font-medium text-sm">{mod.label}</TableCell>
                      {ALL_ACTIONS_LIST.map((action) => (
                        <TableCell key={action} className="text-center">
                          {perms[action] ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">✓</span>
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/30">✗</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <DialogClose asChild><Button variant="outline" className="w-full mt-4">Close</Button></DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default RoleManagement;
