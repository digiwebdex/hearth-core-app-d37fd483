import type { BookingType } from "@/lib/api";
import type { BookingFormState } from "@/components/bookings/types";
import { normalizeVisaType } from "@/components/bookings/types";

export type ServiceDeskId = "visa" | "ticket" | "hotel" | "transport" | "departures";

export type VisaWorkflowStatus =
  | "not_started"
  | "documents_pending"
  | "submitted"
  | "interview_scheduled"
  | "approved"
  | "rejected"
  | "passport_returned";

export type TicketWorkflowStatus =
  | "pending"
  | "issued"
  | "reissued"
  | "refund_requested"
  | "refunded";

export type HotelWorkflowStatus = "pending" | "confirmed" | "voucher_sent" | "checked_in" | "cancelled";

export type TransportWorkflowStatus = "pending" | "assigned" | "in_transit" | "completed" | "cancelled";

export type ServiceDetails = Record<string, unknown> & {
  workflowStatus?: string;
};

export const DEFAULT_OPS_STATUS = "pending";

export const SERVICE_DESK_BOOKING_TYPES: Record<Exclude<ServiceDeskId, "departures">, BookingType> = {
  visa: "visa",
  ticket: "ticket",
  hotel: "hotel",
  transport: "transport",
};

export function deskToBookingType(desk: Exclude<ServiceDeskId, "departures">): BookingType {
  return SERVICE_DESK_BOOKING_TYPES[desk];
}

export function buildServiceDetailsFromForm(form: BookingFormState): ServiceDetails {
  const base: ServiceDetails = {};

  switch (form.type) {
    case "ticket":
      return {
        ...base,
        flightNumber: form.flightNumber || undefined,
        airline: form.airline || undefined,
        fromCity: form.fromCity || undefined,
        toCity: form.toCity || undefined,
        departureDate: form.departureDate || undefined,
        returnDate: form.returnDate || undefined,
        isRoundTrip: form.isRoundTrip,
        cabinClass: form.cabinClass,
        pnrNumber: form.pnrNumber || undefined,
        ticketDeadline: form.ticketDeadline || undefined,
        workflowStatus: (form as BookingFormState & { workflowStatus?: string }).workflowStatus || "pending",
      };
    case "hotel":
      return {
        ...base,
        hotelName: form.hotelName || undefined,
        hotelCity: form.hotelCity || undefined,
        hotelCountry: form.hotelCountry || undefined,
        checkInDate: form.checkInDate || undefined,
        checkOutDate: form.checkOutDate || undefined,
        roomType: form.roomType,
        roomCount: form.roomCount,
        guestCount: form.guestCount,
        confirmationNumber: form.confirmationNumber || undefined,
        workflowStatus: (form as BookingFormState & { workflowStatus?: string }).workflowStatus || "pending",
      };
    case "visa":
      return {
        ...base,
        visaCountry: form.visaCountry || undefined,
        visaType: form.visaType,
        passportNumber: form.passportNumber || undefined,
        passportExpiry: form.passportExpiry || undefined,
        applicationDate: form.applicationDate || undefined,
        appointmentDate: form.appointmentDate || undefined,
        submissionDate: form.submissionDate || undefined,
        expectedApprovalDate: form.expectedApprovalDate || undefined,
        visaFee: form.visaFee || undefined,
        serviceFee: form.serviceFee || undefined,
        workflowStatus: (form as BookingFormState & { workflowStatus?: string }).workflowStatus || "not_started",
      };
    case "transport":
      return {
        ...base,
        routeDescription: form.routeDescription || undefined,
        pickupLocation: form.pickupLocation || undefined,
        dropoffLocation: form.dropoffLocation || undefined,
        pickupDate: form.pickupDate || undefined,
        pickupTime: form.pickupTime || undefined,
        vehicleType: form.vehicleType || undefined,
        driverName: form.driverName || undefined,
        driverPhone: form.driverPhone || undefined,
        transportVendor: form.transportVendor || undefined,
        workflowStatus: (form as BookingFormState & { workflowStatus?: string }).workflowStatus || "pending",
      };
    case "tour":
      return {
        ...base,
        tourOperator: form.tourOperator || undefined,
        itinerary: form.itinerary || undefined,
        includesHotel: form.includesHotel,
        includesTransfer: form.includesTransfer,
      };
    case "student":
      return {
        ...base,
        instituteName: form.instituteName || undefined,
        courseProgram: form.courseProgram || undefined,
        enrollmentDate: form.enrollmentDate || undefined,
        visaCountry: form.visaCountry || undefined,
      };
    case "manpower":
      return {
        ...base,
        workCountry: form.workCountry || undefined,
        employer: form.employer || undefined,
        jobTitle: form.jobTitle || undefined,
        contractDuration: form.contractDuration || undefined,
        medicalStatus: form.medicalStatus,
        bmetRegistration: form.bmetRegistration || undefined,
      };
    case "package":
      return {
        ...base,
        customizations: form.customizations || undefined,
      };
    case "insurance":
      return {
        ...base,
        insurancePlan: form.insurancePlan || undefined,
        insuranceProvider: form.insuranceProvider || undefined,
        insuranceDestination: form.insuranceDestination || undefined,
        coverageStart: form.coverageStart || undefined,
        coverageEnd: form.coverageEnd || undefined,
        insuredCount: form.insuredCount,
        policyNumber: form.policyNumber || undefined,
        workflowStatus: (form as BookingFormState & { workflowStatus?: string }).workflowStatus || "pending",
      };
    default:
      return base;
  }
}

