import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Plus, Pencil, Trash2, ShieldCheck, Phone, Mail, Eye, EyeOff, RefreshCw } from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  permissions: string[];
  createdAt: string;
  updatedAt?: string;
}

interface PermissionOption {
  key: string;
  label: string;
}

const API = import.meta.env.VITE_API_URL || "/api";

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

const EMPTY_FORM = { name: "", email: "", phone: "", password: "", permissions: [] as string[] };

export default function AdminStaff() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [permOptions, setPermOptions] = useState<PermissionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [staffRes, metaRes] = await Promise.all([
        apiFetch("/admin/platform-staff"),
        apiFetch("/admin/platform-staff/meta/permissions"),
      ]);
      setStaff(staffRes.staff || []);
      setPermOptions(metaRes.permissions || []);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowPw(false);
    setDialogOpen(true);
  }

  function openEdit(s: StaffMember) {
    setEditTarget(s);
    setForm({ name: s.name, email: s.email, phone: s.phone || "", password: "", permissions: s.permissions || [] });
    setShowPw(false);
    setDialogOpen(true);
  }

  function togglePerm(key: string) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter((p) => p !== key) : [...f.permissions, key],
    }));
  }

  async function save() {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" }); return;
    }
    if (!editTarget && form.password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const body: Record<string, any> = { name: form.name, phone: form.phone, permissions: form.permissions };
      if (!editTarget) { body.email = form.email; body.password = form.password; }
      else if (form.password) { body.password = form.password; }

      if (editTarget) {
        await apiFetch(`/admin/platform-staff/${editTarget.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast({ title: "Staff updated" });
      } else {
        await apiFetch("/admin/platform-staff", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Staff account created" });
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(s: StaffMember) {
    try {
      await apiFetch(`/admin/platform-staff/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: s.status === "active" ? "inactive" : "active" }),
      });
      toast({ title: s.status === "active" ? "Account deactivated" : "Account activated" });
      load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/admin/platform-staff/${deleteTarget.id}`, { method: "DELETE" });
      toast({ title: "Staff account deleted" });
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const activeCount = staff.filter((s) => s.status === "active").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" /> Platform Staff
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Internal team accounts for managing agencies & subscriptions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Staff</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Staff</p>
              <p className="text-2xl font-bold">{staff.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold text-muted-foreground">{staff.length - activeCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Staff list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Loading...</div>
            ) : staff.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No staff accounts yet.</p>
                <Button className="mt-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add First Staff</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {staff.map((s) => (
                  <div key={s.id} className="flex items-start justify-between rounded-lg border p-4 gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{s.name}</span>
                        <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-xs">
                          {s.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                          <ShieldCheck className="h-3 w-3 mr-1" /> Platform Staff
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {s.email}
                        </span>
                        {s.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {s.phone}
                          </span>
                        )}
                      </div>
                      {s.permissions?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.permissions.map((p) => {
                            const opt = permOptions.find((o) => o.key === p);
                            return (
                              <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {opt?.label.split("—")[0].trim() || p}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Added {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(s)} className="text-xs">
                        {s.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(s)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Staff Account" : "Add Platform Staff"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Rahim Ahmed" />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} disabled={!!editTarget} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="staff@agency.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="017XXXXXXXX" />
              </div>
              <div className="space-y-1.5">
                <Label>{editTarget ? "New Password (leave blank to keep)" : "Password *"}</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={editTarget ? "Leave blank to keep" : "Min 8 characters"}
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-2 text-muted-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="rounded-lg border p-3 grid grid-cols-1 gap-2">
                {permOptions.map((opt) => (
                  <div key={opt.key} className="flex items-center gap-2">
                    <Checkbox
                      id={opt.key}
                      checked={form.permissions.includes(opt.key)}
                      onCheckedChange={() => togglePerm(opt.key)}
                    />
                    <label htmlFor={opt.key} className="text-sm cursor-pointer">{opt.label}</label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Staff can only access sections you enable here. Settings, Plans & Features are always restricted to super admin.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editTarget ? "Save Changes" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff account?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) will lose all admin access immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
