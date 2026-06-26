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
import { FileText, Plus, Pencil, Trash2, Search, Eye, Edit2 } from "lucide-react";

function renderMarkdown(text: string): string {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    const h3 = line.match(/^### (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    const h1 = line.match(/^# (.+)$/);
    const li = line.match(/^[-*] (.+)$/);

    if (h1 || h2 || h3) {
      if (inList) { out.push("</ul>"); inList = false; }
      const tag = h1 ? "h1" : h2 ? "h2" : "h3";
      const content = (h1 || h2 || h3)![1];
      out.push(`<${tag} class="font-bold mt-4 mb-1 ${tag === "h1" ? "text-2xl" : tag === "h2" ? "text-xl" : "text-lg"}">${inline(content)}</${tag}>`);
    } else if (li) {
      if (!inList) { out.push("<ul class=\"list-disc pl-6 my-2\">"); inList = true; }
      out.push(`<li>${inline(li[1])}</li>`);
    } else if (line === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("<br/>");
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p class="mb-2">${inline(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class=\"bg-muted px-1 rounded text-sm font-mono\">$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noreferrer\" class=\"text-primary underline\">$1</a>");
}

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
  const [bodyPreview, setBodyPreview] = useState(false);

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
    setBodyPreview(false);
    setDialogOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setBodyPreview(false);
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
                <div className="flex items-center justify-between">
                  <Label>{t("blog.fieldBody")}</Label>
                  <div className="flex items-center border rounded-md overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setBodyPreview(false)}
                      className={`flex items-center gap-1 px-2 py-1 transition-colors ${!bodyPreview ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      <Edit2 className="h-3 w-3" /> Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setBodyPreview(true)}
                      className={`flex items-center gap-1 px-2 py-1 transition-colors ${bodyPreview ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                  </div>
                </div>
                {bodyPreview ? (
                  <div
                    className="min-h-[200px] rounded-md border bg-muted/30 px-3 py-2 text-sm prose prose-neutral dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(form.body) || "<span class='text-muted-foreground'>Nothing to preview</span>" }}
                  />
                ) : (
                  <Textarea
                    rows={8}
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder={"# Heading\n\nWrite your post body here. Supports **bold**, *italic*, `code`, [links](https://...), and - lists."}
                  />
                )}
                <p className="text-xs text-muted-foreground">Supports Markdown: **bold**, *italic*, # headings, - lists, [link](url)</p>
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
