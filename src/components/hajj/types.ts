import type {
  HajjPackageStatus,
  HajjPackageType,
  HajjPilgrimStatus,
  HajjRoomType,
  HajjVisaStatus,
} from "@/lib/hajjApi";

export interface HajjSummary {
  totalPilgrims: number;
  totalRevenue: number;
  totalCollected: number;
  totalDue: number;
  grossProfit: number;
  totalCost: number;
  visaPending: number;
  docsPending: number;
}

export interface HajjPackageProfitRow {
  id: string;
  name: string;
  enrolled: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface HajjPackageFormState {
  name: string;
  type: HajjPackageType;
  status: HajjPackageStatus;
  duration: string;
  makkahNights: number;
  madinahNights: number;
  makkahHotel: string;
  madinahHotel: string;
  hotelClass: string;
  flightInfo: string;
  visaIncluded: boolean;
  transportIncluded: boolean;
  mealsIncluded: boolean;
  ziyaratIncluded: boolean;
  packagePrice: number;
  costPrice: number;
  capacity: number;
  departureDate: string;
  returnDate: string;
  highlights: string;
  notes: string;
}

export interface HajjGroupFormState {
  packageId: string;
  name: string;
  leader: string;
  leaderPhone: string;
  departureDate: string;
  returnDate: string;
  flightDetails: string;
  transportSchedule: string;
  notes: string;
}

export interface HajjPilgrimFormState {
  packageId: string;
  groupId: string;
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  passportNumber: string;
  passportExpiry: string;
  nidNumber: string;
  nationality: string;
  mahramName: string;
  mahramRelation: string;
  mahramPilgrimId: string;
  roomType: HajjRoomType;
  roomNumber: string;
  roomPartners: string;
  status: HajjPilgrimStatus;
  visaStatus: HajjVisaStatus;
  emergencyContact: string;
  emergencyPhone: string;
  medicalNotes: string;
  notes: string;
}

export interface HajjPayFormState {
  amount: number;
  method: string;
  reference: string;
  date: string;
  installmentLabel: string;
  note: string;
}

export interface HajjPilgrimFilterState {
  search: string;
  packageId: string;
  groupId: string;
  pilgrimStatus: string;
  visaStatus: string;
  dateFrom: string;
  dateTo: string;
}

export type HajjTopTab = "packages" | "groups" | "pilgrims" | "analytics";
