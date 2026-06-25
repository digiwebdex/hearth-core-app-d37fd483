import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Eye, CheckCircle, RefreshCw } from "lucide-react";
import { payrollApi, tenantApi, type PayrollRun, type PayslipEntry, type User } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmt(n: number) { return `৳ ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`; }

const statusColor: Record<string, "default" | "secondary" | "destructive"> = { draft: "secondary", approved: "default", paid: "default" };

export default function Payroll() {
  const { toast } = useToast();
  const [tab, setTab] = useState("runs");
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [runLoading, setRunLoading] = useState(false);

  // Create run dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ month: String(new Date().getMonth() + 1), year: new Date().getFullYear(), notes: "" });
  const [creating, setCreating] = useState(false);

  // Pay payslip dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payingPayslip, setPayingPayslip] = useState<PayslipEntry | null>(null);
  const [payForm, setPayForm] = useState({ paymentMethod: "bank_transfer", paymentReference: "" });
  const [paying, setPaying] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const [runsData, membersData] = await Promise.all([payrollApi.listRuns(), tenantApi.getMembers()]);
      setRuns(runsData);
      setMembers(membersData);
    } catch { toast({ title: "Failed to load payroll data", variant: "destructive" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  async function viewRun(run: PayrollRun) {
    setRunLoading(true);
    setTab("detail");
    try {
      setSelectedRun(await payrollApi.getRun(run.id));
    } catch { toast({ title: "Failed to load run detail", variant: "destructive" }); }
    finally { setRunLoading(false); }
  }

  async function createRun() {
    setCreating(true);
    try {
      const run = await payrollApi.createRun({ month: MONTHS[parseInt(createForm.month) - 1], year: createForm.year, notes: createForm.notes });
      toast({ title: `Payroll generated for ${MONTHS[parseInt(createForm.month) - 1]} ${createForm.year} — ${run.payslips?.length || 0} payslips` });
      setCreateOpen(false);
      loadRuns();
      viewRun(run);
    } catch (e: unknown) {
      toast({ title: (e as Error).message || "Failed to generate payroll", variant: "destructive" });
    } finally { setCreating(false); }
  }

  async function approveRun(id: string) {
    try {
      await payrollApi.updateRun(id, { status: "approved" });
      toast({ title: "Payroll approved" });
      const updated = await payrollApi.getRun(id);
      setSelectedRun(updated);
      loadRuns();
    } catch { toast({ title: "Failed to approve", variant: "destructive" }); }
  }

  function openPay(payslip: PayslipEntry) {
    setPayingPayslip(payslip);
    setPayForm({ paymentMethod: "bank_transfer", paymentReference: "" });
    setPayOpen(true);
  }

  async function confirmPay() {
    if (!payingPayslip) return;
    setPaying(true);
    try {
      await payrollApi.payPayslip(payingPayslip.id, payForm);
      toast({ title: `Payslip marked as paid for ${payingPayslip.staffName}` });
      setPayOpen(false);
      const updated = await payrollApi.getRun(payingPayslip.payrollRunId);
      setSelectedRun(updated);
      loadRuns();
    } catch { toast({ title: "Failed to mark as paid", variant: "destructive" }); }
    finally { setPaying(false); }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payroll Management</h1>
            <p className="text-muted-foreground text-sm">Generate and manage monthly staff salary payroll</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadRuns} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Generate Payroll
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="runs">Payroll Runs</TabsTrigger>
            {selectedRun && <TabsTrigger value="detail">Run Detail</TabsTrigger>}
          </TabsList>

          <TabsContent value="runs" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {loading ? <div className="p-6"><Skeleton className="h-40 w-full" /></div> : runs.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-2">No payroll runs yet</p>
                    <p className="text-sm">Click "Generate Payroll" to create the first payroll run.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Period</th>
                        <th className="text-left px-4 py-3 font-medium">Staff</th>
                        <th className="text-left px-4 py-3 font-medium">Total Amount</th>
                        <th className="text-left px-4 py-3 font-medium">Paid</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => (
                        <tr key={run.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{run.month} {run.year}</td>
                          <td className="px-4 py-3">{run._count?.payslips || 0} staff</td>
                          <td className="px-4 py-3 font-semibold">{fmt(run.totalAmount)}</td>
                          <td className="px-4 py-3 text-green-700">{run.paidCount} paid</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusColor[run.status] || "secondary"} className="capitalize">{run.status}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="outline" onClick={() => viewRun(run)}>
                              <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detail" className="mt-4 space-y-4">
            {runLoading ? <Skeleton className="h-80 w-full" /> : selectedRun ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedRun.month} {selectedRun.year} — Payroll</h2>
                    <p className="text-sm text-muted-foreground">{selectedRun.payslips?.length || 0} payslips · Total: {fmt(selectedRun.totalAmount)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={statusColor[selectedRun.status] || "secondary"} className="capitalize text-sm">{selectedRun.status}</Badge>
                    {selectedRun.status === "draft" && (
                      <Button size="sm" onClick={() => approveRun(selectedRun.id)}>
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Payroll</p><p className="text-xl font-bold">{fmt(selectedRun.totalAmount)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Paid</p><p className="text-xl font-bold text-green-600">{selectedRun.paidCount} / {selectedRun.payslips?.length || 0}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Pending</p><p className="text-xl font-bold text-orange-600">{(selectedRun.payslips?.length || 0) - selectedRun.paidCount}</p></CardContent></Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Payslips</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/40">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Staff</th>
                          <th className="text-right px-4 py-2 font-medium">Basic</th>
                          <th className="text-right px-4 py-2 font-medium">Allowances</th>
                          <th className="text-right px-4 py-2 font-medium">Gross</th>
                          <th className="text-right px-4 py-2 font-medium">Deductions</th>
                          <th className="text-right px-4 py-2 font-medium">Net</th>
                          <th className="text-center px-4 py-2 font-medium">Attendance</th>
                          <th className="text-left px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedRun.payslips || []).map((slip) => {
                          const allowances = slip.houseAllowance + slip.transportAllowance + slip.medicalAllowance + slip.otherAllowance;
                          return (
                            <tr key={slip.id} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-4 py-2.5 font-medium">{slip.staffName}</td>
                              <td className="px-4 py-2.5 text-right">{fmt(slip.basicSalary)}</td>
                              <td className="px-4 py-2.5 text-right">{fmt(allowances)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold">{fmt(slip.grossSalary)}</td>
                              <td className="px-4 py-2.5 text-right text-red-600">({fmt(slip.totalDeductions)})</td>
                              <td className="px-4 py-2.5 text-right font-bold text-green-700">{fmt(slip.netSalary)}</td>
                              <td className="px-4 py-2.5 text-center text-muted-foreground text-xs">
                                {slip.presentDays}P · {slip.absentDays}A · {slip.leaveDays}L
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge variant={slip.status === "paid" ? "default" : "secondary"} className="capitalize">{slip.status}</Badge>
                              </td>
                              <td className="px-4 py-2.5">
                                {slip.status === "pending" && selectedRun.status === "approved" && (
                                  <Button size="sm" variant="outline" onClick={() => openPay(slip)}>Pay</Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            ) : <p className="text-muted-foreground">No run selected.</p>}
          </TabsContent>
        </Tabs>
      </div>

      {/* Generate Payroll Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Generate Payroll</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Select value={createForm.month} onValueChange={(v) => setCreateForm({ ...createForm, month: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={createForm.year} onChange={(e) => setCreateForm({ ...createForm, year: parseInt(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Any notes..." />
            </div>
            <p className="text-xs text-muted-foreground">Payroll will be generated for all active staff with configured salary structures. Attendance data will be pulled automatically.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createRun} disabled={creating}>{creating ? "Generating..." : "Generate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Payslip Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark as Paid — {payingPayslip?.staffName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted p-3 text-sm">
              Net Salary: <span className="font-bold text-green-700">{fmt(payingPayslip?.netSalary || 0)}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={payForm.paymentMethod} onValueChange={(v) => setPayForm({ ...payForm, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference / Transaction ID</Label>
              <Input value={payForm.paymentReference} onChange={(e) => setPayForm({ ...payForm, paymentReference: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={confirmPay} disabled={paying}>{paying ? "Saving..." : "Confirm Payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
