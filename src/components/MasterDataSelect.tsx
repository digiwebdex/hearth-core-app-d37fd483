import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { masterDataApi, type MasterDataCategory, type MasterReference } from "@/lib/masterDataApi";

interface MasterDataSelectProps {
  category: MasterDataCategory;
  value: string;
  onChange: (value: string) => void;
  /** Direct parent UUID (e.g. country id for cities) */
  parentId?: string;
  /** Parent display name — resolves to id for city → country */
  parentName?: string;
  placeholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  /** Store airport/airline IATA code instead of full name */
  valueField?: "name" | "code";
  /** Show IATA/ISO code in dropdown labels */
  showCode?: boolean;
}

function optionValue(row: MasterReference, valueField: "name" | "code") {
  if (valueField === "code" && row.code) return row.code;
  return row.name;
}

function optionLabel(row: MasterReference, isBn: boolean, showCode: boolean) {
  const name = isBn && row.nameBn ? row.nameBn : row.name;
  if (showCode && row.code) return `${row.code} — ${name}`;
  return name;
}

export default function MasterDataSelect({
  category,
  value,
  onChange,
  parentId,
  parentName,
  placeholder,
  allowCustom = true,
  disabled,
  valueField = "name",
  showCode = false,
}: MasterDataSelectProps) {
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [rows, setRows] = useState<MasterReference[]>([]);
  const [resolvedParentId, setResolvedParentId] = useState<string | undefined>(parentId);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    if (parentId) {
      setResolvedParentId(parentId);
      return;
    }
    if (!parentName || category !== "city") {
      setResolvedParentId(undefined);
      return;
    }
    let cancelled = false;
    masterDataApi.list("country")
      .then((countries) => {
        if (cancelled) return;
        const match = countries.find(
          (c) => c.name === parentName || (c.nameBn && c.nameBn === parentName) || c.code === parentName,
        );
        setResolvedParentId(match?.id);
      })
      .catch(() => { if (!cancelled) setResolvedParentId(undefined); });
    return () => { cancelled = true; };
  }, [parentId, parentName, category]);

  useEffect(() => {
    let cancelled = false;
    const params = resolvedParentId ? { parentId: resolvedParentId } : undefined;
    masterDataApi.list(category, params)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [category, resolvedParentId]);

  const options = useMemo(
    () => rows.map((r) => ({
      id: optionValue(r, valueField),
      label: optionLabel(r, isBn, showCode),
    })),
    [rows, isBn, valueField, showCode],
  );

  const inList = options.some((o) => o.id === value);
  const selectValue = inList ? value : (allowCustom && value ? "__custom__" : value || "");

  if (customMode || (allowCustom && value && !inList && options.length > 0)) {
    return (
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className="flex-1" />
        {options.length > 0 ? (
          <button type="button" className="text-xs text-primary shrink-0 px-1" onClick={() => setCustomMode(false)}>
            {isBn ? "তালিকা" : "List"}
          </button>
        ) : null}
      </div>
    );
  }

  if (!options.length) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} />;
  }

  return (
    <Select
      value={selectValue || undefined}
      onValueChange={(v) => {
        if (v === "__custom__") {
          setCustomMode(true);
          onChange("");
          return;
        }
        onChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
        ))}
        {allowCustom ? (
          <SelectItem value="__custom__">{isBn ? "অন্যান্য (টাইপ করুন)" : "Other (type custom)"}</SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}
