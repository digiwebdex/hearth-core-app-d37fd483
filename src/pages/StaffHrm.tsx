import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingState from "@/components/LoadingState";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleMeta, mapLegacyRole } from "@/lib/permissions";
import {
  hrmApi,
  type StaffMemberRow,
  type StaffAttendanceRow,
  type StaffLeaveRow,
  type AttendanceStatus,
  type LeaveType,
} from "@/lib/api";
import {
  CalendarClock, UserCircle, Plus, Save, Users, CheckCircle2,
  XCircle, Clock, UserX, Wifi, Calendar, ArrowRight, Banknote,
  ChevronDown, ChevronUp,
} from "lucide-react";

const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "Present", color: "bg-green-100 text-green-800" },
  { value: "absent", label: "Absent", color: "bg-red-100 text-red-800" },
  { value: "half_day", label: "Half Day", color: "bg-yellow-100 text-yellow-800" },
  { value: "remote", label: "Remote", color: "bg-blue-100 text-blue-800" },
  { value: "on_leave", label: "On Leave", color: "bg-purple-100 text-purple-800" },
];

const LEAVE_TYPES: LeaveType[] = ["annual", "sick", "unpaid", "other"];

function leaveDays(start: string, end: string): number {
  try {
    return Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(start)) + 1);
  } catch {
    return 0;
  }
}

