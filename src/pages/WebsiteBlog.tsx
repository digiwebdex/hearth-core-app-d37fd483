import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { blogApi, type BlogPost } from "@/lib/api";
import { FileText, Plus, Pencil, Trash2, Search } from "lucide-react";

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverImage: "",
  authorName: "",
  status: "draft" as "draft" | "published",
};

const WebsiteBlog = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await blogApi.list();
      setPosts(data);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("blog.loadFailed"),
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search) return posts;
    const q = search.toLowerCase();
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q),
    );
  }, [posts, search]);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || "",
      body: post.body || "",
      coverImage: post.coverImage || "",
      authorName: post.authorName || "",
      status: post.status,
    });
    setEditingId(post.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        coverImage: form.coverImage.trim() || null,
        authorName: form.authorName.trim() || null,
        slug: form.slug.trim() || undefined,
      };
      if (editingId) {
        const updated = await blogApi.update(editingId, payload);
        setPosts((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        toast({ title: t("blog.updated") });
      } else {
        const created = await blogApi.create(payload);
        setPosts((prev) => [created, ...prev]);
        toast({ title: t("blog.created") });
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("blog.saveFailed"),
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await blogApi.delete(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      toast({ title: t("blog.deleted") });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("blog.deleteFailed"),
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-7 w-7" />
              {t("blog.title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("blog.subtitle")}</p>
          </div>
          <PermissionGate module="website" action="create">
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              {t("blog.newPost")}
            </Button>
          </PermissionGate>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("blog.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("blog.emptyTitle")}
            description={t("blog.emptyDesc")}
            action={
              <PermissionGate module="website" action="create">
                <Button onClick={openNew}>{t("blog.newPost")}</Button>
              </PermissionGate>
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("blog.colTitle")}</TableHead>
                    <TableHead>{t("blog.colStatus")}</TableHead>
                    <TableHead>{t("blog.colPublished")}</TableHead>
                    <TableHead className="text-right">{t("blog.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="font-medium">{post.title}</div>
                        <div className="text-xs text-muted-foreground">/{post.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={post.status === "published" ? "default" : "secondary"}>
                          {post.status === "published" ? t("blog.published") : t("blog.draft")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {post.publishedAt
                          ? format(new Date(post.publishedAt), "PP")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <PermissionGate module="website" action="edit">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(post)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate module="website" action="delete">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(post.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? t("blog.editPost") : t("blog.newPost")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("blog.fieldTitle")} *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("blog.fieldSlug")}</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder={t("blog.slugHint")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("blog.fieldStatus")}</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v: "draft" | "published") => setForm((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t("blog.draft")}</SelectItem>
                      <SelectItem value="published">{t("blog.published")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("blog.fieldExcerpt")}</Label>
                <Textarea
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("blog.fieldBody")}</Label>
                <Textarea
                  rows={8}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("blog.fieldCover")}</Label>
                  <Input
                    value={form.coverImage}
                    onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("blog.fieldAuthor")}</Label>
                  <Input
                    value={form.authorName}
                    onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {editingId ? t("blog.save") : t("blog.create")}
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    {t("blog.cancel")}
                  </Button>
                </DialogClose>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default WebsiteBlog;
