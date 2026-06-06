import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Pencil, Trash2, Users, UserPlus, CreditCard, Eye, Search, Download,
  Plane, Hotel, MapPin, CheckCircle2, Clock, AlertTriangle, TrendingUp,
  Shield, FileText, Moon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  hajjApi,
  type HajjPackage, type HajjPackageType, type HajjPackageStatus,
  type HajjGroup, type HajjPilgrim, type HajjPilgrimStatus, type HajjVisaStatus,
  type HajjRoomType, type HajjPilgrimPayment,
} from "@/lib/hajjApi";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

// ── Constants ──
const PKG_STATUS_META: { value: HajjPackageStatus; label: string; color: string }[] = [
  { value: "upcoming", label: "Upcoming", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "active", label: "Active", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "departed", label: "Departed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "completed", label: "Completed", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  { value: "closed", label: "Closed", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const PILGRIM_STATUS_META: { value: HajjPilgrimStatus; label: string; color: string }[] = [
  { value: "registered", label: "Registered", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "documents_pending", label: "Docs Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "visa_processing", label: "Visa Processing", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "confirmed", label: "Confirmed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "departed", label: "Departed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "completed", label: "Completed", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const VISA_STATUS_META: { value: HajjVisaStatus; label: string; color: string }[] = [
  { value: "not_started", label: "Not Started", color: "bg-gray-100 text-gray-800" },
  { value: "documents_collected", label: "Docs Collected", color: "bg-blue-100 text-blue-800" },
  { value: "submitted", label: "Submitted", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", label: "Approved", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-800" },
];

const HOTEL_CLASSES = [
  { value: "economy", label: "Economy" },
  { value: "3_star", label: "3-Star" },
  { value: "4_star", label: "4-Star" },
  { value: "5_star", label: "5-Star" },
  { value: "shifting", label: "Shifting" },
];

const ROOM_TYPES: { value: HajjRoomType; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "double", label: "Double" },
  { value: "triple", label: "Triple" },
  { value: "quad", label: "Quad" },
  { value: "sharing", label: "Sharing" },
];

const PAY_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank Transfer" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "card", label: "Card" },
];

const getStatusMeta = <T extends { value: string }>(list: T[], val: string) =>
  list.find((x) => x.value === val) || list[0];

// ── Mock Data ──
const DEFAULT_PACKAGES: HajjPackage[] = [
  {
    id: "hp1", name: "Hajj Economy 2026", type: "hajj", status: "active",
    duration: "40 Days", makkahNights: 15, madinahNights: 8,
    makkahHotel: "Al Shohada Hotel", madinahHotel: "Al Ansar Hotel",
    hotelClass: "3_star", flightInfo: "Biman BD — DAC→JED (Direct)",
    visaIncluded: true, transportIncluded: true, mealsIncluded: true, ziyaratIncluded: true,
    packagePrice: 550000, costPrice: 420000, profit: 130000,
    capacity: 50, enrolled: 3,
    departureDate: "2026-05-20", returnDate: "2026-06-28",
    highlights: "3-Star Hotels, Meals, Ziyarat, Transport, Visa",
    tenantId: "", createdAt: "2026-01-10",
  },
  {
    id: "hp2", name: "Hajj Premium 2026", type: "hajj", status: "active",
    duration: "35 Days", makkahNights: 12, madinahNights: 8,
    makkahHotel: "Hilton Suites Makkah", madinahHotel: "Oberoi Madinah",
    hotelClass: "5_star", flightInfo: "Saudi Airlines — DAC→JED (Business)",
    visaIncluded: true, transportIncluded: true, mealsIncluded: true, ziyaratIncluded: true,
    packagePrice: 850000, costPrice: 650000, profit: 200000,
    capacity: 30, enrolled: 0,
    departureDate: "2026-05-25", returnDate: "2026-06-28",
    highlights: "5-Star Hotels, Private Transport, VIP Ziyarat, Full Board",
    tenantId: "", createdAt: "2026-01-10",
  },
  {
    id: "hp3", name: "Umrah Ramadan 2026", type: "umrah", status: "upcoming",
    duration: "15 Days", makkahNights: 8, madinahNights: 5,
    makkahHotel: "Swissotel Makkah", madinahHotel: "Pullman Madinah",
    hotelClass: "4_star", flightInfo: "Biman BD — DAC→MED",
    visaIncluded: true, transportIncluded: true, mealsIncluded: false, ziyaratIncluded: true,
    packagePrice: 180000, costPrice: 135000, profit: 45000,
    capacity: 40, enrolled: 1,
    departureDate: "2026-03-01", returnDate: "2026-03-15",
    highlights: "4-Star Hotels, Ramadan Special, Ziyarat Included",
    tenantId: "", createdAt: "2026-02-01",
  },
];

const DEFAULT_GROUPS: HajjGroup[] = [
  { id: "g1", packageId: "hp1", name: "Batch-1 (May 2026)", leader: "Maulana Rafiq", leaderPhone: "01711-000111", departureDate: "2026-05-20", returnDate: "2026-06-28", tenantId: "", createdAt: "2026-01-15" },
  { id: "g2", packageId: "hp1", name: "Batch-2 (May 2026)", leader: "Hafez Karim", leaderPhone: "01811-000222", departureDate: "2026-05-22", returnDate: "2026-06-30", tenantId: "", createdAt: "2026-02-01" },
  { id: "g3", packageId: "hp3", name: "Umrah Ramadan Group-A", leader: "Imam Hasan", leaderPhone: "01911-000333", departureDate: "2026-03-01", returnDate: "2026-03-15", tenantId: "", createdAt: "2026-02-10" },
];

