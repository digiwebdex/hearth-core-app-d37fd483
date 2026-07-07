import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LifeBuoy, Plus, ChevronRight } from "lucide-react";
import { portalApi } from "@/lib/portalApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "../lib/format";

export default function Support() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });

  const { data, isLoading } = useQuery({ queryKey: ["portal-tickets"], queryFn: portalApi.supportTickets });

  const create = useMutation({
    mutationFn: () => portalApi.createSupportTicket({ subject: form.subject.trim(), message: form.message.trim() }),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ["portal-tickets"] });
      setOpen(false); setForm({ subject: "", message: "" });
      toast({ title: t("portal.ticketCreated", { defaultValue: "Ticket submitted" }) });
      navigate(`/support/${ticket.id}`);
    },
    onError: (e: Error) => toast({ title: t("portal.ticketFailed", { defaultValue: "Could not submit" }), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><LifeBuoy className="h-6 w-6" /> {t("portal.support", { defaultValue: "Support" })}</h1>
          <p className="text-sm text-muted-foreground">{t("portal.supportHint", { defaultValue: "Get help from your travel agency." })}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("portal.newTicket", { defaultValue: "New ticket" })}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("portal.newTicket", { defaultValue: "New ticket" })}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (form.subject.trim()) create.mutate(); }} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("portal.subject", { defaultValue: "Subject" })} <span className="text-red-500">*</span></Label>
                <Input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t("portal.message", { defaultValue: "Message" })}</Label>
                <Textarea rows={4} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">{t("common.cancel", { defaultValue: "Cancel" })}</Button></DialogClose>
                <Button type="submit" disabled={create.isPending || !form.subject.trim()}>{create.isPending ? t("common.saving", { defaultValue: "Saving…" }) : t("portal.submit", { defaultValue: "Submit" })}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : data && data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("portal.noTickets", { defaultValue: "No support tickets yet." })}</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {data?.map((tk) => (
            <Link key={tk.id} to={`/support/${tk.id}`} className="block group">
              <Card className="transition-colors group-hover:border-primary/50">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{tk.subject}</div>
                    <div className="text-xs text-muted-foreground">{tk.ticketNumber} · {formatDate(tk.updatedAt)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={tk.status === "open" ? "default" : "outline"} className="capitalize">{tk.status.replace(/_/g, " ")}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
