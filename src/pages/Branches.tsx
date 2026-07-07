import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, Trash2, RefreshCw, Star, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { branchApi, type Branch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { getLimitLabel } from "@/lib/plans";

type BranchForm = Pick<Branch, "name" | "code" | "address" | "city" | "phone" | "email">;
const emptyForm: BranchForm = { name: "", code: "", address: "", city: "", phone: "", email: "" };

const Branches = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { currentPlan } = useAuth();
  const { can } = usePermissions();
  const { maxBranches, isUnlimitedBranches } = usePlanAccess(currentPlan);

  const canCreate = can("branches", "create");
  const canEdit = can("branches", "edit");
  const canDelete = can("branches", "delete");
  const atLimit = !isUnlimitedBranches && branches.length >= maxBranches;

  const fetchBranches = async () => {
    setLoading(true);
    try {
      setBranches(await branchApi.list());
    } catch (err) {
      toast({ title: "Failed to load branches", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBranches(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (b: Branch) => {
    setForm({ name: b.name, code: b.code || "", address: b.address || "", city: b.city || "", phone: b.phone || "", email: b.email || "" });
    setEditingId(b.id);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await branchApi.update(editingId, form);
        toast({ title: "Branch updated" });
      } else {
        await branchApi.create(form as unknown as Omit<Branch, "id" | "tenantId" | "createdAt">);
        toast({ title: "Branch created" });
      }
      setDialogOpen(false);
      fetchBranches();
    } catch (err) {
      toast({ title: "Failed to save branch", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await branchApi.setPrimary(id);
      toast({ title: "Primary branch updated" });
      fetchBranches();
    } catch (err) {
      toast({ title: "Failed to set primary", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (b: Branch) => {
    if (b.isPrimary) {
      toast({ title: "Cannot delete the primary branch", description: "Set another branch as primary first.", variant: "destructive" });
      return;
    }
    try {
      await branchApi.delete(b.id);
      toast({ title: "Branch removed" });
      fetchBranches();
    } catch (err) {
      toast({ title: "Failed to remove", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-7 w-7 text-primary" /> Branches
            </h1>
            <p className="text-muted-foreground">
              Offices / branches — {branches.length} of {getLimitLabel(maxBranches)} used
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchBranches} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            {canCreate && (
              <Button onClick={openCreate} disabled={atLimit} title={atLimit ? "Branch limit reached — upgrade or buy an add-on" : undefined}>
                <Plus className="mr-2 h-4 w-4" /> Add Branch
              </Button>
            )}
          </div>
        </div>

        {atLimit && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-200">
            You've reached your plan's branch limit ({getLimitLabel(maxBranches)}). Upgrade your plan or purchase an additional-branch add-on to add more.
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Branches</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : branches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No branches yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="text-center">Staff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[130px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        {b.name}
                        {b.isPrimary && <Badge variant="secondary" className="text-[10px]"><Star className="h-3 w-3 mr-1" />Primary</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.code || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.city || "—"}</TableCell>
                      <TableCell className="text-center text-sm">{b._count?.users ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={b.isActive ? "secondary" : "outline"}>{b.isActive ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canEdit && !b.isPrimary && (
                            <Button variant="ghost" size="icon" onClick={() => handleSetPrimary(b.id)} title="Set as primary">
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(b)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && !b.isPrimary && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(b)} title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Branch" : "Add Branch"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Branch Name <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Dhaka Head Office" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="HO" />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Dhaka" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save Changes" : "Create Branch"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Branches;