export function mergeServiceDetailsIntoBooking<T extends Record<string, unknown>>(
  booking: T,
): T & ServiceDetails {
  const details = (booking.serviceDetails as ServiceDetails | null | undefined) || {};
  return { ...booking, ...details, serviceDetails: details };
}

export function applyServiceDetailsToForm(
  form: BookingFormState,
  details: ServiceDetails | null | undefined,
): BookingFormState {
  if (!details) return form;
  const d = details as Record<string, unknown>;
  const patch = <K extends keyof BookingFormState>(key: K, value: unknown) => {
    if (value !== undefined && value !== null && value !== "") {
      (form as Record<string, unknown>)[key] = value;
    }
  };

  patch("flightNumber", d.flightNumber);
  patch("airline", d.airline);
  patch("fromCity", d.fromCity);
  patch("toCity", d.toCity);
  patch("departureDate", d.departureDate);
  patch("returnDate", d.returnDate);
  if (typeof d.isRoundTrip === "boolean") form.isRoundTrip = d.isRoundTrip;
  patch("cabinClass", d.cabinClass);
  patch("pnrNumber", d.pnrNumber);
  patch("ticketDeadline", d.ticketDeadline);
  patch("tourOperator", d.tourOperator);
  patch("itinerary", d.itinerary);
  if (typeof d.includesHotel === "boolean") form.includesHotel = d.includesHotel;
  if (typeof d.includesTransfer === "boolean") form.includesTransfer = d.includesTransfer;
  patch("hotelName", d.hotelName);
  patch("hotelCity", d.hotelCity);
  patch("hotelCountry", d.hotelCountry);
  patch("checkInDate", d.checkInDate);
  patch("checkOutDate", d.checkOutDate);
  patch("roomType", d.roomType);
  if (typeof d.roomCount === "number") form.roomCount = d.roomCount;
  if (typeof d.guestCount === "number") form.guestCount = d.guestCount;
  patch("confirmationNumber", d.confirmationNumber);
  patch("visaCountry", d.visaCountry);
  patch("visaType", normalizeVisaType(d.visaType));
  patch("passportNumber", d.passportNumber);
  patch("passportExpiry", d.passportExpiry);
  patch("applicationDate", d.applicationDate);
  patch("appointmentDate", d.appointmentDate);
  patch("submissionDate", d.submissionDate);
  patch("expectedApprovalDate", d.expectedApprovalDate);
  if (typeof d.visaFee === "number") form.visaFee = d.visaFee;
  if (typeof d.serviceFee === "number") form.serviceFee = d.serviceFee;
  patch("routeDescription", d.routeDescription);
  patch("pickupLocation", d.pickupLocation);
  patch("dropoffLocation", d.dropoffLocation);
  patch("pickupDate", d.pickupDate);
  patch("pickupTime", d.pickupTime);
  patch("vehicleType", d.vehicleType);
  patch("driverName", d.driverName);
  patch("driverPhone", d.driverPhone);
  patch("transportVendor", d.transportVendor);
  patch("instituteName", d.instituteName);
  patch("courseProgram", d.courseProgram);
  patch("enrollmentDate", d.enrollmentDate);
  patch("workCountry", d.workCountry);
  patch("employer", d.employer);
  patch("jobTitle", d.jobTitle);
  patch("contractDuration", d.contractDuration);
  patch("medicalStatus", d.medicalStatus);
  patch("bmetRegistration", d.bmetRegistration);
  patch("customizations", d.customizations);
  patch("insurancePlan", d.insurancePlan);
  patch("insuranceProvider", d.insuranceProvider);
  patch("insuranceDestination", d.insuranceDestination);
  patch("coverageStart", d.coverageStart);
  patch("coverageEnd", d.coverageEnd);
  if (typeof d.insuredCount === "number") form.insuredCount = d.insuredCount;
  patch("policyNumber", d.policyNumber);

  return form;
}

export function getWorkflowStatus(booking: { serviceDetails?: ServiceDetails | null; opsStatus?: string | null }) {
  const details = booking.serviceDetails || {};
  return String(details.workflowStatus || booking.opsStatus || DEFAULT_OPS_STATUS);
}

export interface DepartureGroup {
  key: string;
  destination: string;
  travelDateFrom: string;
  bookingCount: number;
  travelerCount: number;
  bookingIds: string[];
}

export function groupDepartures(
  bookings: Array<{
    id: string;
    type?: string;
    destination?: string | null;
    travelDateFrom?: string | null;
    travelerCount?: number | null;
    status?: string;
  }>,
): DepartureGroup[] {
  const map = new Map<string, DepartureGroup>();
  for (const b of bookings) {
    if (b.type !== "tour" && b.type !== "package") continue;
    if (!b.travelDateFrom) continue;
    const destination = b.destination || "—";
    const key = `${b.travelDateFrom}|${destination}`;
    const existing = map.get(key);
    if (existing) {
      existing.bookingCount += 1;
      existing.travelerCount += b.travelerCount || 1;
      existing.bookingIds.push(b.id);
    } else {
      map.set(key, {
        key,
        destination,
        travelDateFrom: b.travelDateFrom,
        bookingCount: 1,
        travelerCount: b.travelerCount || 1,
        bookingIds: [b.id],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.travelDateFrom.localeCompare(b.travelDateFrom));
}
