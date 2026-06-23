import { useState } from "react";
import { useTranslation } from "react-i18next";
import MasterDataSelect from "@/components/MasterDataSelect";
import type { MasterDataCategory } from "@/lib/masterDataApi";
import type { QuotationItemType } from "@/lib/api";

const ITEM_TO_CATALOG: Partial<Record<QuotationItemType, MasterDataCategory>> = {
  flight: "airline",
  hotel: "hotel",
  insurance: "insurance_plan",
  visa: "visa_type",
  transport: "vehicle_type",
  tour: "city",
};

interface QuotationCatalogPickerProps {
  itemType: QuotationItemType;
  onPick: (description: string, supplier?: string) => void;
}

export default function QuotationCatalogPicker({ itemType, onPick }: QuotationCatalogPickerProps) {
  const { t } = useTranslation();
  const category = ITEM_TO_CATALOG[itemType];
  const [resetKey, setResetKey] = useState(0);

  if (!category) return null;

  return (
    <MasterDataSelect
      key={resetKey}
      category={category}
      value=""
      onChange={(name) => {
        onPick(name, name);
        setResetKey((k) => k + 1);
      }}
      allowCustom={false}
      placeholder={t("quotationBuilder.catalogPicker")}
    />
  );
}
