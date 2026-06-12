import type { BookingStatus, BookingType } from "@/lib/api";

export type CabinClass = "economy" | "business" | "first";

export type RoomType = "single" | "double" | "twin" | "triple" | "suite" | "other";

export type VisaType = "tourist" | "business" | "transit" | "work" | "student" | "other";

export type MedicalStatus = "pending" | "cleared" | "failed" | "not_required";

export interface BookingFormState {
  // Common
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  agentId: string;
  amount: number;
  cost: number;
  status: BookingStatus;
  internalNotes: string;
  type: BookingType;
  travelDateFrom: string;
  travelDateTo: string;
  travelerCount: number;
  packageId: string;

  // Air ticket
  flightNumber: string;
  airline: string;
  fromCity: string;
  toCity: string;
  departureDate: string;
  returnDate: string;
  isRoundTrip: boolean;
  cabinClass: CabinClass;
  pnrNumber: string;
  ticketDeadline: string;

  // Tour
  destination: string;
  tourOperator: string;
  itinerary: string;
  includesHotel: boolean;
  includesTransfer: boolean;

  // Hotel
  hotelName: string;
  hotelCity: string;
  hotelCountry: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: RoomType;
  roomCount: number;
  guestCount: number;
  confirmationNumber: string;

  // Visa
  visaCountry: string;
  visaType: VisaType;
  passportNumber: string;
  passportExpiry: string;
  applicationDate: string;
  appointmentDate: string;
  submissionDate: string;
  expectedApprovalDate: string;
  visaFee: number;
  serviceFee: number;

  // Transport
  routeDescription: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
  transportVendor: string;

  // Package
  packageTitleSnapshot: string;
  packageCodeSnapshot: string;
  customizations: string;

  // Student
  instituteName: string;
  courseProgram: string;
  enrollmentDate: string;

  // Manpower
  workCountry: string;
  employer: string;
  jobTitle: string;
  contractDuration: string;
  medicalStatus: MedicalStatus;
  bmetRegistration: string;
}

export const emptyForm: BookingFormState = {
  id: "",
  title: "",
  clientId: "",
  clientName: "",
  agentId: "",
  amount: 0,
  cost: 0,
  status: "pending",
  internalNotes: "",
  type: "tour",
  travelDateFrom: "",
  travelDateTo: "",
  travelerCount: 1,
  packageId: "",

  flightNumber: "",
  airline: "",
  fromCity: "",
  toCity: "",
  departureDate: "",
  returnDate: "",
  isRoundTrip: false,
  cabinClass: "economy",
  pnrNumber: "",
  ticketDeadline: "",

  destination: "",
  tourOperator: "",
  itinerary: "",
  includesHotel: false,
  includesTransfer: false,

  hotelName: "",
  hotelCity: "",
  hotelCountry: "",
  checkInDate: "",
  checkOutDate: "",
  roomType: "double",
  roomCount: 1,
  guestCount: 1,
  confirmationNumber: "",

  visaCountry: "",
  visaType: "tourist",
  passportNumber: "",
  passportExpiry: "",
  applicationDate: "",
  appointmentDate: "",
  submissionDate: "",
  expectedApprovalDate: "",
  visaFee: 0,
  serviceFee: 0,

  routeDescription: "",
  pickupLocation: "",
  dropoffLocation: "",
  pickupDate: "",
  pickupTime: "",
  vehicleType: "",
  driverName: "",
  driverPhone: "",
  transportVendor: "",

  packageTitleSnapshot: "",
  packageCodeSnapshot: "",
  customizations: "",

  instituteName: "",
  courseProgram: "",
  enrollmentDate: "",

  workCountry: "",
  employer: "",
  jobTitle: "",
  contractDuration: "",
  medicalStatus: "pending",
  bmetRegistration: "",
};
