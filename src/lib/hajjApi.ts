const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || "Request failed");
  }
  return res.json();
}

export type HajjPackageType = "hajj" | "umrah";
export type HajjPackageStatus = "upcoming" | "active" | "departed" | "completed" | "closed";
export type HajjPilgrimStatus = "registered" | "documents_pending" | "visa_processing" | "confirmed" | "departed" | "completed" | "cancelled";
export type HajjVisaStatus = "not_started" | "documents_collected" | "submitted" | "approved" | "rejected";
export type HajjRoomType = "single" | "double" | "triple" | "quad" | "sharing";

export interface HajjPackage {
  id: string;
  name: string;
  type: HajjPackageType;
  status: HajjPackageStatus;
  duration: string;
  makkahNights: number;
  madinahNights: number;
  makkahHotel?: string;
  madinahHotel?: string;
  hotelClass: "economy" | "3_star" | "4_star" | "5_star" | "shifting" | string;
  flightInfo?: string;
  visaIncluded: boolean;
  transportIncluded: boolean;
  mealsIncluded: boolean;
  ziyaratIncluded: boolean;
  packagePrice: number;
  costPrice: number;
  profit: number;
  capacity: number;
  enrolled: number;
  departureDate?: string;
  returnDate?: string;
  highlights?: string;
  notes?: string;
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface HajjGroup {
  id: string;
  packageId: string;
  name: string;
  leader: string;
  leaderPhone?: string;
  departureDate: string;
  returnDate: string;
  flightDetails?: string;
  transportSchedule?: string;
  notes?: string;
  tenantId: string;
  createdAt: string;
}

export interface HajjPilgrim {
  id: string;
  packageId: string;
  groupId: string;
  clientId?: string;
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  passportNumber: string;
  passportExpiry?: string;
  nidNumber?: string;
  nationality?: string;
  mahramName?: string;
  mahramRelation?: string;
  mahramPilgrimId?: string;
  roomType?: HajjRoomType;
  roomNumber?: string;
  roomPartners?: string;
  status: HajjPilgrimStatus;
  visaStatus: HajjVisaStatus;
  departureStatus: "not_departed" | "departed" | "returned" | string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: "unpaid" | "partial" | "paid" | string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalNotes?: string;
  notes?: string;
  tenantId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface HajjPilgrimPayment {
  id: string;
  pilgrimId: string;
  amount: number;
  method: string;
  reference?: string;
  date: string;
  note?: string;
  installmentLabel?: string;
  receivedBy?: string;
  createdAt: string;
}

export const hajjApi = {
  listPackages: () => request<HajjPackage[]>("/hajj/packages"),
  getPackage: (id: string) => request<HajjPackage>(`/hajj/packages/${id}`),
  createPackage: (data: Partial<HajjPackage>) =>
    request<HajjPackage>("/hajj/packages", { method: "POST", body: JSON.stringify(data) }),
  updatePackage: (id: string, data: Partial<HajjPackage>) =>
    request<HajjPackage>(`/hajj/packages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePackage: (id: string) =>
    request<{ success: boolean }>(`/hajj/packages/${id}`, { method: "DELETE" }),

  listGroups: (packageId?: string) =>
    request<HajjGroup[]>(`/hajj/groups${packageId ? `?packageId=${encodeURIComponent(packageId)}` : ""}`),
  createGroup: (data: Partial<HajjGroup>) =>
    request<HajjGroup>("/hajj/groups", { method: "POST", body: JSON.stringify(data) }),
  updateGroup: (id: string, data: Partial<HajjGroup>) =>
    request<HajjGroup>(`/hajj/groups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteGroup: (id: string) =>
    request<{ success: boolean }>(`/hajj/groups/${id}`, { method: "DELETE" }),

  listPilgrims: (packageId?: string) =>
    request<HajjPilgrim[]>(`/hajj/pilgrims${packageId ? `?packageId=${encodeURIComponent(packageId)}` : ""}`),
  createPilgrim: (data: Partial<HajjPilgrim>) =>
    request<HajjPilgrim>("/hajj/pilgrims", { method: "POST", body: JSON.stringify(data) }),
  updatePilgrim: (id: string, data: Partial<HajjPilgrim>) =>
    request<HajjPilgrim>(`/hajj/pilgrims/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePilgrim: (id: string) =>
    request<{ success: boolean }>(`/hajj/pilgrims/${id}`, { method: "DELETE" }),

  listPilgrimPayments: (pilgrimId: string) =>
    request<HajjPilgrimPayment[]>(`/hajj/pilgrims/${pilgrimId}/payments`),
  addPilgrimPayment: (pilgrimId: string, data: Partial<HajjPilgrimPayment>) =>
    request<HajjPilgrimPayment>(`/hajj/pilgrims/${pilgrimId}/payments`, { method: "POST", body: JSON.stringify(data) }),
};
