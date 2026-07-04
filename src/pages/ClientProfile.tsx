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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { clientApi, type Client, type Booking, type Invoice, type Payment } from "@/lib/api";
import {
  ArrowLeft, Phone, Mail, MapPin, CreditCard, User, CalendarIcon, Upload,
  Plane, Receipt, Wallet, FileText, AlertTriangle, Shield,
} from "lucide-react";
import { WorkflowNextStep } from "@/components/WorkflowNextStep";
import ClientCrmExtras from "@/components/ClientCrmExtras";
import { InlineEmpty } from "@/components/EmptyState";
import { useHumanError } from "@/hooks/useHumanError";

const ClientProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatError } = useHumanError();

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, b, inv, pay] = await Promise.all([
        clientApi.get(id),
        clientApi.getBookings(id).catch(() => []),
        clientApi.getInvoices(id).catch(() => []),
        clientApi.getPayments(id).catch(() => []),
      ]);
      setClient(c);
      setBookings(b);
      setInvoices(inv);
      setPayments(pay);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !e.target.files?.length) return;
    const formData = new FormData();
    Array.from(e.target.files).forEach((f) => formData.append("files", f));
    try {
      await clientApi.uploadDocument(id, formData);
      toast({ title: "Document uploaded" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: t("humanErrors.upload"), description: formatError(err) });
    }
  };

  if (loading) return <DashboardLayout><LoadingState rows={8} /></DashboardLayout>;
  if (error || !client) return <DashboardLayout><ErrorState message={error || "Client not found"} onRetry={fetchData} /></DashboardLayout>;

  const passportExpiringSoon = client.passportExpiry && new Date(client.passportExpiry) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      unpaid: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      partial: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    };
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[status] || "bg-muted text-muted-foreground"}`}>{status}</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <WorkflowNextStep
          current="client"
          next="quotation"
          nextLabel="Create quotation"
          nextHref={id ? `/quotations/new?clientId=${id}&clientName=${encodeURIComponent(client.name)}` : "/quotations/new"}
        />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/clients")} className="mb-1">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Clients
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6" /> {client.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
              <span>Client since {client.createdAt?.slice(0, 10)}</span>
              {client.tags?.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Contact Info</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {client.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {client.phone}</div>}
                {client.alternatePhone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {client.alternatePhone} (alt)</div>}
                {client.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {client.email}</div>}
                {client.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {client.address}</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Identity & Documents</CardTitle>
                  {passportExpiringSoon && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> Passport expiring
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {client.dateOfBirth && <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground" /> DOB: {client.dateOfBirth}</div>}
                {client.nationality && <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /> {client.nationality}</div>}
                {client.passportNumber && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span>Passport: {client.passportNumber}</span>
                      {client.passportExpiry && <span className={`ml-2 text-xs ${passportExpiringSoon ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>Exp: {client.passportExpiry}</span>}
                    </div>
                  </div>
                )}
                {client.nidNumber && <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" /> NID: {client.nidNumber}</div>}
              </CardContent>
            </Card>

            {(client.emergencyContact || client.emergencyPhone) && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Emergency Contact</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {client.emergencyContact && <p>{client.emergencyContact}</p>}
                  {client.emergencyPhone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{client.emergencyPhone}</div>}
                </CardContent>
              </Card>
            )}

            {client.notes && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p></CardContent>
              </Card>
            )}

            <ClientCrmExtras client={client} />

            {/* Documents */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Documents</CardTitle>
                  <PermissionGate module="clients" action="edit">
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild><span><Upload className="mr-1 h-3.5 w-3.5" /> Upload</span></Button>
                    </Label>
                    <Input id="file-upload" type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </PermissionGate>
                </div>
              </CardHeader>
              <CardContent>
                {client.documents && client.documents.length > 0 ? (
                  <div className="space-y-2">
                    {client.documents.map((doc) => (
                      <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <FileText className="h-4 w-4" /> {doc.name}
                      </a>
                    ))}
                  </div>
                ) : (
                  <InlineEmpty title={t("emptyStates.noClientDocuments")} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="bookings" className="space-y-4">
              <TabsList>
                <TabsTrigger value="bookings" className="gap-1.5"><Plane className="h-4 w-4" /> Bookings ({bookings.length})</TabsTrigger>
                <TabsTrigger value="invoices" className="gap-1.5"><Receipt className="h-4 w-4" /> Invoices ({invoices.length})</TabsTrigger>
                <TabsTrigger value="payments" className="gap-1.5"><Wallet className="h-4 w-4" /> Payments ({payments.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="bookings">
                <Card>
                  <CardContent className="p-0">
                    {bookings.length === 0 ? (
                      <InlineEmpty title={t("emptyStates.noClientBookings")} hint={t("emptyStates.noClientBookingsHint")} />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Profit</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookings.map((b) => (
                            <TableRow key={b.id}>
                              <TableCell className="capitalize font-medium">{b.type}</TableCell>
                              <TableCell>৳{b.amount?.toLocaleString()}</TableCell>
                              <TableCell>৳{b.profit?.toLocaleString()}</TableCell>
                              <TableCell>{statusBadge(b.status)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{b.createdAt?.slice(0, 10)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="invoices">
                <Card>
                  <CardContent className="p-0">
                    {invoices.length === 0 ? (
                      <InlineEmpty title={t("emptyStates.noClientInvoices")} hint={t("emptyStates.noClientInvoicesHint")} />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Total</TableHead>
                            <TableHead>Paid</TableHead>
                            <TableHead>Due</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoices.map((inv) => (
                            <TableRow key={inv.id}>
                              <TableCell>৳{inv.totalAmount?.toLocaleString()}</TableCell>
                              <TableCell>৳{inv.paidAmount?.toLocaleString()}</TableCell>
                              <TableCell>৳{inv.dueAmount?.toLocaleString()}</TableCell>
                              <TableCell>{statusBadge(inv.status)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{inv.createdAt?.slice(0, 10)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payments">
                <Card>
                  <CardContent className="p-0">
                    {payments.length === 0 ? (
                      <InlineEmpty title={t("emptyStates.noClientPayments")} />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>৳{p.amount?.toLocaleString()}</TableCell>
                              <TableCell className="capitalize">{p.method}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{p.date || p.createdAt?.slice(0, 10)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientProfile;
