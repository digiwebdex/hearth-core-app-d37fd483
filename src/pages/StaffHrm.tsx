import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
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
import { CalendarClock, UserCircle, Plus, Save } from "lucide-react";

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["present", "absent", "half_day", "remote", "on_leave"];
const LEAVE_TYPES: LeaveType[] = ["annual", "sick", "unpaid", "other"];

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
  const [editMember, setEditMember] = useState<StaffMemberRow | null>(null);
  const [profileForm, setProfileForm] = useState({
    jobTitle: "",
    department: "",
    joinDate: "",
    emergencyContact: "",
    emergencyPhone: "",
    notes: "",
  });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: "annual" as LeaveType,
    startDate: "",
    endDate: "",
    reason: "",
  });

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
      toast({
        variant: "destructive",
        title: t("hrm.loadFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [loadProfiles, loadAttendance, loadLeave, t, toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadAttendance().catch(() => {});
  }, [attendanceDate, loadAttendance]);

  const attendanceMap = useMemo(() => {
    const m = new Map<string, StaffAttendanceRow>();
    attendance.forEach((a) => m.set(a.userId, a));
    return m;
  }, [attendance]);

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
      toast({ title: t("hrm.profileSaved") });
      setEditMember(null);
      loadProfiles();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("hrm.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const markStatus = async (userId: string, status: AttendanceStatus) => {
    try {
      await hrmApi.markAttendance({ userId, date: attendanceDate, status });
      toast({ title: t("hrm.attendanceSaved") });
      loadAttendance();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("hrm.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrmApi.createLeave(leaveForm);
      toast({ title: t("hrm.leaveSubmitted") });
      setLeaveOpen(false);
      setLeaveForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      loadLeave();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("hrm.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const reviewLeave = async (id: string, status: "approved" | "rejected") => {
    try {
      await hrmApi.reviewLeave(id, status);
      toast({ title: t("hrm.leaveReviewed") });
      loadLeave();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("hrm.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const pendingLeave = leaveRows.filter((r) => r.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-8 w-8" />
            {t("hrm.title")}
          </h1>
          <p className="text-muted-foreground">{t("hrm.subtitle")}</p>
        </div>

        {loading ? (
          <LoadingState rows={8} />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="profiles">{t("hrm.tabs.profiles")}</TabsTrigger>
              <TabsTrigger value="attendance">{t("hrm.tabs.attendance")}</TabsTrigger>
              <TabsTrigger value="leave">
                {t("hrm.tabs.leave")}
                {pendingLeave > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 px-1.5">{pendingLeave}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profiles" className="space-y-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("hrm.name")}</TableHead>
                        <TableHead>{t("hrm.role")}</TableHead>
                        <TableHead>{t("hrm.jobTitle")}</TableHead>
                        <TableHead>{t("hrm.department")}</TableHead>
                        <TableHead className="w-[100px]" />
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
                            <Badge variant="outline" className={getRoleMeta(mapLegacyRole(m.role)).color}>
                              {getRoleMeta(mapLegacyRole(m.role)).label}
                            </Badge>
                          </TableCell>
                          <TableCell>{m.profile?.jobTitle || "—"}</TableCell>
                          <TableCell>{m.profile?.department || "—"}</TableCell>
                          <TableCell>
                            {canEditTeam && (
                              <Button size="sm" variant="outline" onClick={() => openProfileEdit(m)}>
                                {t("common.edit")}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label>{t("hrm.date")}</Label>
                  <Input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("hrm.name")}</TableHead>
                        <TableHead>{t("hrm.status")}</TableHead>
                        <TableHead className="w-[200px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => {
                        const row = attendanceMap.get(m.id);
                        const canMark = canEditTeam || m.id === user?.id;
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.name}</TableCell>
                            <TableCell>
                              {row ? (
                                <Badge variant="secondary">{t(`hrm.attendanceStatus.${row.status}`)}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {canMark && (
                                <Select
                                  value={row?.status || ""}
                                  onValueChange={(v) => markStatus(m.id, v as AttendanceStatus)}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder={t("hrm.markAttendance")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ATTENDANCE_STATUSES.map((s) => (
                                      <SelectItem key={s} value={s}>{t(`hrm.attendanceStatus.${s}`)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leave" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" />{t("hrm.requestLeave")}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t("hrm.requestLeave")}</DialogTitle></DialogHeader>
                    <form onSubmit={submitLeave} className="space-y-3">
                      <div className="space-y-1">
                        <Label>{t("hrm.leaveType")}</Label>
                        <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm((f) => ({ ...f, leaveType: v as LeaveType }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LEAVE_TYPES.map((lt) => (
                              <SelectItem key={lt} value={lt}>{t(`hrm.leaveTypes.${lt}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>{t("hrm.startDate")}</Label>
                          <Input type="date" required value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label>{t("hrm.endDate")}</Label>
                          <Input type="date" required value={leaveForm.endDate} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>{t("hrm.reason")}</Label>
                        <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} rows={3} />
                      </div>
                      <Button type="submit">{t("hrm.submitLeave")}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("hrm.name")}</TableHead>
                        <TableHead>{t("hrm.leaveType")}</TableHead>
                        <TableHead>{t("hrm.dates")}</TableHead>
                        <TableHead>{t("hrm.status")}</TableHead>
                        <TableHead className="w-[160px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            {t("hrm.noLeave")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        leaveRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.userName || row.userId}</TableCell>
                            <TableCell>{t(`hrm.leaveTypes.${row.leaveType}`)}</TableCell>
                            <TableCell className="text-sm">{row.startDate} → {row.endDate}</TableCell>
                            <TableCell>
                              <Badge variant={row.status === "approved" ? "default" : row.status === "rejected" ? "destructive" : "secondary"}>
                                {t(`hrm.leaveStatuses.${row.status}`)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isHrmManager && row.status === "pending" && (
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" onClick={() => reviewLeave(row.id, "approved")}>
                                    {t("hrm.approve")}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => reviewLeave(row.id, "rejected")}>
                                    {t("hrm.reject")}
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
        )}

        <Dialog open={!!editMember} onOpenChange={(open) => !open && setEditMember(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                {editMember?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("hrm.jobTitle")}</Label>
                  <Input value={profileForm.jobTitle} onChange={(e) => setProfileForm((f) => ({ ...f, jobTitle: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t("hrm.department")}</Label>
                  <Input value={profileForm.department} onChange={(e) => setProfileForm((f) => ({ ...f, department: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t("hrm.joinDate")}</Label>
                <Input type="date" value={profileForm.joinDate} onChange={(e) => setProfileForm((f) => ({ ...f, joinDate: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("hrm.emergencyContact")}</Label>
                  <Input value={profileForm.emergencyContact} onChange={(e) => setProfileForm((f) => ({ ...f, emergencyContact: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t("hrm.emergencyPhone")}</Label>
                  <Input value={profileForm.emergencyPhone} onChange={(e) => setProfileForm((f) => ({ ...f, emergencyPhone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t("hrm.notes")}</Label>
                <Textarea value={profileForm.notes} onChange={(e) => setProfileForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild><Button variant="outline">{t("common.cancel")}</Button></DialogClose>
                <Button onClick={saveProfile}><Save className="mr-2 h-4 w-4" />{t("common.save")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default StaffHrm;
