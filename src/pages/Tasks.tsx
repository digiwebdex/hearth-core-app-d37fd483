import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ListTodo, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { taskApi, type Task } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { Badge } from "@/components/ui/badge";

type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high" | "urgent";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

const emptyForm = { title: "", description: "", status: "todo" as TaskStatus, priority: "medium" as TaskPriority, dueDate: "", assignedTo: "" };

const statusColors: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  done: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

const priorityColors: Record<TaskPriority, string> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
  urgent: "destructive",
};

const Tasks = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<Task[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await taskApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const updated = await taskApi.update(editingId, form);
        setItems((prev) => prev.map((tk) => tk.id === editingId ? updated : tk));
        toast({ title: t("tasksPage.updatedToast") });
      } else {
        const created = await taskApi.create(form);
        setItems((prev) => [created, ...prev]);
        toast({ title: t("tasksPage.createdToast") });
      }
      resetForm();
      setDialogOpen(false);
    } catch (err) {
      toast({ title: t("tasksPage.saveFailed"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const handleEdit = (tk: Task) => {
    setForm({ title: tk.title, description: tk.description, status: tk.status, priority: tk.priority, dueDate: tk.dueDate || "", assignedTo: tk.assignedTo || "" });
    setEditingId(tk.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await taskApi.delete(id);
      setItems((prev) => prev.filter((tk) => tk.id !== id));
      toast({ title: t("tasksPage.deletedToast"), variant: "destructive" });
    } catch (err) {
      toast({ title: t("tasksPage.saveFailed"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("sidebar.tasks")}</h1>
            <p className="text-muted-foreground">{t("pages.tasksSubtitle")}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />{t("pages.newTask")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? t("common.edit") : t("common.new")} {t("sidebar.tasks")}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("tasksPage.fTitle")}</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>{t("tasksPage.fDescription")}</Label>
                  <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("tasksPage.fStatus")}</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`tasksPage.status.${s}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("tasksPage.fPriority")}</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TaskPriority }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`tasksPage.priority.${p}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("tasksPage.fDueDate")}</Label>
                    <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("tasksPage.fAssignee")}</Label>
                    <Input value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} placeholder={t("tasksPage.fAssigneePlaceholder")} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">{editingId ? t("tasksPage.update") : t("tasksPage.create")}</Button>
                  <DialogClose asChild><Button type="button" variant="outline">{t("common.cancel")}</Button></DialogClose>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <LoadingState rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchTasks} />
        ) : items.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={ListTodo}
                title={t("tasksPage.emptyTitle")}
                description={t("tasksPage.emptyDesc")}
                actionLabel={t("pages.newTask")}
                onAction={() => setDialogOpen(true)}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ListTodo className="h-5 w-5" />{t("sidebar.tasks")} ({items.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tasksPage.colTitle")}</TableHead>
                    <TableHead>{t("tasksPage.colStatus")}</TableHead>
                    <TableHead>{t("tasksPage.colPriority")}</TableHead>
                    <TableHead>{t("tasksPage.colLinked")}</TableHead>
                    <TableHead>{t("tasksPage.colDue")}</TableHead>
                    <TableHead className="w-[100px]">{t("tasksPage.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((tk) => (
                    <TableRow key={tk.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tk.title}</p>
                          {tk.description && <p className="text-xs text-muted-foreground">{tk.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[tk.status as TaskStatus] || statusColors.todo}`}>
                          {t(`tasksPage.status.${tk.status}`, tk.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityColors[tk.priority as TaskPriority] as "outline" | "secondary" | "destructive"} className="text-xs">
                          {t(`tasksPage.priority.${tk.priority}`, tk.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tk.relatedType ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Link2 className="h-3 w-3" />{t(`tasksPage.related.${tk.relatedType}`, tk.relatedType)}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {tk.dueDate ? new Date(tk.dueDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(tk)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(tk.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

export default Tasks;
