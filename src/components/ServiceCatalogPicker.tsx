import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  AGENCY_PRESETS,
  SERVICE_CATALOG,
  type AgencyPresetId,
  deriveCategoryIdsFromSubcategories,
  getLocalizedCategoryLabel,
  getLocalizedPresetLabel,
  getLocalizedSubcategoryLabel,
  getSubcategoryIdsForCategories,
  getSubcategoryIdsForPreset,
} from "@/lib/serviceCatalog";

interface ServiceCatalogPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function ServiceCatalogPicker({ value, onChange, disabled, compact }: ServiceCatalogPickerProps) {
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [search, setSearch] = useState("");
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set());

  const selected = useMemo(() => new Set(value), [value]);
  const q = search.trim().toLowerCase();

  const filteredCatalog = useMemo(() => {
    if (!q) return SERVICE_CATALOG;
    return SERVICE_CATALOG.map((cat) => {
      const catLabel = getLocalizedCategoryLabel(cat.id, isBn).toLowerCase();
      const subs = cat.subcategories.filter((sub) => {
        const label = getLocalizedSubcategoryLabel(sub.id, isBn).toLowerCase();
        return label.includes(q) || catLabel.includes(q) || sub.id.includes(q);
      });
      if (subs.length || catLabel.includes(q)) return { ...cat, subcategories: subs.length ? subs : cat.subcategories };
      return null;
    }).filter(Boolean) as typeof SERVICE_CATALOG;
  }, [q, isBn]);

  const applyPreset = (presetId: AgencyPresetId) => {
    onChange(getSubcategoryIdsForPreset(presetId));
    setOpenCats(new Set(AGENCY_PRESETS.find((p) => p.id === presetId)?.categoryIds || []));
  };

  const toggleSub = (id: string) => {
    if (disabled) return;
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const toggleCategoryAll = (categoryId: string) => {
    if (disabled) return;
    const cat = SERVICE_CATALOG.find((c) => c.id === categoryId);
    if (!cat) return;
    const ids = cat.subcategories.map((s) => s.id);
    const allOn = ids.every((id) => selected.has(id));
    if (allOn) {
      onChange(value.filter((id) => !ids.includes(id)));
    } else {
      onChange([...new Set([...value, ...ids])]);
    }
  };

  const clearAll = () => onChange([]);

  const activeCategories = deriveCategoryIdsFromSubcategories(value);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {AGENCY_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className="text-xs h-8"
            onClick={() => applyPreset(preset.id)}
          >
            {getLocalizedPresetLabel(preset.id, isBn)}
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isBn ? "সার্ভিস খুঁজুন..." : "Search services..."}
          className="pl-9"
          disabled={disabled}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {isBn
            ? `${value.length}টি সাব-সার্ভিস • ${activeCategories.length}টি ক্যাটাগরি`
            : `${value.length} sub-services • ${activeCategories.length} categories`}
        </span>
        {value.length > 0 && !disabled ? (
          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={clearAll}>
            <X className="h-3 w-3" /> {isBn ? "সব মুছুন" : "Clear all"}
          </button>
        ) : null}
      </div>

      <div className={cn("space-y-2 max-h-[min(420px,55vh)] overflow-y-auto pr-1", compact && "max-h-64")}>
        {filteredCatalog.map((cat) => {
          const catIds = cat.subcategories.map((s) => s.id);
          const selectedInCat = catIds.filter((id) => selected.has(id)).length;
          const allInCat = selectedInCat === catIds.length && catIds.length > 0;
          const isOpen = openCats.has(cat.id) || q.length > 0;

          return (
            <Collapsible
              key={cat.id}
              open={isOpen}
              onOpenChange={(open) => {
                setOpenCats((prev) => {
                  const next = new Set(prev);
                  if (open) next.add(cat.id);
                  else next.delete(cat.id);
                  return next;
                });
              }}
            >
              <div className="rounded-lg border">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-muted/40"
                    disabled={disabled}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                      <span className="font-medium text-sm truncate">{getLocalizedCategoryLabel(cat.id, isBn)}</span>
                      {selectedInCat > 0 ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {selectedInCat}/{catIds.length}
                        </Badge>
                      ) : null}
                    </div>
                    {!disabled ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategoryAll(cat.id);
                        }}
                      >
                        {allInCat ? (isBn ? "সব বাতিল" : "Deselect") : isBn ? "সব নির্বাচন" : "Select all"}
                      </Button>
                    ) : null}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-1 px-3 pb-3 sm:grid-cols-2">
                    {cat.subcategories.map((sub) => {
                      const checked = selected.has(sub.id);
                      return (
                        <label
                          key={sub.id}
                          className={cn(
                            "flex items-start gap-2 rounded-md border p-2 text-sm cursor-pointer transition-colors",
                            checked ? "border-primary/40 bg-primary/5" : "hover:bg-muted/30",
                            disabled && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() => toggleSub(sub.id)}
                            className="mt-0.5"
                          />
                          <span className="leading-snug">{getLocalizedSubcategoryLabel(sub.id, isBn)}</span>
                          {checked ? <Check className="ml-auto h-3.5 w-3.5 text-primary shrink-0" /> : null}
                        </label>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {isBn
            ? "আপনার এজেন্সি যে সেবাগুলো দেয় সেগুলো নির্বাচন করুন। উপরের প্রিসেট বাটন দিয়ে দ্রুত শুরু করতে পারেন।"
            : "Select the services your agency offers. Use a preset above for a quick start."}
        </p>
      ) : null}
    </div>
  );
}

export function getSubcategoryIdsForCategoryIds(categoryIds: string[]) {
  return getSubcategoryIdsForCategories(categoryIds);
}
