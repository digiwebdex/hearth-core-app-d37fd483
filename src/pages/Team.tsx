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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Trash2, RefreshCw, Copy, Check, KeyRound, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tenantApi, type User } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getRoleMeta } from "@/lib/permissions";

interface CreatedMember {
  name: string;
  email: string;
  role: string;
  temporaryPassword?: string;
  message?: string;
}

const Team = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("sales_agent");
  const [inviting, setInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdMember, setCreatedMember] = useState<CreatedMember | null>(null);
  const [credDialogOpen, setCredDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { canManageTeam } = usePermissions();

  const loginUrl = `${window.location.protocol}//${window.location.host}/login`;

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
      const res = await tenantApi.inviteMember(inviteEmail, inviteRole, inviteName || undefined) as unknown as CreatedMember & { temporaryPassword?: string; message?: string };
      const added: CreatedMember = {
        name: inviteName || inviteEmail.split("@")[0],
        email: inviteEmail,
        role: inviteRole,
        temporaryPassword: res.temporaryPassword,
        message: res.message,
      };
      setCreatedMember(added);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("sales_agent");
      setDialogOpen(false);
      setCredDialogOpen(true);
      fetchMembers();
    } catch (err: any) {
      toast({ title: "Failed to add member", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const copyCredentials = () => {
    if (!createdMember) return;
    const text = [
      `Staff Login Details`,
      `───────────────────`,
      `Login URL: ${loginUrl}`,
      `Email: ${createdMember.email}`,
      createdMember.temporaryPassword ? `Password: ${createdMember.temporaryPassword}` : `Password: (sent via email)`,
      `Role: ${createdMember.role}`,
      ``,
      `Please change your password after first login.`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

        {/* Credentials dialog shown after creating a member */}
        <Dialog open={credDialogOpen} onOpenChange={setCredDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Staff Account Created
              </DialogTitle>
            </DialogHeader>
            {createdMember && (
              <div className="space-y-4">
                {createdMember.temporaryPassword ? (
                  <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                    <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs">
                      <strong>SMTP not configured.</strong> Share this one-time password securely — it won't be shown again.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-green-300 bg-green-50 dark:bg-green-950/20">
                    <AlertDescription className="text-green-800 dark:text-green-200 text-xs">
                      A password setup link has been emailed to the staff member.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="rounded-xl border bg-muted/40 p-4 space-y-3 font-mono text-sm">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">Login URL</span>
                    <span className="text-right break-all text-primary text-xs flex items-center gap-1">
                      <Globe className="h-3 w-3 shrink-0" />{loginUrl}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">Email</span>
                    <span className="font-medium">{createdMember.email}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">Password</span>
                    {createdMember.temporaryPassword ? (
                      <span className="font-bold tracking-widest text-base">{createdMember.temporaryPassword}</span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">sent via email</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">Role</span>
                    <span className="capitalize">{createdMember.role.replace("_", " ")}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={copyCredentials} variant="outline" className="flex-1">
                    {copied ? <><Check className="mr-2 h-4 w-4 text-green-600" />Copied!</> : <><Copy className="mr-2 h-4 w-4" />Copy Login Details</>}
                  </Button>
                  <Button onClick={() => setCredDialogOpen(false)} className="flex-1">Done</Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">Ask the staff to change their password after first login via Settings → Change Password.</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
                      <Label>Full Name</Label>
                      <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Staff full name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address <span className="text-red-500">*</span></Label>
                      <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="staff@youragency.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager — full access except billing</SelectItem>
                          <SelectItem value="sales_agent">Sales Agent — bookings, clients, leads</SelectItem>
                          <SelectItem value="accountant">Accountant — invoices, payments, reports</SelectItem>
                          <SelectItem value="operations">Operations — bookings, packages, vendors</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">How login works:</p>
                      <p>• <strong>If SMTP is set up:</strong> The staff receives a password setup link by email.</p>
                      <p>• <strong>If SMTP is not set up:</strong> You will receive a temporary password here to share manually.</p>
                      <p>• Staff log in at the same URL as you using their email + password.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={inviting}>
                        {inviting ? "Creating account..." : "Create Staff Account"}
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