function AttStatusBadge({ status }: { status: AttendanceStatus }) {
  const meta = ATTENDANCE_STATUSES.find((s) => s.value === status);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta?.color || "bg-muted text-muted-foreground"}`}>{meta?.label || status}</span>;
}

const StaffHrm = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { can, isManager, isTenantOwner, isSuperAdmin } = usePermissions();
  const isHrmManager = isManager || isTenantOwner || isSuperAdmin;
  const canEditTeam = can("team", "edit");
  const [tab, setTab] = useState("profiles");
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<StaffMemberRow[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [attendance, setAttendance] = useState<StaffAttendanceRow[]>([]);
  const [leaveRows, setLeaveRows] = useState<StaffLeaveRow[]>([]);
  const [leaveFilter, setLeaveFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Profile edit
  const [editMember, setEditMember] = useState<StaffMemberRow | null>(null);
  const [profileForm, setProfileForm] = useState({
    jobTitle: "", department: "", joinDate: "",
    emergencyContact: "", emergencyPhone: "", notes: "",
  });

  // Attendance expand
  const [expandedAttRow, setExpandedAttRow] = useState<string | null>(null);
  const [attTimeForm, setAttTimeForm] = useState<Record<string, { checkIn: string; checkOut: string; notes: string }>>({});

  // Leave
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveType: "annual" as LeaveType, startDate: "", endDate: "", reason: "" });

  // Leave review
  const [reviewOpen, setReviewOpen] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const loadProfiles = useCallback(async () => {
    const data = await hrmApi.listProfiles();
    setMembers(data);
  }, []);

  const loadAttendance = useCallback(async () => {
    const data = await hrmApi.listAttendance(attendanceDate);
    setAttendance(data);
  }, [attendanceDate]);

  const loadLeave = useCallback(async () => {
    const data = await hrmApi.listLeave();
    setLeaveRows(data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadProfiles(), loadAttendance(), loadLeave()]);
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed to load", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }, [loadProfiles, loadAttendance, loadLeave, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadAttendance().catch(() => {}); }, [attendanceDate, loadAttendance]);

  const attendanceMap = useMemo(() => {
    const m = new Map<string, StaffAttendanceRow>();
    attendance.forEach((a) => m.set(a.userId, a));
    return m;
  }, [attendance]);

  // Attendance summary counts
  const attCounts = useMemo(() => {
    const counts = { present: 0, absent: 0, half_day: 0, remote: 0, on_leave: 0, unmarked: 0 };
    members.forEach((m) => {
      const row = attendanceMap.get(m.id);
      if (row) counts[row.status as keyof typeof counts] = (counts[row.status as keyof typeof counts] || 0) + 1;
      else counts.unmarked++;
    });
    return counts;
  }, [members, attendanceMap]);

  const openProfileEdit = (member: StaffMemberRow) => {
    setEditMember(member);
    setProfileForm({
      jobTitle: member.profile?.jobTitle || "",
      department: member.profile?.department || "",
      joinDate: member.profile?.joinDate || "",
      emergencyContact: member.profile?.emergencyContact || "",
      emergencyPhone: member.profile?.emergencyPhone || "",
      notes: member.profile?.notes || "",
    });
  };

  const saveProfile = async () => {
    if (!editMember) return;
    try {
      await hrmApi.upsertProfile(editMember.id, profileForm);
      toast({ title: "Profile saved" });
      setEditMember(null);
      loadProfiles();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed to save", description: err instanceof Error ? err.message : String(err) });
    }
  };

  const markStatus = async (userId: string, status: AttendanceStatus) => {
    const extra = attTimeForm[userId] || { checkIn: "", checkOut: "", notes: "" };
    try {
      await hrmApi.markAttendance({
        userId, date: attendanceDate, status,
        checkIn: extra.checkIn || undefined,
        checkOut: extra.checkOut || undefined,
        notes: extra.notes || undefined,
      });
      toast({ title: "Attendance saved" });
      loadAttendance();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed", description: err instanceof Error ? err.message : String(err) });
    }
  };

  const saveAttendanceDetails = async (userId: string) => {
    const row = attendanceMap.get(userId);
    if (!row) return;
    const extra = attTimeForm[userId] || { checkIn: "", checkOut: "", notes: "" };
    try {
      await hrmApi.markAttendance({
        userId, date: attendanceDate, status: row.status as AttendanceStatus,
        checkIn: extra.checkIn || undefined,
        checkOut: extra.checkOut || undefined,
        notes: extra.notes || undefined,
      });
      toast({ title: "Details saved" });
      setExpandedAttRow(null);
      loadAttendance();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed", description: err instanceof Error ? err.message : String(err) });
    }
  };

  const initAttTime = (userId: string) => {
    const row = attendanceMap.get(userId);
    setAttTimeForm((prev) => ({
      ...prev,
      [userId]: {
        checkIn: row?.checkIn || "",
        checkOut: row?.checkOut || "",
        notes: row?.notes || "",
      },
    }));
  };

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrmApi.createLeave(leaveForm);
      toast({ title: "Leave request submitted" });
      setLeaveOpen(false);
      setLeaveForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      loadLeave();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed", description: err instanceof Error ? err.message : String(err) });
    }
  };

  const confirmReview = async () => {
    if (!reviewOpen) return;
    try {
      await hrmApi.reviewLeave(reviewOpen.id, reviewOpen.status, reviewNotes || undefined);
      toast({ title: reviewOpen.status === "approved" ? "Leave approved" : "Leave rejected" });
      setReviewOpen(null);
      setReviewNotes("");
      loadLeave();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed", description: err instanceof Error ? err.message : String(err) });
    }
  };

  const pendingLeave = leaveRows.filter((r) => r.status === "pending").length;
  const filteredLeave = leaveFilter === "all" ? leaveRows : leaveRows.filter((r) => r.status === leaveFilter);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarClock className="h-6 w-6" />
              {t("hrm.title", "Staff & HR")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("hrm.subtitle", "Manage staff profiles, attendance and leave requests")}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/payroll">
              <Button variant="outline" size="sm" className="gap-2">
                <Banknote className="h-4 w-4" /> Payroll
              </Button>
            </Link>
            {canEditTeam && (
              <Link to="/team">
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Add Staff
                </Button>
              </Link>
            )}
          </div>
        </div>

        {loading ? <LoadingState rows={8} /> : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Users, label: "Total Staff", value: members.length, color: "text-blue-600 bg-blue-100" },
                { icon: CheckCircle2, label: "Present Today", value: attCounts.present + attCounts.remote + attCounts.half_day, color: "text-green-600 bg-green-100" },
                { icon: UserX, label: "Absent Today", value: attCounts.absent, color: "text-red-600 bg-red-100" },
                { icon: Clock, label: "Pending Leave", value: pendingLeave, color: "text-amber-600 bg-amber-100" },
              ].map(({ icon: Icon, label, value, color }) => (
                <Card key={label}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-xl font-bold">{value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="profiles">
                  <UserCircle className="h-4 w-4 mr-1.5" />
                  {t("hrm.tabs.profiles", "Profiles")}
                </TabsTrigger>
                <TabsTrigger value="attendance">
                  <CalendarClock className="h-4 w-4 mr-1.5" />
                  {t("hrm.tabs.attendance", "Attendance")}
                </TabsTrigger>
                <TabsTrigger value="leave">
                  <Calendar className="h-4 w-4 mr-1.5" />
                  {t("hrm.tabs.leave", "Leave")}
                  {pendingLeave > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">{pendingLeave}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* ── Profiles Tab ── */}
              <TabsContent value="profiles" className="space-y-4">
                {members.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="font-medium">No staff members yet</p>
                      <p className="text-sm text-muted-foreground mb-4">Add team members from the Team page to manage their HR profiles.</p>
                      <Link to="/team">
                        <Button><Plus className="mr-2 h-4 w-4" />Add Staff Member</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Job Title</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell>
                                <div className="font-medium">{m.name}</div>
                                <div className="text-xs text-muted-foreground">{m.email}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" style={{ color: getRoleMeta(mapLegacyRole(m.role)).color, borderColor: getRoleMeta(mapLegacyRole(m.role)).color + "40" }}>
                                  {getRoleMeta(mapLegacyRole(m.role)).label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{m.profile?.jobTitle || <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell className="text-sm">{m.profile?.department || <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {m.profile?.joinDate ? new Date(m.profile.joinDate).toLocaleDateString() : "—"}
                              </TableCell>
                              <TableCell>
                                {canEditTeam && (
                                  <Button size="sm" variant="outline" onClick={() => openProfileEdit(m)}>Edit</Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
                <div className="flex gap-2">
                  <Link to="/payroll">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Banknote className="h-4 w-4" /> Manage Payroll & Salaries
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </TabsContent>

              {/* ── Attendance Tab ── */}
              <TabsContent value="attendance" className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label>{t("hrm.date", "Date")}</Label>
                    <Input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                  {/* Summary pills */}
                  <div className="flex flex-wrap gap-2 ml-auto">
                    {[
                      { label: "Present", count: attCounts.present, color: "bg-green-100 text-green-800" },
                      { label: "Remote", count: attCounts.remote, color: "bg-blue-100 text-blue-800" },
                      { label: "Half Day", count: attCounts.half_day, color: "bg-yellow-100 text-yellow-800" },
                      { label: "Absent", count: attCounts.absent, color: "bg-red-100 text-red-800" },
                      { label: "Unmarked", count: attCounts.unmarked, color: "bg-muted text-muted-foreground" },
                    ].filter((s) => s.count > 0).map((s) => (
                      <span key={s.label} className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
                        {s.label}: {s.count}
                      </span>
                    ))}
                  </div>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Check-in</TableHead>
                          <TableHead>Check-out</TableHead>
                          <TableHead className="w-[160px]">Mark</TableHead>
                          <TableHead className="w-[40px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((m) => {
                          const row = attendanceMap.get(m.id);
                          const canMark = canEditTeam || m.id === user?.id;
                          const expanded = expandedAttRow === m.id;
                          const timeData = attTimeForm[m.id] || { checkIn: row?.checkIn || "", checkOut: row?.checkOut || "", notes: row?.notes || "" };
                          return (
                            <Fragment key={m.id}>
                              <TableRow className={expanded ? "border-b-0" : ""}>
                                <TableCell>
                                  <div className="font-medium text-sm">{m.name}</div>
                                  <div className="text-xs text-muted-foreground">{m.profile?.jobTitle || m.email}</div>
                                </TableCell>
                                <TableCell>
                                  {row ? <AttStatusBadge status={row.status as AttendanceStatus} /> : <span className="text-xs text-muted-foreground">Not marked</span>}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{row?.checkIn || "—"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{row?.checkOut || "—"}</TableCell>
                                <TableCell>
                                  {canMark && (
                                    <Select
                                      value={row?.status || ""}
                                      onValueChange={(v) => markStatus(m.id, v as AttendanceStatus)}
                                    >
                                      <SelectTrigger className="h-8 w-[130px]">
                                        <SelectValue placeholder="Mark status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ATTENDANCE_STATUSES.map((s) => (
                                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {row && canMark && (
                                    <button
                                      onClick={() => {
                                        if (!expanded) initAttTime(m.id);
                                        setExpandedAttRow(expanded ? null : m.id);
                                      }}
                                      className="p-1 text-muted-foreground hover:text-foreground"
                                      title="Add check-in/out times"
                                    >
                                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                  )}
                                </TableCell>
                              </TableRow>
                              {expanded && (
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={6} className="py-3 px-4">
                                    <div className="flex flex-wrap gap-3 items-end">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Check-in Time</Label>
                                        <Input
                                          type="time"
                                          value={timeData.checkIn}
                                          onChange={(e) => setAttTimeForm((p) => ({ ...p, [m.id]: { ...timeData, checkIn: e.target.value } }))}
                                          className="h-8 w-32"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Check-out Time</Label>
                                        <Input
                                          type="time"
                                          value={timeData.checkOut}
                                          onChange={(e) => setAttTimeForm((p) => ({ ...p, [m.id]: { ...timeData, checkOut: e.target.value } }))}
                                          className="h-8 w-32"
                                        />
                                      </div>
                                      <div className="space-y-1 flex-1 min-w-[160px]">
                                        <Label className="text-xs">Notes</Label>
                                        <Input
                                          value={timeData.notes}
                                          onChange={(e) => setAttTimeForm((p) => ({ ...p, [m.id]: { ...timeData, notes: e.target.value } }))}
                                          placeholder="Optional note"
                                          className="h-8"
                                        />
                                      </div>
                                      <Button size="sm" onClick={() => saveAttendanceDetails(m.id)}>
                                        <Save className="mr-1.5 h-3.5 w-3.5" /> Save
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Leave Tab ── */}
              <TabsContent value="leave" className="space-y-4">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex gap-2">
                    {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                      <Button
                        key={f}
                        size="sm"
                        variant={leaveFilter === f ? "default" : "outline"}
                        onClick={() => setLeaveFilter(f)}
                        className="capitalize"
                      >
                        {f}
                        {f === "pending" && pendingLeave > 0 && (
                          <Badge variant="destructive" className="ml-2 h-4 px-1 text-xs">{pendingLeave}</Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                  <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="mr-2 h-4 w-4" />{t("hrm.requestLeave", "Request Leave")}</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
                      <form onSubmit={submitLeave} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Leave Type</Label>
                          <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm((f) => ({ ...f, leaveType: v as LeaveType }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LEAVE_TYPES.map((lt) => (
                                <SelectItem key={lt} value={lt} className="capitalize">{lt.replace("_", " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input type="date" required value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input type="date" required value={leaveForm.endDate} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))} />
                          </div>
                        </div>
                        {leaveForm.startDate && leaveForm.endDate && (
                          <p className="text-sm text-muted-foreground">
                            Duration: <strong>{leaveDays(leaveForm.startDate, leaveForm.endDate)} day{leaveDays(leaveForm.startDate, leaveForm.endDate) !== 1 ? "s" : ""}</strong>
                          </p>
                        )}
                        <div className="space-y-2">
                          <Label>Reason</Label>
                          <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Briefly explain the reason for leave..." />
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" className="flex-1">Submit Request</Button>
                          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reviewed by</TableHead>
                          <TableHead className="w-[160px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLeave.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                              No {leaveFilter === "all" ? "" : leaveFilter} leave requests found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredLeave.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>
                                <div className="font-medium text-sm">{row.userName || row.userId}</div>
                                {row.reason && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{row.reason}</div>}
                              </TableCell>
                              <TableCell>
                                <span className="capitalize text-sm">{row.leaveType.replace("_", " ")}</span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {row.startDate} → {row.endDate}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {leaveDays(row.startDate, row.endDate)}d
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  row.status === "approved" ? "default" :
                                  row.status === "rejected" ? "destructive" : "secondary"
                                }>
                                  {row.status === "approved" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                                  {row.status === "rejected" && <XCircle className="mr-1 h-3 w-3" />}
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {row.reviewerName || "—"}
                                {row.reviewNotes && <div className="text-xs italic">{row.reviewNotes}</div>}
                              </TableCell>
                              <TableCell>
                                {isHrmManager && row.status === "pending" && (
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50"
                                      onClick={() => { setReviewOpen({ id: row.id, status: "approved" }); setReviewNotes(""); }}>
                                      Approve
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50"
                                      onClick={() => { setReviewOpen({ id: row.id, status: "rejected" }); setReviewNotes(""); }}>
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Profile Edit Dialog */}
        <Dialog open={!!editMember} onOpenChange={(open) => !open && setEditMember(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                {editMember?.name}
                <span className="text-xs font-normal text-muted-foreground ml-1">{editMember?.email}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input value={profileForm.jobTitle} onChange={(e) => setProfileForm((f) => ({ ...f, jobTitle: e.target.value }))} placeholder="e.g. Sales Executive" />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input value={profileForm.department} onChange={(e) => setProfileForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Operations" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Join Date</Label>
                <Input type="date" value={profileForm.joinDate} onChange={(e) => setProfileForm((f) => ({ ...f, joinDate: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Emergency Contact Name</Label>
                  <Input value={profileForm.emergencyContact} onChange={(e) => setProfileForm((f) => ({ ...f, emergencyContact: e.target.value }))} placeholder="Contact name" />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Phone</Label>
                  <Input value={profileForm.emergencyPhone} onChange={(e) => setProfileForm((f) => ({ ...f, emergencyPhone: e.target.value }))} placeholder="+880..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea value={profileForm.notes} onChange={(e) => setProfileForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any additional notes about this staff member..." />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={saveProfile}><Save className="mr-2 h-4 w-4" />Save Profile</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Leave Review Dialog */}
        <Dialog open={!!reviewOpen} onOpenChange={(open) => !open && setReviewOpen(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {reviewOpen?.status === "approved" ? "Approve Leave" : "Reject Leave"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Review Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder={reviewOpen?.status === "approved" ? "e.g. Approved. Handover required." : "e.g. Please reschedule to a less busy period."}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className={`flex-1 ${reviewOpen?.status === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}`}
                  onClick={confirmReview}
                >
                  {reviewOpen?.status === "approved" ? <><CheckCircle2 className="mr-2 h-4 w-4" />Confirm Approve</> : <><XCircle className="mr-2 h-4 w-4" />Confirm Reject</>}
                </Button>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default StaffHrm;
