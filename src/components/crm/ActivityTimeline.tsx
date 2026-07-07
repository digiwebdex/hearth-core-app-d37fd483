import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useHumanError } from "@/hooks/useHumanError";
import { usePermissions } from "@/hooks/usePermissions";
import {
  crmActivityApi, type CrmActivity, type CrmActivityType, type CrmActivityEntityType,
} from "@/lib/api";
import {
  Phone, Mail, Users, MessageCircle, StickyNote, MapPin, CalendarClock,
  Pin, PinOff, Trash2, Send, Loader2, Smartphone,
} from "lucide-react";

/** Activity types offered in the composer (a "note" is just a text-only activity). */
const TYPE_META: { value: CrmActivityType; icon: typeof Phone }[] = [
  { value: "note", icon: StickyNote },
  { value: "call", icon: Phone },
  { value: "email", icon: Mail },
  { value: "meeting", icon: Users },
  { value: "whatsapp", icon: MessageCircle },
  { value: "sms", icon: Smartphone },
  { value: "visit", icon: MapPin },
  { value: "other", icon: StickyNote },
];

function iconFor(type: CrmActivityType) {
  return (TYPE_META.find((m) => m.value === type) || TYPE_META[0]).icon;
}

interface Props {
  entityType: CrmActivityEntityType;
  entityId: string;
}

export function ActivityTimeline({ entityType, entityId }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatError, errorTitle } = useHumanError();
  const { can } = usePermissions();
  const canCreate = can("clients", "create");
  const canDelete = can("clients", "delete");
  const showError = useCallback(
    (err: unknown) => toast({ variant: "destructive", title: errorTitle(), description: formatError(err) }),
    [toast, errorTitle, formatError],
  );

  const [items, setItems] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "note" | "activity">("all");
  const [type, setType] = useState<CrmActivityType>("note");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await crmActivityApi.list(entityType, entityId));
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, showError]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const created = await crmActivityApi.create({
        entityType, entityId, type, body: body.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      });
      setItems((prev) => [created, ...prev]);
      setBody("");
      setDueAt("");
      setType("note");
      toast({ title: t("crmActivity.added") });
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (item: CrmActivity) => {
    try {
      const updated = await crmActivityApi.update(item.id, { pinned: !item.pinned });
      setItems((prev) => [updated, ...prev.filter((i) => i.id !== item.id)]
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)));
    } catch (err) { showError(err); }
  };

  const remove = async (id: string) => {
    try {
      await crmActivityApi.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast({ title: t("crmActivity.deleted") });
    } catch (err) { showError(err); }
  };

  const filtered = items.filter((i) =>
    filter === "all" ? true : filter === "note" ? i.type === "note" : i.type !== "note");

  return (
    <div className="space-y-4">
      {/* Composer */}
      {canCreate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={type} onValueChange={(v) => setType(v as CrmActivityType)}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_META.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{t(`crmActivity.type.${m.value}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full"
                  aria-label={t("crmActivity.followUp")}
                />
              </div>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={type === "note" ? t("crmActivity.placeholderNote") : t("crmActivity.placeholderActivity")}
              rows={2}
            />
            <div className="flex justify-end">
              <Button onClick={handleAdd} disabled={saving || !body.trim()} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="ml-1.5">{t("crmActivity.add")}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-1.5">
        {(["all", "note", "activity"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {t(`crmActivity.filter.${f}`)}
          </Button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t("crmActivity.empty")}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const Icon = iconFor(item.type);
            return (
              <Card key={item.id} className={item.pinned ? "border-primary/40" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-muted p-2"><Icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="capitalize">{t(`crmActivity.type.${item.type}`)}</Badge>
                        {item.pinned && <Badge variant="outline" className="gap-1"><Pin className="h-3 w-3" />{t("crmActivity.pinned")}</Badge>}
                        {item.dueAt && (
                          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                            <CalendarClock className="h-3 w-3" />{new Date(item.dueAt).toLocaleString()}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">{item.body}</p>
                      {item.outcome && <p className="mt-1 text-xs text-muted-foreground">{item.outcome}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      {canCreate && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePin(item)} aria-label={item.pinned ? t("crmActivity.unpin") : t("crmActivity.pin")}>
                          {item.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={t("common.delete")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("crmActivity.deleteConfirmTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("crmActivity.deleteConfirmBody")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(item.id)}>{t("common.delete")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ActivityTimeline;
