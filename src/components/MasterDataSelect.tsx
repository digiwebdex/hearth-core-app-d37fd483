import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { masterDataApi, type MasterDataCategory } from "@/lib/masterDataApi";

interface MasterDataSelectProps {
  category: MasterDataCategory;
  value: string;
  onChange: (value: string) => void;
  parentId?: string;
  placeholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
}

export default function MasterDataSelect({
  category,
  value,
  onChange,
  parentId,
  placeholder,
  allowCustom = true,
  disabled,
}: MasterDataSelectProps) {
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    masterDataApi.list(category, parentId ? { parentId } : undefined)
      .then((rows) => {
        if (cancelled) return;
        setOptions(rows.map((r) => ({
          id: r.name,
          label: isBn && r.nameBn ? r.nameBn : r.name,
        })));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => { cancelled = true; };
  }, [category, parentId, isBn]);

  const inList = options.some((o) => o.id === value);
  const selectValue = inList ? value : (allowCustom && value ? "__custom__" : value || "");

  if (customMode || (allowCustom && value && !inList && options.length > 0)) {
    return (
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} />
        {options.length > 0 ? (
          <button type="button" className="text-xs text-primary shrink-0" onClick={() => setCustomMode(false)}>
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
        {allowCustom ? <SelectItem value="__custom__">{isBn ? "অন্যান্য (টাইপ করুন)" : "Other (type custom)"}</SelectItem> : null}
      </SelectContent>
    </Select>
  );
}
