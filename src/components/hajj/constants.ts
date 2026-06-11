import type {
  HajjPackageStatus,
  HajjPackageType,
  HajjPilgrimStatus,
  HajjRoomType,
  HajjVisaStatus,
} from "@/lib/hajjApi";
import type { HajjGroupFormState, HajjPackageFormState, HajjPayFormState, HajjPilgrimFormState } from "./types";

export const PKG_STATUS_META: { value: HajjPackageStatus; labelKey: string; color: string }[] = [
  { value: "upcoming", labelKey: "hajjForm.packageStatuses.upcoming", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "active", labelKey: "hajjForm.packageStatuses.active", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "departed", labelKey: "hajjForm.packageStatuses.departed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "completed", labelKey: "hajjForm.packageStatuses.completed", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  { value: "closed", labelKey: "hajjForm.packageStatuses.closed", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

export const PILGRIM_STATUS_META: { value: HajjPilgrimStatus; labelKey: string; color: string }[] = [
  { value: "registered", labelKey: "hajjForm.pilgrimStatuses.registered", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "documents_pending", labelKey: "hajjForm.pilgrimStatuses.documents_pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "visa_processing", labelKey: "hajjForm.pilgrimStatuses.visa_processing", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "confirmed", labelKey: "hajjForm.pilgrimStatuses.confirmed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "departed", labelKey: "hajjForm.pilgrimStatuses.departed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "completed", labelKey: "hajjForm.pilgrimStatuses.completed", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  { value: "cancelled", labelKey: "hajjForm.pilgrimStatuses.cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

export const VISA_STATUS_META: { value: HajjVisaStatus; labelKey: string; color: string }[] = [
  { value: "not_started", labelKey: "hajjForm.visaStatuses.not_started", color: "bg-gray-100 text-gray-800" },
  { value: "documents_collected", labelKey: "hajjForm.visaStatuses.documents_collected", color: "bg-blue-100 text-blue-800" },
  { value: "submitted", labelKey: "hajjForm.visaStatuses.submitted", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", labelKey: "hajjForm.visaStatuses.approved", color: "bg-green-100 text-green-800" },
  { value: "rejected", labelKey: "hajjForm.visaStatuses.rejected", color: "bg-red-100 text-red-800" },
];

export const HOTEL_CLASSES = [
  { value: "economy", labelKey: "hajjForm.hotelClasses.economy" },
  { value: "3_star", labelKey: "hajjForm.hotelClasses.3_star" },
  { value: "4_star", labelKey: "hajjForm.hotelClasses.4_star" },
  { value: "5_star", labelKey: "hajjForm.hotelClasses.5_star" },
  { value: "shifting", labelKey: "hajjForm.hotelClasses.shifting" },
];

export const ROOM_TYPES: { value: HajjRoomType; labelKey: string }[] = [
  { value: "single", labelKey: "hajjForm.roomTypes.single" },
  { value: "double", labelKey: "hajjForm.roomTypes.double" },
  { value: "triple", labelKey: "hajjForm.roomTypes.triple" },
  { value: "quad", labelKey: "hajjForm.roomTypes.quad" },
  { value: "sharing", labelKey: "hajjForm.roomTypes.sharing" },
];

export const PAY_METHODS = [
  { value: "cash", labelKey: "hajjForm.payMethods.cash" },
  { value: "bank", labelKey: "hajjForm.payMethods.bank" },
  { value: "bkash", labelKey: "hajjForm.payMethods.bkash" },
  { value: "nagad", labelKey: "hajjForm.payMethods.nagad" },
  { value: "card", labelKey: "hajjForm.payMethods.card" },
];

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function getStatusMeta<T extends { value: string }>(list: T[], val: string): T {
  return list.find((x) => x.value === val) ?? list[0];
}

export const emptyPkgForm: HajjPackageFormState = {
  name: "",
  type: "hajj",
  status: "upcoming",
  duration: "",
  makkahNights: 0,
  madinahNights: 0,
  makkahHotel: "",
  madinahHotel: "",
  hotelClass: "3_star",
  flightInfo: "",
  visaIncluded: true,
  transportIncluded: true,
  mealsIncluded: true,
  ziyaratIncluded: true,
  packagePrice: 0,
  costPrice: 0,
  capacity: 0,
  departureDate: "",
  returnDate: "",
  highlights: "",
  notes: "",
};

export const emptyGroupForm: HajjGroupFormState = {
  packageId: "",
  name: "",
  leader: "",
  leaderPhone: "",
  departureDate: "",
  returnDate: "",
  flightDetails: "",
  transportSchedule: "",
  notes: "",
};

export const emptyPilgrimForm: HajjPilgrimFormState = {
  packageId: "",
  groupId: "",
  name: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  gender: "male",
  passportNumber: "",
  passportExpiry: "",
  nidNumber: "",
  nationality: "Bangladeshi",
  mahramName: "",
  mahramRelation: "",
  mahramPilgrimId: "",
  roomType: "double",
  roomNumber: "",
  roomPartners: "",
  status: "registered",
  visaStatus: "not_started",
  emergencyContact: "",
  emergencyPhone: "",
  medicalNotes: "",
  notes: "",
};

export const emptyPayForm: HajjPayFormState = {
  amount: 0,
  method: "cash",
  reference: "",
  date: new Date().toISOString().slice(0, 10),
  installmentLabel: "",
  note: "",
};

export const defaultPilgrimFilters = {
  search: "",
  packageId: "all",
  groupId: "all",
  pilgrimStatus: "all",
  visaStatus: "all",
  dateFrom: "",
  dateTo: "",
};
