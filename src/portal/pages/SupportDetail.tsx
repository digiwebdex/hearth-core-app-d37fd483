import { useState, useRef, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Send } from "lucide-react";
import { portalApi, type PortalSupportTicket } from "@/lib/portalApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function SupportDetail() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Poll every 5s for a live-chat feel (reuses the ticket messages thread).
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-ticket", id],
    queryFn: () => portalApi.supportTicket(id),
    refetchInterval: 5000,
  });

  const send = useMutation({
    mutationFn: () => portalApi.replySupportTicket(id, reply.trim()),
    onSuccess: (updated: PortalSupportTicket) => { qc.setQueryData(["portal-ticket", id], updated); setReply(""); },
  });

  const messages = data?.messages || [];
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  return (
    <div className="space-y-4 max-w-2xl">
      <Link to="/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("portal.backToSupport", { defaultValue: "Back to support" })}
      </Link>

      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {isLoading && !data ? (
        <Skeleton className="h-96 w-full" />
      ) : data ? (
        <Card className="flex flex-col">
          <div className="border-b p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="font-semibold truncate">{data.subject}</h1>
              <p className="text-xs text-muted-foreground">{data.ticketNumber}</p>
            </div>
            <Badge variant={data.status === "open" ? "default" : "outline"} className="capitalize">{data.status.replace(/_/g, " ")}</Badge>
          </div>

          <CardContent className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
            {data.description && messages.length === 0 && (
              <p className="text-sm text-muted-foreground">{data.description}</p>
            )}
            {messages.map((m, i) => {
              const mine = m.authorType === "customer";
              return (
                <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {mine ? t("portal.you", { defaultValue: "You" }) : (m.author || t("portal.agency", { defaultValue: "Agency" }))} · {new Date(m.at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </CardContent>

          <form
            onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send.mutate(); }}
            className="border-t p-3 flex items-center gap-2"
          >
            <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("portal.typeMessage", { defaultValue: "Type a message…" })} />
            <Button type="submit" size="icon" disabled={send.isPending || !reply.trim()}><Send className="h-4 w-4" /></Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