const DEFAULT_PILGRIMS: HajjPilgrim[] = [
  { id: "p1", packageId: "hp1", groupId: "g1", name: "Abdul Rahman", phone: "01712-111222", gender: "male", passportNumber: "A12345678", passportExpiry: "2030-06-15", nidNumber: "1990123456789", nationality: "Bangladeshi", mahramName: "Fatima Khatun", mahramRelation: "Wife", mahramPilgrimId: "p2", roomType: "double", roomNumber: "301", status: "confirmed", visaStatus: "approved", departureStatus: "not_departed", totalAmount: 550000, paidAmount: 400000, dueAmount: 150000, paymentStatus: "partial", emergencyContact: "Md. Rahim", emergencyPhone: "01712-999888", tenantId: "", createdAt: "2026-01-20" },
  { id: "p2", packageId: "hp1", groupId: "g1", name: "Fatima Khatun", phone: "01812-333444", gender: "female", passportNumber: "B98765432", passportExpiry: "2029-12-01", nidNumber: "1985567891234", nationality: "Bangladeshi", mahramName: "Abdul Rahman", mahramRelation: "Husband", mahramPilgrimId: "p1", roomType: "double", roomNumber: "301", status: "confirmed", visaStatus: "approved", departureStatus: "not_departed", totalAmount: 550000, paidAmount: 550000, dueAmount: 0, paymentStatus: "paid", emergencyContact: "Md. Rahim", emergencyPhone: "01812-777666", tenantId: "", createdAt: "2026-01-22" },
  { id: "p3", packageId: "hp1", groupId: "g2", name: "Kamal Uddin", phone: "01912-555666", gender: "male", passportNumber: "C11223344", passportExpiry: "2028-09-20", nidNumber: "1992345678901", nationality: "Bangladeshi", roomType: "triple", status: "documents_pending", visaStatus: "documents_collected", departureStatus: "not_departed", totalAmount: 550000, paidAmount: 100000, dueAmount: 450000, paymentStatus: "partial", emergencyContact: "Md. Salim", emergencyPhone: "01912-444333", tenantId: "", createdAt: "2026-02-05" },
  { id: "p4", packageId: "hp3", groupId: "g3", name: "Halima Begum", phone: "01612-777888", gender: "female", passportNumber: "D55667788", passportExpiry: "2031-03-10", nidNumber: "1988901234567", nationality: "Bangladeshi", mahramName: "Jahangir Alam (Non-pilgrim)", mahramRelation: "Brother", roomType: "sharing", status: "registered", visaStatus: "not_started", departureStatus: "not_departed", totalAmount: 180000, paidAmount: 0, dueAmount: 180000, paymentStatus: "unpaid", emergencyContact: "Jahangir Alam", emergencyPhone: "01612-222111", tenantId: "", createdAt: "2026-02-15" },
];

const DEFAULT_PAYMENTS: HajjPilgrimPayment[] = [
  { id: "pp1", pilgrimId: "p1", amount: 200000, method: "bank", reference: "TXN-001", date: "2026-01-20", installmentLabel: "1st Installment", note: "Registration payment", createdAt: "2026-01-20" },
  { id: "pp2", pilgrimId: "p1", amount: 200000, method: "bkash", reference: "BK-001", date: "2026-02-15", installmentLabel: "2nd Installment", note: "Second payment", createdAt: "2026-02-15" },
  { id: "pp3", pilgrimId: "p2", amount: 550000, method: "bank", reference: "TXN-002", date: "2026-01-22", installmentLabel: "Full Payment", note: "Full payment received", createdAt: "2026-01-22" },
  { id: "pp4", pilgrimId: "p3", amount: 100000, method: "cash", date: "2026-02-05", installmentLabel: "Booking Amount", note: "Booking deposit", createdAt: "2026-02-05" },
];

// ── Empty Forms ──
const emptyPkgForm = {
  name: "", type: "hajj" as HajjPackageType, status: "upcoming" as HajjPackageStatus,
  duration: "", makkahNights: 0, madinahNights: 0,
  makkahHotel: "", madinahHotel: "", hotelClass: "3_star" as string,
  flightInfo: "", visaIncluded: true, transportIncluded: true, mealsIncluded: true, ziyaratIncluded: true,
  packagePrice: 0, costPrice: 0, capacity: 0,
  departureDate: "", returnDate: "", highlights: "", notes: "",
};

const emptyGroupForm = {
  packageId: "", name: "", leader: "", leaderPhone: "",
  departureDate: "", returnDate: "", flightDetails: "", transportSchedule: "", notes: "",
};

const emptyPilgrimForm = {
  packageId: "", groupId: "", name: "", phone: "", email: "", dateOfBirth: "", gender: "male",
  passportNumber: "", passportExpiry: "", nidNumber: "", nationality: "Bangladeshi",
  mahramName: "", mahramRelation: "", mahramPilgrimId: "",
  roomType: "double" as HajjRoomType, roomNumber: "", roomPartners: "",
  status: "registered" as HajjPilgrimStatus, visaStatus: "not_started" as HajjVisaStatus,
  emergencyContact: "", emergencyPhone: "", medicalNotes: "", notes: "",
};

const emptyPayForm = { amount: 0, method: "cash", reference: "", date: new Date().toISOString().slice(0, 10), installmentLabel: "", note: "" };

