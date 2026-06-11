import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import {
  hajjApi,
  type HajjGroup,
  type HajjPackage,
  type HajjPilgrim,
  type HajjPilgrimPayment,
} from "@/lib/hajjApi";
import {
  defaultPilgrimFilters,
  emptyPayForm,
  emptyPilgrimForm,
  PAGE_SIZE_OPTIONS,
} from "@/components/hajj/constants";
import type { HajjPayFormState, HajjPilgrimFilterState, HajjPilgrimFormState } from "@/components/hajj/types";

interface UseHajjPilgrimArgs {
  packages: HajjPackage[];
  groups: HajjGroup[];
  pilgrims: HajjPilgrim[];
  setPilgrims: React.Dispatch<React.SetStateAction<HajjPilgrim[]>>;
  getPackageName: (id: string) => string;
  getGroupName: (id: string) => string;
}

export function useHajjPilgrim({
  packages,
  groups,
  pilgrims,
  setPilgrims,
  getPackageName,
  getGroupName,
}: UseHajjPilgrimArgs) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [filters, setFilters] = useState<HajjPilgrimFilterState>(defaultPilgrimFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [payments, setPayments] = useState<HajjPilgrimPayment[]>([]);
  const [selectedPilgrimId, setSelectedPilgrimId] = useState<string | null>(null);
  const [pilgrimDialogOpen, setPilgrimDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [editingPilgrimId, setEditingPilgrimId] = useState<string | null>(null);
  const [pilgrimForm, setPilgrimForm] = useState<HajjPilgrimFormState>(emptyPilgrimForm);
  const [payForm, setPayForm] = useState<HajjPayFormState>(emptyPayForm);

  const filteredPilgrims = useMemo(() => {
    return pilgrims.filter((p) => {
      const q = filters.search.toLowerCase();
      const matchSearch =
        !filters.search ||
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(filters.search) ||
        p.passportNumber.toLowerCase().includes(q);
      const matchPkg = filters.packageId === "all" || p.packageId === filters.packageId;
      const matchGroup = filters.groupId === "all" || p.groupId === filters.groupId;
      const matchVisa = filters.visaStatus === "all" || p.visaStatus === filters.visaStatus;
      const matchStatus = filters.pilgrimStatus === "all" || p.status === filters.pilgrimStatus;
      const created = p.createdAt?.slice(0, 10) ?? "";
      const matchFrom = !filters.dateFrom || created >= filters.dateFrom;
      const matchTo = !filters.dateTo || created <= filters.dateTo;
      return matchSearch && matchPkg && matchGroup && matchVisa && matchStatus && matchFrom && matchTo;
    });
  }, [pilgrims, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredPilgrims.length / pageSize));

  const paginatedPilgrims = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPilgrims.slice(start, start + pageSize);
  }, [filteredPilgrims, page, pageSize]);

  const selectedPilgrim = pilgrims.find((p) => p.id === selectedPilgrimId) ?? null;
  const selectedPilgrimPayments = useMemo(
    () => payments.filter((p) => p.pilgrimId === selectedPilgrimId),
    [payments, selectedPilgrimId],
  );

  const groupsForPilgrimForm = useMemo(
    () => (pilgrimForm.packageId ? groups.filter((g) => g.packageId === pilgrimForm.packageId) : []),
    [groups, pilgrimForm.packageId],
  );

  const loadPaymentsForPilgrim = useCallback(async (pilgrimId: string) => {
    const pays = await hajjApi.listPilgrimPayments(pilgrimId).catch(() => [] as HajjPilgrimPayment[]);
    setPayments((prev) => [...prev.filter((x) => x.pilgrimId !== pilgrimId), ...pays]);
  }, []);

  const selectPilgrim = useCallback(
    async (pilgrimId: string) => {
      setSelectedPilgrimId(pilgrimId);
      await loadPaymentsForPilgrim(pilgrimId);
    },
    [loadPaymentsForPilgrim],
  );

  const openCreatePilgrim = () => {
    setPilgrimForm(emptyPilgrimForm);
    setEditingPilgrimId(null);
    setPilgrimDialogOpen(true);
  };

  const openEditPilgrim = (pilgrim: HajjPilgrim) => {
    setPilgrimForm({
      packageId: pilgrim.packageId,
      groupId: pilgrim.groupId,
      name: pilgrim.name,
      phone: pilgrim.phone,
      email: pilgrim.email ?? "",
      dateOfBirth: pilgrim.dateOfBirth ?? "",
      gender: pilgrim.gender ?? "male",
      passportNumber: pilgrim.passportNumber,
      passportExpiry: pilgrim.passportExpiry ?? "",
      nidNumber: pilgrim.nidNumber ?? "",
      nationality: pilgrim.nationality ?? "Bangladeshi",
      mahramName: pilgrim.mahramName ?? "",
      mahramRelation: pilgrim.mahramRelation ?? "",
      mahramPilgrimId: pilgrim.mahramPilgrimId ?? "",
      roomType: pilgrim.roomType ?? "double",
      roomNumber: pilgrim.roomNumber ?? "",
      roomPartners: pilgrim.roomPartners ?? "",
      status: pilgrim.status,
      visaStatus: pilgrim.visaStatus,
      emergencyContact: pilgrim.emergencyContact ?? "",
      emergencyPhone: pilgrim.emergencyPhone ?? "",
      medicalNotes: pilgrim.medicalNotes ?? "",
      notes: pilgrim.notes ?? "",
    });
    setEditingPilgrimId(pilgrim.id);
    setPilgrimDialogOpen(true);
  };

  const submitPilgrim = async (e: React.FormEvent) => {
    e.preventDefault();
    const pkg = packages.find((p) => p.id === pilgrimForm.packageId);
    if (editingPilgrimId) {
      const updated = await hajjApi.updatePilgrim(editingPilgrimId, pilgrimForm).catch(() => null);
      setPilgrims((prev) =>
        prev.map((p) => (p.id === editingPilgrimId ? { ...p, ...pilgrimForm, ...(updated ?? {}) } : p)),
      );
      toast({ title: t("hajjForm.pilgrimUpdated") });
    } else {
      const totalAmount = pkg?.packagePrice ?? 0;
      const pilgrimData = {
        ...pilgrimForm,
        totalAmount,
        paidAmount: 0,
        dueAmount: totalAmount,
        paymentStatus: "unpaid" as const,
        departureStatus: "not_departed" as const,
      };
      const created = await hajjApi.createPilgrim(pilgrimData).catch(() => null);
      const newPilgrim: HajjPilgrim =
        created ?? {
          ...pilgrimData,
          id: crypto.randomUUID(),
          tenantId: "",
          createdAt: new Date().toISOString().split("T")[0],
        };
      setPilgrims((prev) => [...prev, newPilgrim]);
      toast({ title: t("hajjForm.pilgrimCreated"), description: pilgrimForm.name });
    }
    setPilgrimForm(emptyPilgrimForm);
    setEditingPilgrimId(null);
    setPilgrimDialogOpen(false);
  };

  const deletePilgrim = async (id: string) => {
    await hajjApi.deletePilgrim(id).catch(() => null);
    setPilgrims((prev) => prev.filter((p) => p.id !== id));
    if (selectedPilgrimId === id) setSelectedPilgrimId(null);
    toast({ title: t("hajjForm.pilgrimDeleted"), variant: "destructive" });
  };

  const openPayDialog = async (pilgrimId: string) => {
    setSelectedPilgrimId(pilgrimId);
    await loadPaymentsForPilgrim(pilgrimId);
    setPayForm(emptyPayForm);
    setPayDialogOpen(true);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPilgrimId) return;
    const pilgrim = pilgrims.find((p) => p.id === selectedPilgrimId);
    if (!pilgrim) return;
    const payAmount = Math.min(payForm.amount, pilgrim.dueAmount);
    if (payAmount <= 0) {
      toast({ title: t("hajjForm.invalidAmount"), variant: "destructive" });
      return;
    }
    const payData = { ...payForm, amount: payAmount, pilgrimId: selectedPilgrimId };
    const created = await hajjApi.addPilgrimPayment(selectedPilgrimId, payData).catch(() => null);
    const newPay: HajjPilgrimPayment =
      created ?? {
        ...payData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString().split("T")[0],
      };
    setPayments((prev) => [...prev, newPay]);
    const newPaid = pilgrim.paidAmount + payAmount;
    const newDue = pilgrim.totalAmount - newPaid;
    setPilgrims((prev) =>
      prev.map((p) =>
        p.id === selectedPilgrimId
          ? {
              ...p,
              paidAmount: newPaid,
              dueAmount: Math.max(0, newDue),
              paymentStatus: newDue <= 0 ? "paid" : "partial",
            }
          : p,
      ),
    );
    toast({
      title: t("hajjForm.paymentRecorded"),
      description: `৳${payAmount.toLocaleString()} — ${pilgrim.name}`,
    });
    setPayForm(emptyPayForm);
    setPayDialogOpen(false);
  };

  const exportPilgrimsCsv = () => {
    const headers = ["Name", "Phone", "Passport", "Package", "Group", "Visa", "Status", "Total", "Paid", "Due"];
    const rows = filteredPilgrims.map((p) => [
      p.name,
      p.phone,
      p.passportNumber,
      getPackageName(p.packageId),
      getGroupName(p.groupId),
      p.visaStatus,
      p.status,
      String(p.totalAmount),
      String(p.paidAmount),
      String(p.dueAmount),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hajj-umrah-pilgrims.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: t("hajjForm.exported") });
  };

  const updateFilters = (patch: Partial<HajjPilgrimFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  return {
    filters,
    setFilters: updateFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    filteredPilgrims,
    paginatedPilgrims,
    totalPages,
    selectedPilgrimId,
    selectedPilgrim,
    selectedPilgrimPayments,
    selectPilgrim,
    pilgrimDialogOpen,
    setPilgrimDialogOpen,
    payDialogOpen,
    setPayDialogOpen,
    editingPilgrimId,
    pilgrimForm,
    setPilgrimForm,
    payForm,
    setPayForm,
    groupsForPilgrimForm,
    openCreatePilgrim,
    openEditPilgrim,
    submitPilgrim,
    deletePilgrim,
    openPayDialog,
    submitPayment,
    exportPilgrimsCsv,
  };
}
