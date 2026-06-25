import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { leadApi, taskApi, quotationApi, type Lead, type LeadActivity, type LeadStatus, type Quotation } from "@/lib/api";
import { buildLeadQuotationParams, buildLeadBookingParams } from "@/lib/leadNavigation";
import { WorkflowNextStep } from "@/components/WorkflowNextStep";
import { InlineEmpty } from "@/components/EmptyState";
import { useHumanError } from "@/hooks/useHumanError";
import {
  ArrowLeft, Phone, Mail, MapPin, CalendarIcon, Users, DollarSign, UserPlus,
  MessageSquare, Clock, ArrowRight, RefreshCw, Send, FileText, CheckSquare,
  AlertTriangle, ExternalLink, Plane,
} from "lucide-react";

const LEAD_STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: "new", label: "New", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "contacted", label: "Contacted", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  { value: "qualified", label: "Qualified", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "quoted", label: "Quoted", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "won", label: "Won", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const getStatusMeta = (s: LeadStatus) => LEAD_STATUSES.find((x) => x.value === s) || LEAD_STATUSES[0];

const ACTIVITY_TYPES = [
  { value: "note", label: "Note", icon: MessageSquare },
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "follow_up", label: "Follow-up", icon: Clock },
];

const activityIcon = (type: string) => {
  const found = ACTIVITY_TYPES.find((t) => t.value === type);
  return found ? found.icon : MessageSquare;
};

const QUOTATION_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  expired: "bg-muted text-muted-foreground",
};

const LeadDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activityType, setActivityType] = useState("note");
  const [activityContent, setActivityContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [duplicateClient, setDuplicateClient] = useState<{ exists: boolean; client?: any } | null>(null);
  const [converting, setConverting] = useState(false);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const [followUpNote, setFollowUpNote] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatError, errorTitle } = useHumanError();

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [leadData, actData, quotData] = await Promise.all([
        leadApi.get(id),
        leadApi.getActivities(id).catch(() => []),
        leadApi.getQuotations(id).catch(() => []),
      ]);
      setLead(leadData);
      setActivities(actData);
      setQuotations(quotData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (status: LeadStatus) => {
    if (!lead) return;
    try {
      await leadApi.updateStatus(lead.id, status);
      setLead((p) => p ? { ...p, status } : p);
      setActivities((prev) => [
        { id: `temp-${Date.now()}`, leadId: lead.id, type: "status_change", content: `Status changed to ${getStatusMeta(status).label}`, oldStatus: lead.status, newStatus: status, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      toast({ title: `Status updated to ${getStatusMeta(status).label}` });
    } catch {
      setLead((p) => p ? { ...p, status } : p);
    }
  };

  const handleAddActivity = async () => {
    if (!lead || !activityContent.trim()) return;
    setSubmitting(true);
    try {
      const created = await leadApi.addActivity(lead.id, { type: activityType, content: activityContent });
      setActivities((prev) => [created, ...prev]);
      setActivityContent("");
      toast({ title: "Activity added" });
    } catch {
      setActivities((prev) => [
        { id: `local-${Date.now()}`, leadId: lead!.id, type: activityType as LeadActivity["type"], content: activityContent, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      setActivityContent("");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Convert to Client with duplicate check ──
  const handleConvertClick = async () => {
    if (!lead) return;
    const dup = await leadApi.checkDuplicateClient(lead.email || "", lead.phone || "");
    setDuplicateClient(dup);
    setConvertDialogOpen(true);
  };

  const handleConfirmConvert = async () => {
    if (!lead) return;
    setConverting(true);
    try {
      await leadApi.convertToClient(lead.id);
      toast({ title: "Lead converted to client!", description: `${lead.name} is now a client.` });
      navigate("/clients");
    } catch (err: any) {
      toast({ variant: "destructive", title: errorTitle(), description: formatError(err) });
    } finally {
      setConverting(false);
      setConvertDialogOpen(false);
    }
  };

  // ── Create Quotation ──
  const handleCreateQuotation = () => {
    if (!lead) return;
    navigate(`/quotations/new?${buildLeadQuotationParams(lead).toString()}`);
  };

  const handleCreateBooking = () => {
    if (!lead) return;
    navigate(`/bookings?${buildLeadBookingParams(lead).toString()}`);
  };

  const handleConvertQuotation = async (quotation: Quotation, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const booking = await quotationApi.convertToBooking(quotation.id);
      toast({ title: "Booking created from quotation" });
      navigate(`/bookings/${booking.id}`);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Could not convert quotation",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // ── Schedule Follow-up Task ──
  const handleCreateFollowUp = async () => {
    if (!lead || !followUpDate) return;
    setCreatingTask(true);
    try {
      await taskApi.create({
        title: `Follow up with ${lead.name}`,
        description: followUpNote || `Follow-up for lead: ${lead.name}${lead.destination ? ` — ${lead.destination}` : ""}`,
        status: "todo",
        priority: "medium",
        dueDate: format(followUpDate, "yyyy-MM-dd"),
      } as any);
      const followUpIso = format(followUpDate, "yyyy-MM-dd");
      const updatedLead = await leadApi.update(lead.id, { nextFollowUp: followUpIso });
      setLead(updatedLead);
      // Also add activity
      const act = await leadApi.addActivity(lead.id, {
        type: "follow_up",
        content: `Follow-up scheduled for ${format(followUpDate, "PPP")}${followUpNote ? `: ${followUpNote}` : ""}`,
      }).catch(() => ({
        id: `local-${Date.now()}`, leadId: lead.id, type: "follow_up" as const, content: `Follow-up scheduled for ${format(followUpDate, "PPP")}`, createdAt: new Date().toISOString(),
      }));
      setActivities((prev) => [act, ...prev]);
      toast({ title: "Follow-up task created", description: `Scheduled for ${format(followUpDate, "PPP")}` });
      setFollowUpDialogOpen(false);
      setFollowUpDate(undefined);
      setFollowUpNote("");
    } catch (err: any) {
      toast({ variant: "destructive", title: errorTitle(), description: formatError(err) });
    } finally {
      setCreatingTask(false);
    }
  };

  if (loading) return <DashboardLayout><LoadingState rows={8} /></DashboardLayout>;
  if (error || !lead) return <DashboardLayout><ErrorState message={error || "Lead not found"} onRetry={fetchData} /></DashboardLayout>;

  const statusMeta = getStatusMeta(lead.status);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <WorkflowNextStep
          current="lead"
          next="client"
          nextLabel="Convert to client"
          onNextClick={handleConvertClick}
        />

        {/* Back + Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/leads")} className="mb-1">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Leads
            </Button>
            <h1 className="text-2xl font-bold">{lead.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.color}`}>
                {statusMeta.label}
              </span>
              {lead.source && <Badge variant="outline">{lead.source}</Badge>}
              <span className="text-xs text-muted-foreground">Created {lead.createdAt?.slice(0, 10)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PermissionGate module="leads" action="edit">
              <Select value={lead.status} onValueChange={(v) => handleStatusChange(v as LeadStatus)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </PermissionGate>
            <PermissionGate module="quotations" action="create">
              <Button variant="outline" onClick={handleCreateQuotation}>
                <FileText className="mr-2 h-4 w-4" /> Create Quotation
              </Button>
            </PermissionGate>
            <PermissionGate module="bookings" action="create">
              <Button variant="outline" onClick={handleCreateBooking}>
                <Plane className="mr-2 h-4 w-4" /> Create Booking
              </Button>
            </PermissionGate>
            <PermissionGate module="leads" action="edit">
              <Button variant="outline" onClick={() => setFollowUpDialogOpen(true)}>
                <CheckSquare className="mr-2 h-4 w-4" /> Schedule Follow-up
              </Button>
            </PermissionGate>
            {lead.status === "won" && (
              <PermissionGate module="leads" action="approve">
                <Button onClick={handleConvertClick}><UserPlus className="mr-2 h-4 w-4" /> Convert to Client</Button>
              </PermissionGate>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Details */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Contact Info</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lead.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {lead.phone}</div>}
                {lead.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {lead.email}</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Trip Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lead.destination && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {lead.destination}</div>}
                {(lead.travelDateFrom || lead.travelDateTo) && (
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    {lead.travelDateFrom || "?"} → {lead.travelDateTo || "?"}
                  </div>
                )}
                {lead.travelerCount && <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> {lead.travelerCount} travelers</div>}
                {lead.budget ? <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /> ৳{lead.budget.toLocaleString()}</div> : null}
              </CardContent>
            </Card>

            {lead.nextFollowUp && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Next Follow-up</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" /> {lead.nextFollowUp}
                  </div>
                </CardContent>
              </Card>
            )}

            {lead.notes && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p></CardContent>
              </Card>
            )}

            {/* Linked Quotations */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Quotations ({quotations.length})</CardTitle>
                  <PermissionGate module="quotations" action="create">
                    <Button variant="ghost" size="sm" onClick={handleCreateQuotation}>
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  </PermissionGate>
                </div>
              </CardHeader>
              <CardContent>
                {quotations.length === 0 ? (
                  <InlineEmpty title={t("emptyStates.noQuotationsLinked")} hint={t("emptyStates.noQuotationsHint")} />
                ) : (
                  <div className="space-y-2">
                    {quotations.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between p-2 rounded border cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => navigate(`/quotations/${q.id}`)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{q.title || q.destination}</p>
                          <p className="text-xs text-muted-foreground">৳{q.grandTotal?.toLocaleString()} • v{q.version}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${QUOTATION_STATUS_COLORS[q.status] || "bg-muted text-muted-foreground"}`}>
                            {q.status}
                          </span>
                          {q.status === "approved" && (
                            <PermissionGate module="quotations" action="approve">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => handleConvertQuotation(q, e)}
                              >
                                Book
                              </Button>
                            </PermissionGate>
                          )}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Pipeline */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Pipeline</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {LEAD_STATUSES.map((s, i) => {
                    const isActive = s.value === lead.status;
                    const isPast = LEAD_STATUSES.findIndex((x) => x.value === lead.status) > i;
                    return (
                      <div key={s.value} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${isActive ? s.color + " font-medium" : isPast ? "text-muted-foreground line-through" : "text-muted-foreground/50"}`}>
                        <div className={`h-2 w-2 rounded-full ${isActive ? "bg-current" : isPast ? "bg-muted-foreground/40" : "bg-muted"}`} />
                        {s.label}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Activity Timeline */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Add Activity</CardTitle></CardHeader>
              <CardContent>
                <PermissionGate module="leads" action="edit" fallback={<p className="text-sm text-muted-foreground">You don't have permission to add activities.</p>}>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {ACTIVITY_TYPES.map((t) => (
                        <Button key={t.value} variant={activityType === t.value ? "default" : "outline"} size="sm" onClick={() => setActivityType(t.value)}>
                          <t.icon className="mr-1 h-3.5 w-3.5" /> {t.label}
                        </Button>
                      ))}
                    </div>
                    <Textarea placeholder="Write a note, log a call, record a meeting..." value={activityContent} onChange={(e) => setActivityContent(e.target.value)} rows={3} />
                    <Button onClick={handleAddActivity} disabled={!activityContent.trim() || submitting}>
                      <Send className="mr-2 h-4 w-4" /> {submitting ? "Saving..." : "Add Activity"}
                    </Button>
                  </div>
                </PermissionGate>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Activity Timeline ({activities.length})</CardTitle>
                  <Button variant="ghost" size="sm" onClick={fetchData}><RefreshCw className="h-3.5 w-3.5" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <InlineEmpty title={t("emptyStates.noActivities")} hint={t("emptyStates.noActivitiesHint")} />
                ) : (
                  <div className="space-y-0">
                    {activities.map((act, i) => {
                      const Icon = activityIcon(act.type);
                      const isStatusChange = act.type === "status_change";
                      return (
                        <div key={act.id} className="flex gap-3 pb-4 relative">
                          {i < activities.length - 1 && (
                            <div className="absolute left-[15px] top-[30px] bottom-0 w-px bg-border" />
                          )}
                          <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${isStatusChange ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {isStatusChange ? <ArrowRight className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium capitalize">{act.type.replace("_", " ")}</span>
                              {act.createdByName && <span className="text-xs text-muted-foreground">by {act.createdByName}</span>}
                              <span className="text-xs text-muted-foreground">{act.createdAt?.slice(0, 16).replace("T", " ")}</span>
                            </div>
                            {isStatusChange && act.oldStatus && act.newStatus ? (
                              <div className="flex items-center gap-1 mt-1 text-xs">
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${getStatusMeta(act.oldStatus).color}`}>{getStatusMeta(act.oldStatus).label}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${getStatusMeta(act.newStatus).color}`}>{getStatusMeta(act.newStatus).label}</span>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{act.content}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Convert to Client Dialog with duplicate check */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert Lead to Client</DialogTitle>
          </DialogHeader>
          {duplicateClient?.exists ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Duplicate client detected</p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    A client with matching contact information already exists:
                    <strong className="block mt-1">{duplicateClient.client?.name}</strong>
                    {duplicateClient.client?.email && <span className="block text-xs">{duplicateClient.client.email}</span>}
                    {duplicateClient.client?.phone && <span className="block text-xs">{duplicateClient.client.phone}</span>}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setConvertDialogOpen(false);
                  if (duplicateClient.client?.id) navigate(`/clients/${duplicateClient.client.id}`);
                }}>
                  View Existing Client
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will create a new client record for <strong>{lead?.name}</strong> and mark the lead as Won. All contact details will be copied to the client profile.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleConfirmConvert} disabled={converting}>
                  <UserPlus className="mr-2 h-4 w-4" /> {converting ? "Converting..." : "Confirm & Convert"}
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule Follow-up Dialog */}
      <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Follow-up Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !followUpDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {followUpDate ? format(followUpDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={followUpDate} onSelect={setFollowUpDate} initialFocus className="p-3 pointer-events-auto" disabled={(d) => d < new Date()} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea placeholder="Discuss pricing, send updated itinerary..." value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleCreateFollowUp} disabled={!followUpDate || creatingTask}>
                <CheckSquare className="mr-2 h-4 w-4" /> {creatingTask ? "Creating..." : "Create Task"}
              </Button>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default LeadDetails;