const HajjUmrah = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [packages, setPackages] = useState<HajjPackage[]>([]);
  const [groups, setGroups] = useState<HajjGroup[]>([]);
  const [pilgrims, setPilgrims] = useState<HajjPilgrim[]>([]);
  const [payments, setPayments] = useState<HajjPilgrimPayment[]>([]);

  const [tab, setTab] = useState("packages");
  const [searchPilgrim, setSearchPilgrim] = useState("");
  const [filterPkgId, setFilterPkgId] = useState<string>("all");
  const [filterVisaStatus, setFilterVisaStatus] = useState<string>("all");

  const [pkgDialogOpen, setPkgDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [pilgrimDialogOpen, setPilgrimDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);

  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [selectedPilgrimId, setSelectedPilgrimId] = useState<string | null>(null);

  const [pkgForm, setPkgForm] = useState(emptyPkgForm);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [pilgrimForm, setPilgrimForm] = useState(emptyPilgrimForm);
  const [payForm, setPayForm] = useState(emptyPayForm);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true); setError(null);
      try {
        const [pkgs, grps, plgs] = await Promise.all([
          hajjApi.listPackages().catch(() => null),
          hajjApi.listGroups().catch(() => null),
          hajjApi.listPilgrims().catch(() => null),
        ]);
        if (pkgs) setPackages(pkgs);
        if (grps) setGroups(grps);
        if (plgs) setPilgrims(plgs);
      } catch {} finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // ── Summary ──
  const summary = useMemo(() => {
    const totalPilgrims = pilgrims.length;
    const totalRevenue = pilgrims.reduce((s, p) => s + p.totalAmount, 0);
    const totalCollected = pilgrims.reduce((s, p) => s + p.paidAmount, 0);
    const totalDue = pilgrims.reduce((s, p) => s + p.dueAmount, 0);
    const totalCost = packages.reduce((s, pk) => {
      const count = pilgrims.filter((p) => p.packageId === pk.id).length;
      return s + (pk.costPrice * count);
    }, 0);
    const grossProfit = totalRevenue - totalCost;
    const visaPending = pilgrims.filter((p) => p.visaStatus !== "approved").length;
    const docsPending = pilgrims.filter((p) => p.status === "documents_pending").length;
    return { totalPilgrims, totalRevenue, totalCollected, totalDue, grossProfit, totalCost, visaPending, docsPending };
  }, [pilgrims, packages]);

  // ── Package Profitability ──
  const pkgProfitability = useMemo(() => {
    return packages.map((pk) => {
      const enrolled = pilgrims.filter((p) => p.packageId === pk.id).length;
      const revenue = enrolled * pk.packagePrice;
      const cost = enrolled * pk.costPrice;
      return { ...pk, enrolled, revenue, cost, profit: revenue - cost };
    });
  }, [packages, pilgrims]);

  // ── Handlers ──
  const handlePkgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const profit = pkgForm.packagePrice - pkgForm.costPrice;
    if (editingPkgId) {
      try {
        await hajjApi.updatePackage(editingPkgId, { ...pkgForm, profit } as any).catch(() => null);
        setPackages((prev) => prev.map((p) => p.id === editingPkgId ? { ...p, ...pkgForm, profit, hotelClass: pkgForm.hotelClass as HajjPackage["hotelClass"] } : p));
        toast({ title: "Package updated" });
      } catch {}
    } else {
      try {
        const created = await hajjApi.createPackage({ ...pkgForm, profit } as any).catch(() => null);
        const newPkg = created || { ...pkgForm, profit, id: crypto.randomUUID(), enrolled: 0, tenantId: "", createdAt: new Date().toISOString().split("T")[0], hotelClass: pkgForm.hotelClass as HajjPackage["hotelClass"] } as HajjPackage;
        setPackages((prev) => [...prev, newPkg]);
        toast({ title: "Package created" });
      } catch {}
    }
    setPkgForm(emptyPkgForm);
    setEditingPkgId(null);
    setPkgDialogOpen(false);
  };

  const editPkg = (pkg: HajjPackage) => {
    setPkgForm({
      name: pkg.name, type: pkg.type, status: pkg.status,
      duration: pkg.duration, makkahNights: pkg.makkahNights, madinahNights: pkg.madinahNights,
      makkahHotel: pkg.makkahHotel || "", madinahHotel: pkg.madinahHotel || "",
      hotelClass: pkg.hotelClass, flightInfo: pkg.flightInfo || "",
      visaIncluded: pkg.visaIncluded, transportIncluded: pkg.transportIncluded,
      mealsIncluded: pkg.mealsIncluded, ziyaratIncluded: pkg.ziyaratIncluded,
      packagePrice: pkg.packagePrice, costPrice: pkg.costPrice,
      capacity: pkg.capacity, departureDate: pkg.departureDate || "", returnDate: pkg.returnDate || "",
      highlights: pkg.highlights || "", notes: pkg.notes || "",
    });
    setEditingPkgId(pkg.id);
    setPkgDialogOpen(true);
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGroupId) {
      await hajjApi.updateGroup(editingGroupId, groupForm as any).catch(() => null);
      setGroups((prev) => prev.map((g) => g.id === editingGroupId ? { ...g, ...groupForm } : g));
      toast({ title: "Group updated" });
    } else {
      const created = await hajjApi.createGroup(groupForm as any).catch(() => null);
      const newGroup: HajjGroup = created || { ...groupForm, id: crypto.randomUUID(), tenantId: "", createdAt: new Date().toISOString().split("T")[0] } as HajjGroup;
      setGroups((prev) => [...prev, newGroup]);
      toast({ title: "Group created" });
    }
    setGroupForm(emptyGroupForm);
    setEditingGroupId(null);
    setGroupDialogOpen(false);
  };

  const handlePilgrimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pkg = packages.find((p) => p.id === pilgrimForm.packageId);
    const totalAmount = pkg?.packagePrice || 0;
    const pilgrimData = {
      ...pilgrimForm, totalAmount, paidAmount: 0, dueAmount: totalAmount,
      paymentStatus: "unpaid" as const, departureStatus: "not_departed" as const,
    };
    const created = await hajjApi.createPilgrim(pilgrimData as any).catch(() => null);
    const newPilgrim: HajjPilgrim = created || { ...pilgrimData, id: crypto.randomUUID(), tenantId: "", createdAt: new Date().toISOString().split("T")[0] } as HajjPilgrim;
    setPilgrims((prev) => [...prev, newPilgrim]);
    toast({ title: "Pilgrim added", description: pilgrimForm.name });
    setPilgrimForm(emptyPilgrimForm);
    setPilgrimDialogOpen(false);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPilgrimId) return;
    const pilgrim = pilgrims.find((p) => p.id === selectedPilgrimId);
    if (!pilgrim) return;
    const payAmount = Math.min(payForm.amount, pilgrim.dueAmount);
    if (payAmount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    const payData = { ...payForm, amount: payAmount, pilgrimId: selectedPilgrimId };
    const created = await hajjApi.addPilgrimPayment(selectedPilgrimId, payData as any).catch(() => null);
    const newPay: HajjPilgrimPayment = created || { ...payData, id: crypto.randomUUID(), createdAt: new Date().toISOString().split("T")[0] } as HajjPilgrimPayment;
    setPayments((prev) => [...prev, newPay]);
    const newPaid = pilgrim.paidAmount + payAmount;
    const newDue = pilgrim.totalAmount - newPaid;
    setPilgrims((prev) => prev.map((p) => p.id === selectedPilgrimId ? {
      ...p, paidAmount: newPaid, dueAmount: Math.max(0, newDue),
      paymentStatus: newDue <= 0 ? "paid" : "partial",
    } : p));
    toast({ title: "Payment recorded", description: `৳${payAmount.toLocaleString()} — ${pilgrim.name}` });
    setPayForm(emptyPayForm);
    setPayDialogOpen(false);
  };

  // ── Helpers ──
  const getPkgName = (id: string) => packages.find((p) => p.id === id)?.name || "—";
  const getGroupName = (id: string) => groups.find((g) => g.id === id)?.name || "—";
  const getPilgrimCountForGroup = (groupId: string) => pilgrims.filter((p) => p.groupId === groupId).length;

  const filteredPilgrims = useMemo(() => {
    return pilgrims.filter((p) => {
      const matchSearch = !searchPilgrim ||
        p.name.toLowerCase().includes(searchPilgrim.toLowerCase()) ||
        p.phone.includes(searchPilgrim) ||
        p.passportNumber.toLowerCase().includes(searchPilgrim.toLowerCase());
      const matchPkg = filterPkgId === "all" || p.packageId === filterPkgId;
      const matchVisa = filterVisaStatus === "all" || p.visaStatus === filterVisaStatus;
      return matchSearch && matchPkg && matchVisa;
    });
  }, [pilgrims, searchPilgrim, filterPkgId, filterVisaStatus]);

  const selectedPilgrim = pilgrims.find((p) => p.id === selectedPilgrimId);
  const selectedPilgrimPayments = useMemo(() =>
    payments.filter((p) => p.pilgrimId === selectedPilgrimId), [payments, selectedPilgrimId]);

  const groupsForPilgrimForm = useMemo(() =>
    pilgrimForm.packageId ? groups.filter((g) => g.packageId === pilgrimForm.packageId) : [],
    [groups, pilgrimForm.packageId]);

  // ── Export ──
  const handleExport = () => {
    const headers = ["Name", "Phone", "Passport", "Package", "Group", "Visa", "Status", "Total", "Paid", "Due"];
    const rows = filteredPilgrims.map((p) => [
      p.name, p.phone, p.passportNumber, getPkgName(p.packageId), getGroupName(p.groupId),
      p.visaStatus, p.status, p.totalAmount.toString(), p.paidAmount.toString(), p.dueAmount.toString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "hajj-umrah-pilgrims.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Exported pilgrim list" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Moon className="h-8 w-8" /> {t("pages.hajjTitle")}
            </h1>
            <p className="text-muted-foreground">{t("pages.hajjSubtitle")}</p>
          </div>
          <div className="flex gap-2">
            <PermissionGate module="hajj_umrah" action="export">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-1 h-4 w-4" /> {t("pages.export")}
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Pilgrims</div>
              <p className="text-2xl font-bold">{summary.totalPilgrims}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Revenue</div>
              <p className="text-2xl font-bold">৳{summary.totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Collected</div>
              <p className="text-2xl font-bold text-green-600">৳{summary.totalCollected.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Outstanding</div>
              <p className="text-2xl font-bold text-destructive">৳{summary.totalDue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Gross Profit</div>
              <p className={`text-2xl font-bold ${summary.grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>৳{summary.grossProfit.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Packages</div>
              <p className="text-2xl font-bold">{packages.length}</p>
            </CardContent>
          </Card>
          <Card className={summary.visaPending > 0 ? "border-orange-300 dark:border-orange-600" : ""}>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Visa Pending</div>
              <p className="text-2xl font-bold">{summary.visaPending}</p>
            </CardContent>
          </Card>
          <Card className={summary.docsPending > 0 ? "border-yellow-300 dark:border-yellow-600" : ""}>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Docs Pending</div>
              <p className="text-2xl font-bold">{summary.docsPending}</p>
            </CardContent>
          </Card>
        </div>

        {error ? <ErrorState message={error} /> : null}
        {!loading && packages.length === 0 && groups.length === 0 && pilgrims.length === 0 ? (
          <EmptyState title="No Hajj / Umrah data yet" description="Create your first package, group, and pilgrim to start managing operations." />
        ) : null}
        {loading ? <LoadingState rows={6} /> : null}

        {!loading && (
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="grid grid-cols-4 md:w-[520px]">
              <TabsTrigger value="packages">Packages</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="pilgrims">Pilgrims</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="packages" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Packages</h2>
                  <p className="text-sm text-muted-foreground">Create and price your Hajj / Umrah packages.</p>
                </div>
                <PermissionGate module="hajj_umrah" action="create">
                  <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
                    <DialogTrigger asChild>
                      <Button><Plus className="mr-2 h-4 w-4" /> Add Package</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader><DialogTitle>{editingPkgId ? "Edit Package" : "Create Package"}</DialogTitle></DialogHeader>
                      <form onSubmit={handlePkgSubmit} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2"><Label>Name</Label><Input value={pkgForm.name} onChange={(e) => setPkgForm((v) => ({ ...v, name: e.target.value }))} required /></div>
                          <div className="space-y-2"><Label>Type</Label>
                            <Select value={pkgForm.type} onValueChange={(value: HajjPackageType) => setPkgForm((v) => ({ ...v, type: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="hajj">Hajj</SelectItem><SelectItem value="umrah">Umrah</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2"><Label>Status</Label>
                            <Select value={pkgForm.status} onValueChange={(value: HajjPackageStatus) => setPkgForm((v) => ({ ...v, status: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{PKG_STATUS_META.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2"><Label>Duration</Label><Input value={pkgForm.duration} onChange={(e) => setPkgForm((v) => ({ ...v, duration: e.target.value }))} placeholder="40 Days" /></div>
                          <div className="space-y-2"><Label>Makkah Nights</Label><Input type="number" min={0} value={pkgForm.makkahNights} onChange={(e) => setPkgForm((v) => ({ ...v, makkahNights: Number(e.target.value || 0) }))} /></div>
                          <div className="space-y-2"><Label>Madinah Nights</Label><Input type="number" min={0} value={pkgForm.madinahNights} onChange={(e) => setPkgForm((v) => ({ ...v, madinahNights: Number(e.target.value || 0) }))} /></div>
                          <div className="space-y-2"><Label>Makkah Hotel</Label><Input value={pkgForm.makkahHotel} onChange={(e) => setPkgForm((v) => ({ ...v, makkahHotel: e.target.value }))} /></div>
                          <div className="space-y-2"><Label>Madinah Hotel</Label><Input value={pkgForm.madinahHotel} onChange={(e) => setPkgForm((v) => ({ ...v, madinahHotel: e.target.value }))} /></div>
                          <div className="space-y-2"><Label>Hotel Class</Label>
                            <Select value={pkgForm.hotelClass} onValueChange={(value) => setPkgForm((v) => ({ ...v, hotelClass: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{HOTEL_CLASSES.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2"><Label>Flight Info</Label><Input value={pkgForm.flightInfo} onChange={(e) => setPkgForm((v) => ({ ...v, flightInfo: e.target.value }))} /></div>
                          <div className="space-y-2"><Label>Package Price</Label><Input type="number" min={0} value={pkgForm.packagePrice} onChange={(e) => setPkgForm((v) => ({ ...v, packagePrice: Number(e.target.value || 0) }))} /></div>
                          <div className="space-y-2"><Label>Cost Price</Label><Input type="number" min={0} value={pkgForm.costPrice} onChange={(e) => setPkgForm((v) => ({ ...v, costPrice: Number(e.target.value || 0) }))} /></div>
                          <div className="space-y-2"><Label>Capacity</Label><Input type="number" min={0} value={pkgForm.capacity} onChange={(e) => setPkgForm((v) => ({ ...v, capacity: Number(e.target.value || 0) }))} /></div>
                          <div className="space-y-2"><Label>Departure Date</Label><Input type="date" value={pkgForm.departureDate} onChange={(e) => setPkgForm((v) => ({ ...v, departureDate: e.target.value }))} /></div>
                          <div className="space-y-2"><Label>Return Date</Label><Input type="date" value={pkgForm.returnDate} onChange={(e) => setPkgForm((v) => ({ ...v, returnDate: e.target.value }))} /></div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-3 rounded-lg border p-4">
                            <div className="flex items-center justify-between"><Label htmlFor="visaIncluded">Visa Included</Label><Switch id="visaIncluded" checked={pkgForm.visaIncluded} onCheckedChange={(checked) => setPkgForm((v) => ({ ...v, visaIncluded: checked }))} /></div>
                            <div className="flex items-center justify-between"><Label htmlFor="transportIncluded">Transport Included</Label><Switch id="transportIncluded" checked={pkgForm.transportIncluded} onCheckedChange={(checked) => setPkgForm((v) => ({ ...v, transportIncluded: checked }))} /></div>
                            <div className="flex items-center justify-between"><Label htmlFor="mealsIncluded">Meals Included</Label><Switch id="mealsIncluded" checked={pkgForm.mealsIncluded} onCheckedChange={(checked) => setPkgForm((v) => ({ ...v, mealsIncluded: checked }))} /></div>
                            <div className="flex items-center justify-between"><Label htmlFor="ziyaratIncluded">Ziyarat Included</Label><Switch id="ziyaratIncluded" checked={pkgForm.ziyaratIncluded} onCheckedChange={(checked) => setPkgForm((v) => ({ ...v, ziyaratIncluded: checked }))} /></div>
                          </div>
                          <div className="space-y-2">
                            <Label>Highlights</Label>
                            <Textarea rows={5} value={pkgForm.highlights} onChange={(e) => setPkgForm((v) => ({ ...v, highlights: e.target.value }))} placeholder="e.g. 5-Star Hotels, Private Transport" />
                          </div>
                        </div>
                        <div className="space-y-2"><Label>Notes</Label><Textarea rows={3} value={pkgForm.notes} onChange={(e) => setPkgForm((v) => ({ ...v, notes: e.target.value }))} /></div>
                        <div className="flex justify-end gap-2">
                          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                          <Button type="submit">{editingPkgId ? "Update Package" : "Create Package"}</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </PermissionGate>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {packages.map((pkg) => {
                  const meta = getStatusMeta(PKG_STATUS_META, pkg.status);
                  const occupancy = pkg.capacity > 0 ? Math.round((pkg.enrolled / pkg.capacity) * 100) : 0;
                  return (
                    <Card key={pkg.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Moon className="h-4 w-4" /> {pkg.name}
                            </CardTitle>
                            <CardDescription>{pkg.type.toUpperCase()} • {pkg.duration}</CardDescription>
                          </div>
                          <Badge className={meta.color}>{meta.label}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div><span className="text-muted-foreground">Price:</span><div className="font-medium">৳{pkg.packagePrice.toLocaleString()}</div></div>
                          <div><span className="text-muted-foreground">Profit:</span><div className="font-medium text-green-600">৳{pkg.profit.toLocaleString()}</div></div>
                          <div><span className="text-muted-foreground">Hotels:</span><div className="font-medium">{pkg.hotelClass.replace("_", "-")}</div></div>
                          <div><span className="text-muted-foreground">Flight:</span><div className="font-medium line-clamp-1">{pkg.flightInfo || "—"}</div></div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1"><span>Enrollment</span><span>{pkg.enrolled}/{pkg.capacity}</span></div>
                          <Progress value={occupancy} />
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {pkg.visaIncluded && <Badge variant="secondary">Visa</Badge>}
                          {pkg.transportIncluded && <Badge variant="secondary">Transport</Badge>}
                          {pkg.mealsIncluded && <Badge variant="secondary">Meals</Badge>}
                          {pkg.ziyaratIncluded && <Badge variant="secondary">Ziyarat</Badge>}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground flex items-center gap-1"><Plane className="h-3 w-3" /> {pkg.departureDate || "TBA"}</div>
                          <PermissionGate module="hajj_umrah" action="edit">
                            <Button variant="outline" size="sm" onClick={() => editPkg(pkg)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                          </PermissionGate>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="groups" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Groups</h2>
                  <p className="text-sm text-muted-foreground">Organize pilgrims into departure batches and assign leaders.</p>
                </div>
                <PermissionGate module="hajj_umrah" action="create">
                  <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
                    <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Group</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{editingGroupId ? "Edit Group" : "Create Group"}</DialogTitle></DialogHeader>
                      <form onSubmit={handleGroupSubmit} className="space-y-4">
                        <div className="space-y-2"><Label>Package</Label>
                          <Select value={groupForm.packageId} onValueChange={(value) => setGroupForm((v) => ({ ...v, packageId: value }))}>
                            <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                            <SelectContent>{packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2"><Label>Group Name</Label><Input value={groupForm.name} onChange={(e) => setGroupForm((v) => ({ ...v, name: e.target.value }))} required /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2"><Label>Leader</Label><Input value={groupForm.leader} onChange={(e) => setGroupForm((v) => ({ ...v, leader: e.target.value }))} /></div>
                          <div className="space-y-2"><Label>Leader Phone</Label><Input value={groupForm.leaderPhone} onChange={(e) => setGroupForm((v) => ({ ...v, leaderPhone: e.target.value }))} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2"><Label>Departure</Label><Input type="date" value={groupForm.departureDate} onChange={(e) => setGroupForm((v) => ({ ...v, departureDate: e.target.value }))} /></div>
                          <div className="space-y-2"><Label>Return</Label><Input type="date" value={groupForm.returnDate} onChange={(e) => setGroupForm((v) => ({ ...v, returnDate: e.target.value }))} /></div>
                        </div>
                        <div className="space-y-2"><Label>Flight Details</Label><Input value={groupForm.flightDetails} onChange={(e) => setGroupForm((v) => ({ ...v, flightDetails: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Transport Schedule</Label><Input value={groupForm.transportSchedule} onChange={(e) => setGroupForm((v) => ({ ...v, transportSchedule: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Notes</Label><Textarea value={groupForm.notes} onChange={(e) => setGroupForm((v) => ({ ...v, notes: e.target.value }))} rows={3} /></div>
                        <div className="flex justify-end gap-2"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit">Save Group</Button></div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </PermissionGate>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groups.map((g) => (
                  <Card key={g.id}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2"><Users className="h-4 w-4" /> {g.name}</CardTitle>
                      <CardDescription>{getPkgName(g.packageId)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div><span className="text-muted-foreground">Leader:</span><div className="font-medium">{g.leader || "—"}</div></div>
                        <div><span className="text-muted-foreground">Phone:</span><div className="font-medium">{g.leaderPhone || "—"}</div></div>
                        <div><span className="text-muted-foreground">Departure:</span><div className="font-medium">{g.departureDate}</div></div>
                        <div><span className="text-muted-foreground">Return:</span><div className="font-medium">{g.returnDate}</div></div>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <UserPlus className="h-3.5 w-3.5" /> {getPilgrimCountForGroup(g.id)} pilgrims
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="pilgrims" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Pilgrims</h2>
                  <p className="text-sm text-muted-foreground">Track pilgrim profile, visa status, rooming, and payments.</p>
                </div>
                <div className="flex gap-2">
                  <PermissionGate module="hajj_umrah" action="create">
                    <Dialog open={pilgrimDialogOpen} onOpenChange={setPilgrimDialogOpen}>
                      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Pilgrim</Button></DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader><DialogTitle>Add Pilgrim</DialogTitle></DialogHeader>
                        <form onSubmit={handlePilgrimSubmit} className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2"><Label>Package</Label>
                              <Select value={pilgrimForm.packageId} onValueChange={(value) => setPilgrimForm((v) => ({ ...v, packageId: value, groupId: "" }))}>
                                <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                                <SelectContent>{packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2"><Label>Group</Label>
                              <Select value={pilgrimForm.groupId} onValueChange={(value) => setPilgrimForm((v) => ({ ...v, groupId: value }))}>
                                <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                                <SelectContent>{groupsForPilgrimForm.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2"><Label>Name</Label><Input value={pilgrimForm.name} onChange={(e) => setPilgrimForm((v) => ({ ...v, name: e.target.value }))} required /></div>
                            <div className="space-y-2"><Label>Phone</Label><Input value={pilgrimForm.phone} onChange={(e) => setPilgrimForm((v) => ({ ...v, phone: e.target.value }))} required /></div>
                            <div className="space-y-2"><Label>Email</Label><Input value={pilgrimForm.email} onChange={(e) => setPilgrimForm((v) => ({ ...v, email: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={pilgrimForm.dateOfBirth} onChange={(e) => setPilgrimForm((v) => ({ ...v, dateOfBirth: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Gender</Label>
                              <Select value={pilgrimForm.gender} onValueChange={(value) => setPilgrimForm((v) => ({ ...v, gender: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2"><Label>Nationality</Label><Input value={pilgrimForm.nationality} onChange={(e) => setPilgrimForm((v) => ({ ...v, nationality: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Passport Number</Label><Input value={pilgrimForm.passportNumber} onChange={(e) => setPilgrimForm((v) => ({ ...v, passportNumber: e.target.value }))} required /></div>
                            <div className="space-y-2"><Label>Passport Expiry</Label><Input type="date" value={pilgrimForm.passportExpiry} onChange={(e) => setPilgrimForm((v) => ({ ...v, passportExpiry: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>NID Number</Label><Input value={pilgrimForm.nidNumber} onChange={(e) => setPilgrimForm((v) => ({ ...v, nidNumber: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Room Type</Label>
                              <Select value={pilgrimForm.roomType} onValueChange={(value: HajjRoomType) => setPilgrimForm((v) => ({ ...v, roomType: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{ROOM_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2"><Label>Mahram Name</Label><Input value={pilgrimForm.mahramName} onChange={(e) => setPilgrimForm((v) => ({ ...v, mahramName: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Mahram Relation</Label><Input value={pilgrimForm.mahramRelation} onChange={(e) => setPilgrimForm((v) => ({ ...v, mahramRelation: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Emergency Contact</Label><Input value={pilgrimForm.emergencyContact} onChange={(e) => setPilgrimForm((v) => ({ ...v, emergencyContact: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Emergency Phone</Label><Input value={pilgrimForm.emergencyPhone} onChange={(e) => setPilgrimForm((v) => ({ ...v, emergencyPhone: e.target.value }))} /></div>
                          </div>
                          <div className="space-y-2"><Label>Medical Notes</Label><Textarea rows={3} value={pilgrimForm.medicalNotes} onChange={(e) => setPilgrimForm((v) => ({ ...v, medicalNotes: e.target.value }))} /></div>
                          <div className="space-y-2"><Label>Notes</Label><Textarea rows={3} value={pilgrimForm.notes} onChange={(e) => setPilgrimForm((v) => ({ ...v, notes: e.target.value }))} /></div>
                          <div className="flex justify-end gap-2"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit">Save Pilgrim</Button></div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </PermissionGate>
                </div>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="relative md:col-span-2">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" placeholder="Search name / phone / passport" value={searchPilgrim} onChange={(e) => setSearchPilgrim(e.target.value)} />
                    </div>
                    <Select value={filterPkgId} onValueChange={setFilterPkgId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Packages</SelectItem>
                        {packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterVisaStatus} onValueChange={setFilterVisaStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Visa Status</SelectItem>
                        {VISA_STATUS_META.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Package / Group</TableHead>
                        <TableHead>Passport</TableHead>
                        <TableHead>Visa</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPilgrims.map((p) => {
                        const st = getStatusMeta(PILGRIM_STATUS_META, p.status);
                        const vs = getStatusMeta(VISA_STATUS_META, p.visaStatus);
                        const paidPct = p.totalAmount > 0 ? Math.round((p.paidAmount / p.totalAmount) * 100) : 0;
                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="font-medium">{p.name}</div>
                              <div className="text-xs text-muted-foreground">{p.phone}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{getPkgName(p.packageId)}</div>
                              <div className="text-xs text-muted-foreground">{getGroupName(p.groupId)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{p.passportNumber}</div>
                              <div className="text-xs text-muted-foreground">Exp: {p.passportExpiry || "—"}</div>
                            </TableCell>
                            <TableCell><Badge className={vs.color}>{vs.label}</Badge></TableCell>
                            <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">৳{p.paidAmount.toLocaleString()} / ৳{p.totalAmount.toLocaleString()}</div>
                              <Progress value={paidPct} className="mt-2 h-2" />
                              <div className="text-xs text-muted-foreground mt-1">Due: ৳{p.dueAmount.toLocaleString()}</div>
                            </TableCell>
                            <TableCell>{p.roomType || "—"}{p.roomNumber ? ` / ${p.roomNumber}` : ""}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={async () => {
                                  setSelectedPilgrimId(p.id);
                                  const pays = await hajjApi.listPilgrimPayments(p.id).catch(() => []);
                                  setPayments((prev) => [...prev.filter((x) => x.pilgrimId !== p.id), ...pays]);
                                }}><Eye className="mr-1 h-3.5 w-3.5" /> View</Button>
                                <PermissionGate module="hajj_umrah" action="create">
                                  <Button variant="secondary" size="sm" onClick={async () => {
                                    setSelectedPilgrimId(p.id);
                                    const pays = await hajjApi.listPilgrimPayments(p.id).catch(() => []);
                                    setPayments((prev) => [...prev.filter((x) => x.pilgrimId !== p.id), ...pays]);
                                    setPayDialogOpen(true);
                                  }}><CreditCard className="mr-1 h-3.5 w-3.5" /> Pay</Button>
                                </PermissionGate>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {selectedPilgrim ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pilgrim Detail — {selectedPilgrim.name}</CardTitle>
                    <CardDescription>{getPkgName(selectedPilgrim.packageId)} • {getGroupName(selectedPilgrim.groupId)}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
                      <div><div className="text-muted-foreground">Passport</div><div className="font-medium">{selectedPilgrim.passportNumber}</div></div>
                      <div><div className="text-muted-foreground">NID</div><div className="font-medium">{selectedPilgrim.nidNumber || "—"}</div></div>
                      <div><div className="text-muted-foreground">Mahram</div><div className="font-medium">{selectedPilgrim.mahramName || "—"}</div></div>
                      <div><div className="text-muted-foreground">Room</div><div className="font-medium">{selectedPilgrim.roomType || "—"} {selectedPilgrim.roomNumber ? `• ${selectedPilgrim.roomNumber}` : ""}</div></div>
                    </div>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3">Payments</h3>
                      <div className="space-y-2">
                        {selectedPilgrimPayments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No payments recorded.</p>
                        ) : selectedPilgrimPayments.map((pay) => (
                          <div key={pay.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                            <div>
                              <div className="font-medium">৳{pay.amount.toLocaleString()} • {pay.method}</div>
                              <div className="text-xs text-muted-foreground">{pay.date} {pay.installmentLabel ? `• ${pay.installmentLabel}` : ""} {pay.reference ? `• ${pay.reference}` : ""}</div>
                            </div>
                            <Badge variant="secondary">Received</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record Payment {selectedPilgrim ? `— ${selectedPilgrim.name}` : ""}</DialogTitle></DialogHeader>
                  <form onSubmit={handlePaySubmit} className="space-y-4">
                    <div className="space-y-2"><Label>Amount</Label><Input type="number" min={0} value={payForm.amount} onChange={(e) => setPayForm((v) => ({ ...v, amount: Number(e.target.value || 0) }))} /></div>
                    <div className="space-y-2"><Label>Method</Label>
                      <Select value={payForm.method} onValueChange={(value) => setPayForm((v) => ({ ...v, method: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Reference</Label><Input value={payForm.reference} onChange={(e) => setPayForm((v) => ({ ...v, reference: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={payForm.date} onChange={(e) => setPayForm((v) => ({ ...v, date: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Installment Label</Label><Input value={payForm.installmentLabel} onChange={(e) => setPayForm((v) => ({ ...v, installmentLabel: e.target.value }))} placeholder="1st Installment" /></div>
                    <div className="space-y-2"><Label>Note</Label><Textarea rows={3} value={payForm.note} onChange={(e) => setPayForm((v) => ({ ...v, note: e.target.value }))} /></div>
                    <div className="flex justify-end gap-2"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit">Record Payment</Button></div>
                  </form>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Package Profitability</CardTitle>
                    <CardDescription>Revenue, cost, and profit per package</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Package</TableHead>
                          <TableHead>Enrolled</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Cost</TableHead>
                          <TableHead>Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pkgProfitability.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.enrolled}</TableCell>
                            <TableCell>৳{row.revenue.toLocaleString()}</TableCell>
                            <TableCell>৳{row.cost.toLocaleString()}</TableCell>
                            <TableCell className={row.profit >= 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>৳{row.profit.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Operational Alerts</CardTitle>
                    <CardDescription>Actionable items that need team attention</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border p-3 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Documents Pending</div>
                        <div className="text-sm text-muted-foreground">{summary.docsPending} pilgrim(s) are still waiting for complete documents.</div>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 flex items-start gap-3">
                      <Shield className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Visa Pending</div>
                        <div className="text-sm text-muted-foreground">{summary.visaPending} pilgrim(s) do not yet have approved visas.</div>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 flex items-start gap-3">
                      <CreditCard className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Outstanding Dues</div>
                        <div className="text-sm text-muted-foreground">Current outstanding amount is ৳{summary.totalDue.toLocaleString()} across all pilgrims.</div>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Capacity Watch</div>
                        <div className="text-sm text-muted-foreground">{packages.filter((p) => p.capacity > 0 && p.enrolled >= p.capacity).length} package(s) are already full.</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HajjUmrah;
