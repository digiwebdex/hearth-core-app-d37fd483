import type { TFunction } from "i18next";
import type { PlanConfig } from "@/lib/plans";
import type { FEATURE_COMPARISON } from "@/lib/plans";

type Comparison = typeof FEATURE_COMPARISON;

export function translatePlanFeature(t: TFunction, key: string): string {
  return t(`marketing.pricing.planFeatureItems.${key}`, { defaultValue: key });
}

export function translatePlanRestriction(t: TFunction, key: string): string {
  return t(`marketing.pricing.planRestrictionItems.${key}`, { defaultValue: key });
}

export function translatePlanDescription(t: TFunction, planId: string, fallback: string): string {
  return t(`marketing.pricing.planDescriptions.${planId}`, { defaultValue: fallback });
}

export function getPlanFeatureLabels(plan: PlanConfig, t: TFunction): string[] {
  return plan.featureKeys.map((key) => translatePlanFeature(t, key));
}

export function getPlanRestrictionLabels(plan: PlanConfig, t: TFunction): string[] {
  return plan.restrictionKeys.map((key) => translatePlanRestriction(t, key));
}

export function translateComparisonCategory(t: TFunction, category: string): string {
  return t(`marketing.pricing.comparisonCategories.${category}`, { defaultValue: category });
}

export function translateComparisonFeature(t: TFunction, name: string): string {
  return t(`marketing.pricing.comparisonFeatures.${name}`, { defaultValue: name });
}

export function translateComparisonValue(
  t: TFunction,
  featureName: string,
  val: boolean | string
): string {
  if (val === true || val === false) return String(val);
  return t(`marketing.pricing.comparisonValues.${featureName}.${val}`, {
    defaultValue: val,
  });
}

export type FeatureComparisonRow = Comparison[number]["features"][number];
