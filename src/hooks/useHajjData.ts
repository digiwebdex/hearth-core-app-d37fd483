import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  hajjApi,
  type HajjGroup,
  type HajjPackage,
  type HajjPilgrim,
} from "@/lib/hajjApi";
import type { HajjGroupFormState, HajjPackageFormState, HajjPackageProfitRow, HajjSummary } from "@/components/hajj/types";

export function useHajjData() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<HajjPackage[]>([]);
  const [groups, setGroups] = useState<HajjGroup[]>([]);
  const [pilgrims, setPilgrims] = useState<HajjPilgrim[]>([]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgs, grps, plgs] = await Promise.all([
        hajjApi.listPackages().catch(() => [] as HajjPackage[]),
        hajjApi.listGroups().catch(() => [] as HajjGroup[]),
        hajjApi.listPilgrims().catch(() => [] as HajjPilgrim[]),
      ]);
      setPackages(pkgs);
      setGroups(grps);
      setPilgrims(plgs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("hajjForm.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const getPackageName = useCallback(
    (id: string) => packages.find((p) => p.id === id)?.name ?? "—",
    [packages],
  );

  const getGroupName = useCallback(
    (id: string) => groups.find((g) => g.id === id)?.name ?? "—",
    [groups],
  );

  const getPilgrimCountForGroup = useCallback(
    (groupId: string) => pilgrims.filter((p) => p.groupId === groupId).length,
    [pilgrims],
  );

  const summary: HajjSummary = useMemo(() => {
    const totalPilgrims = pilgrims.length;
    const totalRevenue = pilgrims.reduce((s, p) => s + p.totalAmount, 0);
    const totalCollected = pilgrims.reduce((s, p) => s + p.paidAmount, 0);
    const totalDue = pilgrims.reduce((s, p) => s + p.dueAmount, 0);
    const totalCost = packages.reduce((s, pk) => {
      const count = pilgrims.filter((p) => p.packageId === pk.id).length;
      return s + pk.costPrice * count;
    }, 0);
    return {
      totalPilgrims,
      totalRevenue,
      totalCollected,
      totalDue,
      grossProfit: totalRevenue - totalCost,
      totalCost,
      visaPending: pilgrims.filter((p) => p.visaStatus !== "approved").length,
      docsPending: pilgrims.filter((p) => p.status === "documents_pending").length,
    };
  }, [pilgrims, packages]);

  const pkgProfitability: HajjPackageProfitRow[] = useMemo(
    () =>
      packages.map((pk) => {
        const enrolled = pilgrims.filter((p) => p.packageId === pk.id).length;
        const revenue = enrolled * pk.packagePrice;
        const cost = enrolled * pk.costPrice;
        return { id: pk.id, name: pk.name, enrolled, revenue, cost, profit: revenue - cost };
      }),
    [packages, pilgrims],
  );

  const savePackage = async (form: HajjPackageFormState, editingId: string | null) => {
    const profit = form.packagePrice - form.costPrice;
    const payload = {
      ...form,
      profit,
      hotelClass: form.hotelClass as HajjPackage["hotelClass"],
    };
    if (editingId) {
      const updated = await hajjApi.updatePackage(editingId, payload).catch(() => null);
      setPackages((prev) =>
        prev.map((p) =>
          p.id === editingId ? { ...p, ...form, profit, hotelClass: payload.hotelClass } : p,
        ),
      );
      if (updated) setPackages((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
      toast({ title: t("hajjForm.packageUpdated") });
    } else {
      const created = await hajjApi.createPackage(payload).catch(() => null);
      const newPkg: HajjPackage =
        created ?? {
          ...form,
          profit,
          id: crypto.randomUUID(),
          enrolled: 0,
          tenantId: "",
          createdAt: new Date().toISOString().split("T")[0],
          hotelClass: payload.hotelClass,
        };
      setPackages((prev) => [...prev, newPkg]);
      toast({ title: t("hajjForm.packageCreated") });
    }
  };

  const saveGroup = async (form: HajjGroupFormState, editingId: string | null) => {
    if (editingId) {
      await hajjApi.updateGroup(editingId, form).catch(() => null);
      setGroups((prev) => prev.map((g) => (g.id === editingId ? { ...g, ...form } : g)));
      toast({ title: t("hajjForm.groupUpdated") });
    } else {
      const created = await hajjApi.createGroup(form).catch(() => null);
      const newGroup: HajjGroup =
        created ?? {
          ...form,
          id: crypto.randomUUID(),
          tenantId: "",
          createdAt: new Date().toISOString().split("T")[0],
        };
      setGroups((prev) => [...prev, newGroup]);
      toast({ title: t("hajjForm.groupCreated") });
    }
  };

  const deleteGroup = async (id: string) => {
    await hajjApi.deleteGroup(id).catch(() => null);
    setGroups((prev) => prev.filter((g) => g.id !== id));
    toast({ title: t("hajjForm.groupDeleted"), variant: "destructive" });
  };

  return {
    loading,
    error,
    packages,
    groups,
    pilgrims,
    setPilgrims,
    refetch,
    getPackageName,
    getGroupName,
    getPilgrimCountForGroup,
    summary,
    pkgProfitability,
    savePackage,
    saveGroup,
    deleteGroup,
  };
}
