import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { leadApi, type Lead, type LeadStatus } from "@/lib/api";
import { buildLeadQuotationParams, buildLeadBookingParams } from "@/lib/leadNavigation";
import {
  Target, Plus, Search, Filter, LayoutGrid, List, CalendarIcon,
  Phone, Mail, MapPin, Users, DollarSign, ArrowRight, Pencil, Trash2,
  Eye, UserPlus, ChevronDown, SortAsc, SortDesc, FileText, Plane,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadPipelineSummary } from "@/components/leads/LeadPipelineSummary";

const LEAD_STATUSES: { value: LeadStatus; color: string }[] = [
  { value: "new", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "contacted", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  { value: "qualified", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "quoted", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "won", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "lost", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const getStatusMeta = (status: LeadStatus) => LEAD_STATUSES.find((s) => s.value === status) || LEAD_STATUSES[0];

const LEAD_SOURCES = ["Facebook", "Google", "Referral", "Walk-in", "Phone", "Website", "WhatsApp", "Agent"];

const emptyForm = {
  name: "", phone: "", email: "", status: "new" as LeadStatus,
  source: "", destination: "", travelDateFrom: "", travelDateTo: "",
  travelerCount: 1, budget: 0, assignedTo: "", nextFollowUp: "", notes: "",
};

const Leads = () => {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"name" | "createdAt" | "budget">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const [travelFrom, setTravelFrom] = useState<Date | undefined>();
  const [travelTo, setTravelTo] = useState<Date | undefined>();
  const [pipelineNonce, setPipelineNonce] = useState(0);
  const bumpPipeline = () => setPipelineNonce((n) => n + 1);
  const navigate = useNavigate();

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await leadApi.list();
      setLeads(data);
      bumpPipeline();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const filtered = useMemo(() => {
    let result = leads.filter((l) => {
      const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.email?.toLowerCase().includes(search.toLowerCase()) ||
        l.phone?.includes(search) ||
        l.destination?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchSource = sourceFilter === "all" || (l.source || "").toLowerCase() === sourceFilter.toLowerCase();
      const matchDest = !destinationFilter || (l.destination || "").toLowerCase().includes(destinationFilter.toLowerCase());
      const matchDateFrom = !dateFrom || new Date(l.createdAt) >= dateFrom;
      const matchDateTo = !dateTo || new Date(l.createdAt) <= dateTo;
      return matchSearch && matchStatus && matchSource && matchDest && matchDateFrom && matchDateTo;
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "budget") cmp = (a.budget || 0) - (b.budget || 0);
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [leads, search, statusFilter, sourceFilter, destinationFilter, dateFrom, dateTo, sortField, sortDir]);

  const uniqueSources = useMemo(() => {
    const sources = new Set(leads.map((l) => l.source).filter(Boolean));
    return Array.from(sources) as string[];
  }, [leads]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sourceFilter !== "all") count++;
    if (destinationFilter) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [sourceFilter, destinationFilter, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    LEAD_STATUSES.forEach((s) => { counts[s.value] = leads.filter((l) => l.status === s.value).length; });
    return counts;
  }, [leads]);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFollowUpDate(undefined);
    setTravelFrom(undefined);
    setTravelTo(undefined);
    setDialogOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setForm({
      name: lead.name, phone: lead.phone || "", email: lead.email || "",
      status: lead.status || "new", source: lead.source || "",
      destination: lead.destination || "",
      travelDateFrom: lead.travelDateFrom || "", travelDateTo: lead.travelDateTo || "",
      travelerCount: lead.travelerCount || 1, budget: lead.budget || 0,
      assignedTo: lead.assignedTo || "", nextFollowUp: lead.nextFollowUp || "",
      notes: lead.notes || "",
    });
    setEditingId(lead.id);
    setFollowUpDate(lead.nextFollowUp ? new Date(lead.nextFollowUp) : undefined);
    setTravelFrom(lead.travelDateFrom ? new Date(lead.travelDateFrom) : undefined);
    setTravelTo(lead.travelDateTo ? new Date(lead.travelDateTo) : undefined);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      travelDateFrom: travelFrom ? format(travelFrom, "yyyy-MM-dd") : "",
      travelDateTo: travelTo ? format(travelTo, "yyyy-MM-dd") : "",
      nextFollowUp: followUpDate ? format(followUpDate, "yyyy-MM-dd") : "",
    };
    try {
      if (editingId) {
        const updated = await leadApi.update(editingId, payload);
        setLeads((p) => p.map((l) => (l.id === editingId ? { ...l, ...updated } : l)));
        bumpPipeline();
        toast({ title: t("leadsForm.leadUpdated") });
      } else {
        const created = await leadApi.create(payload as any);
        setLeads((p) => [created, ...p]);
        bumpPipeline();
        toast({ title: t("leadsForm.leadCreated") });
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: t("leadsForm.error"), description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await leadApi.delete(id);
      setLeads((p) => p.filter((l) => l.id !== id));
      toast({ title: t("leadsForm.leadDeleted") });
    } catch (err: any) {
      toast({ variant: "destructive", title: t("leadsForm.error"), description: err.message });
    }
  };

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    try {
      await leadApi.updateStatus(id, status);
      setLeads((p) => p.map((l) => (l.id === id ? { ...l, status } : l)));
      bumpPipeline();
      toast({ title: t("leadsForm.statusUpdated", { status: t(`leadsForm.statuses.${status}`) }) });
    } catch {
      setLeads((p) => p.map((l) => (l.id === id ? { ...l, status } : l)));
    }
  };

  const handleConvert = async (lead: Lead) => {
    try {
      await leadApi.convertToClient(lead.id);
      setLeads((p) => p.map((l) => (l.id === lead.id ? { ...l, status: "won" as LeadStatus } : l)));
      toast({ title: t("leadsForm.convertedTitle"), description: t("leadsForm.convertedDesc", { name: lead.name }) });
    } catch (err: any) {
      toast({ variant: "destructive", title: t("leadsForm.error"), description: err.message });
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = sortDir === "asc" ? SortAsc : SortDesc;

  // ── Kanban ──
  const KanbanView = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {LEAD_STATUSES.map((col) => {
        const items = filtered.filter((l) => l.status === col.value);
        return (
          <div key={col.value} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${col.color}`}>
                {t(`leadsForm.statuses.${col.value}`)}
              </span>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {items.map((lead) => (
                <Card key={lead.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/leads/${lead.id}`)}>
                  <CardContent className="p-3 space-y-1.5">
                    <p className="font-medium text-sm truncate">{lead.name}</p>
                    {lead.destination && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {lead.destination}
                      </div>
                    )}
                    {lead.budget ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <DollarSign className="h-3 w-3" /> ৳{lead.budget.toLocaleString()}
                      </div>
                    ) : null}
                    {lead.nextFollowUp && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" /> {lead.nextFollowUp}
                      </div>
                    )}
                    <PermissionGate module="leads" action="edit">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-full text-xs" onClick={(e) => e.stopPropagation()}>
                            {t("leadsForm.move")} <ChevronDown className="ml-1 h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {LEAD_STATUSES.filter((s) => s.value !== lead.status).map((s) => (
                            <DropdownMenuItem key={s.value} onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, s.value); }}>
                              <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium mr-2 ${s.color}`}>{t(`leadsForm.statuses.${s.value}`)}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </PermissionGate>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Table ──
  const TableView = () => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                {t("leadsForm.name")} {sortField === "name" && <SortIcon className="inline h-3 w-3 ml-1" />}
              </TableHead>
              <TableHead>{t("leadsForm.contact")}</TableHead>
              <TableHead>{t("leadsForm.destination")}</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("budget")}>
                {t("leadsForm.budget")} {sortField === "budget" && <SortIcon className="inline h-3 w-3 ml-1" />}
              </TableHead>
              <TableHead>{t("leadsForm.status")}</TableHead>
              <TableHead>{t("leadsForm.followUp")}</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("createdAt")}>
                {t("leadsForm.created")} {sortField === "createdAt" && <SortIcon className="inline h-3 w-3 ml-1" />}
              </TableHead>
              <TableHead className="w-[140px]">{t("leadsForm.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("leadsForm.noLeadsFound")}</TableCell></TableRow>
            ) : (
              filtered.map((lead) => {
                const meta = getStatusMeta(lead.status);
                return (
                  <TableRow key={lead.id} className="cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {lead.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</div>}
                        {lead.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{lead.destination || "—"}</TableCell>
                    <TableCell className="text-sm">{lead.budget ? `৳${lead.budget.toLocaleString()}` : "—"}</TableCell>
                    <TableCell>
                      <PermissionGate module="leads" action="edit" fallback={
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>{t(`leadsForm.statuses.${lead.status}`)}</span>
                      }>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer ${meta.color}`} onClick={(e) => e.stopPropagation()}>
                              {t(`leadsForm.statuses.${lead.status}`)} <ChevronDown className="ml-1 h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {LEAD_STATUSES.filter((s) => s.value !== lead.status).map((s) => (
                              <DropdownMenuItem key={s.value} onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, s.value); }}>
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium mr-2 ${s.color}`}>{t(`leadsForm.statuses.${s.value}`)}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </PermissionGate>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.nextFollowUp || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.createdAt?.slice(0, 10)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <PermissionGate module="quotations" action="create">
                          <Button variant="ghost" size="icon" title={t("leadsForm.createQuotation")} onClick={() => navigate(`/quotations/new?${buildLeadQuotationParams(lead).toString()}`)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate module="bookings" action="create">
                          <Button variant="ghost" size="icon" title={t("leadsForm.createBooking")} onClick={() => navigate(`/bookings?${buildLeadBookingParams(lead).toString()}`)}>
                            <Plane className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <Button variant="ghost" size="icon" title={t("leadsForm.view")} onClick={() => navigate(`/leads/${lead.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <PermissionGate module="leads" action="edit">
                          <Button variant="ghost" size="icon" title={t("leadsForm.edit")} onClick={() => openEdit(lead)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        {lead.status === "won" && (
                          <PermissionGate module="leads" action="approve">
                            <Button variant="ghost" size="icon" title={t("leadsForm.convertToClient")} onClick={() => handleConvert(lead)}>
                              <UserPlus className="h-4 w-4 text-green-600" />
                            </Button>
                          </PermissionGate>
                        )}
                        <PermissionGate module="leads" action="delete">
                          <Button variant="ghost" size="icon" title={t("leadsForm.delete")} onClick={() => handleDelete(lead.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  // ── Date Picker Helper ──
  const DatePick = ({ label, date, onChange }: { label: string; date?: Date; onChange: (d?: Date) => void }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : t("leadsForm.pickDate")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-8 w-8" /> {t("sidebar.leads")}
            </h1>
            <p className="text-muted-foreground">{t("pages.leadsSubtitle")}</p>
          </div>
          <PermissionGate module="leads" action="create">
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> {t("pages.newLead")}</Button>
          </PermissionGate>
        </div>

        {/* Status summary */}
        <div className="flex flex-wrap gap-2">
          <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>
            {t("leadsForm.all")} ({statusCounts.all})
          </Button>
          {LEAD_STATUSES.map((s) => (
            <Button key={s.value} variant={statusFilter === s.value ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s.value)}>
              {t(`leadsForm.statuses.${s.value}`)} ({statusCounts[s.value] || 0})
            </Button>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("leadsForm.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)} className="gap-1.5">
            <Filter className="h-4 w-4" /> {t("leadsForm.filters")}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">{activeFilterCount}</Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setSourceFilter("all"); setDestinationFilter(""); setDateFrom(undefined); setDateTo(undefined); }}>
              {t("leadsForm.clearFilters")}
            </Button>
          )}
        </div>

        {/* Advanced Filter Bar */}
        {showFilters && (
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t("leadsForm.source")}</Label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("leadsForm.allSources")}</SelectItem>
                      {(uniqueSources.length > 0 ? uniqueSources : LEAD_SOURCES).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("leadsForm.destination")}</Label>
                  <Input className="h-8 text-xs" placeholder={t("leadsForm.destinationPlaceholder")} value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("leadsForm.createdFrom")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-8 text-xs", !dateFrom && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {dateFrom ? format(dateFrom, "PP") : t("leadsForm.any")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("leadsForm.createdTo")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-8 text-xs", !dateTo && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {dateTo ? format(dateTo, "PP") : t("leadsForm.any")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <LoadingState rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchLeads} />
        ) : leads.length === 0 ? (
          <EmptyState icon={Target} title={t("leadsForm.noLeadsYet")} description={t("leadsForm.noLeadsDesc")} actionLabel={t("leadsForm.addLead")} onAction={openNew} />
        ) : (
          <>
          <LeadPipelineSummary refreshKey={pipelineNonce} />
          <Tabs defaultValue="kanban" className="space-y-4">
            <TabsList>
              <TabsTrigger value="kanban" className="gap-1.5"><LayoutGrid className="h-4 w-4" /> {t("leadsForm.kanban")}</TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5"><List className="h-4 w-4" /> {t("leadsForm.table")}</TabsTrigger>
            </TabsList>
            <TabsContent value="kanban"><KanbanView /></TabsContent>
            <TabsContent value="table"><TableView /></TabsContent>
          </Tabs>
          </>
        )}

        {/* Lead Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? t("leadsForm.editLead") : t("leadsForm.newLead")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("leadsForm.name")} *</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>{t("leadsForm.phone")}</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t("leadsForm.email")}</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t("leadsForm.status")}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as LeadStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{t(`leadsForm.statuses.${s.value}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("leadsForm.source")}</Label>
                  <Input placeholder={t("leadsForm.sourcePlaceholder")} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t("leadsForm.destination")}</Label>
                  <Input placeholder={t("leadsForm.destinationFormPlaceholder")} value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
                </div>
                <DatePick label={t("leadsForm.travelFrom")} date={travelFrom} onChange={setTravelFrom} />
                <DatePick label={t("leadsForm.travelTo")} date={travelTo} onChange={setTravelTo} />
                <div className="space-y-2">
                  <Label>{t("leadsForm.travelers")}</Label>
                  <Input type="number" min={1} value={form.travelerCount} onChange={(e) => setForm((f) => ({ ...f, travelerCount: +e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t("leadsForm.budgetBdt")}</Label>
                  <Input type="number" min={0} value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: +e.target.value }))} />
                </div>
                <DatePick label={t("leadsForm.nextFollowUp")} date={followUpDate} onChange={setFollowUpDate} />
              </div>
              <div className="space-y-2">
                <Label>{t("leadsForm.notes")}</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">{editingId ? t("leadsForm.updateLead") : t("leadsForm.createLead")}</Button>
                <DialogClose asChild><Button variant="outline">{t("leadsForm.cancel")}</Button></DialogClose>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Leads;
