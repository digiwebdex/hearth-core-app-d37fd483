import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import type { LucideIcon } from "lucide-react";
import type { Module } from "@/lib/permissions";

interface EntityRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface CrudPageProps {
  title: string;
  icon: LucideIcon;
  module?: Module;
  api?: {
    list: () => Promise<any[]>;
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    delete: (id: string) => Promise<void>;
  };
}

const CrudPage = ({ title, icon: Icon, module, api }: CrudPageProps) => {
  const [items, setItems] = useState<EntityRecord[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(!!api);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const singular = title.slice(0, -1);

  const fetchData = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.list();
      setItems(data);
    } catch (err: any) {
      setError(err.message || `Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [api, title]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setForm({ name: "", phone: "", email: "" });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        if (api) {
          await api.update(editingId, form);
        }
        setItems((prev) =>
          prev.map((item) => (item.id === editingId ? { ...item, ...form } : item))
        );
        toast({ title: `${singular} updated` });
      } else {
        if (api) {
          const created = await api.create(form);
          setItems((prev) => [...prev, created]);
        } else {
          setItems((prev) => [...prev, { id: crypto.randomUUID(), ...form }]);
        }
        toast({ title: `${singular} created` });
      }
      resetForm();
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: `Failed to save ${singular.toLowerCase()}`, description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: EntityRecord) => {
    setForm({ name: item.name, phone: item.phone, email: item.email });
    setEditingId(item.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      if (api) await api.delete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast({ title: `${singular} deleted`, variant: "destructive" });
    } catch (err: any) {
      toast({ title: `Failed to delete`, description: err.message, variant: "destructive" });
    }
  };

  const addButton = (
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add {singular}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit" : "Add"} {singular}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Update" : "Create"}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">Manage your {title.toLowerCase()}</p>
          </div>
          {module ? <PermissionGate module={module} action="create">{addButton}</PermissionGate> : addButton}
        </div>

        {loading ? (
          <LoadingState rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : items.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={Icon}
                title={`No ${title.toLowerCase()} yet`}
                description={`Add your first ${singular.toLowerCase()} to get started. Click the button above or below.`}
                actionLabel={module ? undefined : `Add ${singular}`}
                onAction={module ? undefined : () => setDialogOpen(true)}
              />
              {module && (
                <div className="mt-6 flex justify-center">
                  <PermissionGate module={module} action="create">
                    <Button onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add {singular}
                    </Button>
                  </PermissionGate>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5" />
                {title} List ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.phone}</TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {module ? (
                            <PermissionGate module={module} action="edit">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {module ? (
                            <PermissionGate module={module} action="delete">
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </PermissionGate>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CrudPage;