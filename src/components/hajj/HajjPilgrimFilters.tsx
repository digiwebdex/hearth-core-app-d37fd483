import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { HajjGroup, HajjPackage } from "@/lib/hajjApi";
import { PILGRIM_STATUS_META, VISA_STATUS_META } from "./constants";
import type { HajjPilgrimFilterState } from "./types";

interface Props {
  filters: HajjPilgrimFilterState;
  onChange: (patch: Partial<HajjPilgrimFilterState>) => void;
  packages: HajjPackage[];
  groups: HajjGroup[];
}

export function HajjPilgrimFilters({ filters, onChange, packages, groups }: Props) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("hajjForm.filters.searchPlaceholder")}
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
            />
          </div>
          <Select value={filters.packageId} onValueChange={(v) => onChange({ packageId: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hajjForm.filters.allPackages")}</SelectItem>
              {packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.groupId} onValueChange={(v) => onChange({ groupId: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hajjForm.filters.allGroups")}</SelectItem>
              {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.pilgrimStatus} onValueChange={(v) => onChange({ pilgrimStatus: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hajjForm.filters.allStatuses")}</SelectItem>
              {PILGRIM_STATUS_META.map((s) => (
                <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.visaStatus} onValueChange={(v) => onChange({ visaStatus: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hajjForm.filters.allVisa")}</SelectItem>
              {VISA_STATUS_META.map((v) => (
                <SelectItem key={v.value} value={v.value}>{t(v.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label className="text-xs">{t("hajjForm.filters.dateFrom")}</Label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("hajjForm.filters.dateTo")}</Label>
            <Input type="date" value={filters.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
