import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { UserPlus, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tenantApi, type User } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getRoleMeta } from "@/lib/permissions";

const Team = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("sales_agent");
  const [inviting, setInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { canManageTeam } = usePermissions();

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await tenantApi.getMembers();
      setMembers(data);
    } catch (err: any) {
      toast({ title: "Failed to load team", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      await tenantApi.inviteMember(inviteEmail, inviteRole, inviteName || undefined);
      toast({ title: "Member added", description: `${inviteEmail} has been added to the team.` });
      setInviteEmail("");
      setInviteName("");
      setInviteRole("sales_agent");
      setDialogOpen(false);
      fetchMembers();
    } catch (err: any) {
      toast({ title: "Failed to add member", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    setUpdatingRoleId(memberId);
    try {
      const updated = await tenantApi.updateMember(memberId, { role });
      setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
      toast({ title: "Role updated" });
    } catch (err: any) {
      toast({ title: "Failed to update role", description: err.message, variant: "destructive" });
      fetchMembers();
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (memberId === user?.id) {
      toast({ title: "Can't remove yourself", variant: "destructive" });
      return;
    }
    try {
      await tenantApi.removeMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast({ title: "Member removed" });
    } catch (err: any) {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("pages.teamTitle")}</h1>
            <p className="text-muted-foreground">{t("pages.teamSubtitle")} ({members.length})</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchMembers} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("common.refresh")}
            </Button>
            {canManageTeam && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button><UserPlus className="mr-2 h-4 w-4" />{t("pages.addMember")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("pages.addMember")}</DialogTitle></DialogHeader>
                  <form onSubmit={handleInvite} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="user@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="sales_agent">Sales Agent</SelectItem>
                          <SelectItem value="accountant">Accountant</SelectItem>
                          <SelectItem value="operations">Operations</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A password setup link is emailed when SMTP is configured. Otherwise you receive a one-time temporary password after adding the member.
                    </p>
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={inviting}>
                        {inviting ? "Adding..." : "Add Member"}
                      </Button>
                      <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Members</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : members.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No team members found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    {canManageTeam && <TableHead className="w-[80px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const roleMeta = getRoleMeta(m.role as any);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                        <TableCell>
                          {canManageTeam && m.id !== user?.id && m.role !== "tenant_owner" && m.role !== "owner" && m.role !== "admin" ? (
                            <Select
                              value={m.role}
                              disabled={updatingRoleId === m.id}
                              onValueChange={(value) => handleRoleChange(m.id, value)}
                            >
                              <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="sales_agent">Sales Agent</SelectItem>
                                <SelectItem value="accountant">Accountant</SelectItem>
                                <SelectItem value="operations">Operations</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary" style={{ backgroundColor: roleMeta.color + "20", color: roleMeta.color }}>
                              {roleMeta.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</TableCell>
                        {canManageTeam && (
                          <TableCell>
                            {m.id !== user?.id && m.role !== "tenant_owner" && (
                              <Button variant="ghost" size="icon" onClick={() => handleRemove(m.id)} title="Remove member">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Team;