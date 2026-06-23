import type { ServiceType } from "@/lib/serviceTypes";
import type { TravelPackageDay, TravelPackageInclusion, TravelPackagePricing } from "@/lib/travelPackageApi";

export interface PackageQuickTemplateForm {
  code: string;
  title: string;
  serviceType: ServiceType;
  summary: string;
  destination: string;
  country: string;
  durationDays: number;
  durationNights: number;
  basePrice: number;
  currency: string;
  visaRequired: boolean;
  cancellationPolicy: string;
}

export interface PackageQuickTemplate {
  id: string;
  labelEn: string;
  labelBn: string;
  serviceTypes: ServiceType[];
  form: PackageQuickTemplateForm;
  days: TravelPackageDay[];
  inclusions: TravelPackageInclusion[];
  pricing: TravelPackagePricing[];
}

export const PACKAGE_QUICK_TEMPLATES: PackageQuickTemplate[] = [
  {
    id: "th-bkk-pattaya",
    labelEn: "Thailand — Bangkok & Pattaya (5N/6D)",
    labelBn: "থাইল্যান্ড — ব্যাংকক ও পাট্টায়া (৫রাত/৬দিন)",
    serviceTypes: ["tour_international"],
    form: {
      code: "TH-BKK-5N6D",
      title: "Bangkok & Pattaya Family Tour — 5 Nights / 6 Days",
      serviceType: "tour_international",
      summary: "Round-trip flights, 3N Bangkok + 2N Pattaya hotels with breakfast, airport transfers, city tour, and Coral Island excursion.",
      destination: "Bangkok",
      country: "Thailand",
      durationDays: 6,
      durationNights: 5,
      basePrice: 45000,
      currency: "BDT",
      visaRequired: false,
      cancellationPolicy: "50% advance non-refundable within 7 days of departure. Balance due 15 days before travel.",
    },
    days: [
      { dayNumber: 1, title: "Arrival Bangkok", description: "Airport pickup and hotel check-in. Evening free.", overnightLocation: "Bangkok" },
      { dayNumber: 2, title: "Bangkok City Tour", description: "Grand Palace, Wat Pho, Wat Arun with lunch.", overnightLocation: "Bangkok" },
      { dayNumber: 3, title: "Bangkok → Pattaya", description: "Transfer to Pattaya. Beach time.", overnightLocation: "Pattaya" },
      { dayNumber: 4, title: "Coral Island Tour", description: "Speedboat, snorkeling, island lunch.", overnightLocation: "Pattaya" },
      { dayNumber: 5, title: "Free Day", description: "Shopping or optional tours.", overnightLocation: "Pattaya" },
      { dayNumber: 6, title: "Departure", description: "Checkout and airport transfer.", overnightLocation: "—" },
    ],
    inclusions: [
      { type: "included", label: "Return airfare DAC ↔ BKK", sortOrder: 0 },
      { type: "included", label: "Hotel with daily breakfast", sortOrder: 1 },
      { type: "included", label: "Airport transfers", sortOrder: 2 },
      { type: "excluded", label: "Personal expenses & tips", sortOrder: 3 },
    ],
    pricing: [{ label: "Per person (twin share)", travelerMin: 2, travelerMax: null, price: 45000, currency: "BDT" }],
  },
  {
    id: "ae-dubai",
    labelEn: "Dubai — City & Desert (4N/5D)",
    labelBn: "দুবাই — সিটি ও ডেজার্ট (৪রাত/৫দিন)",
    serviceTypes: ["tour_international"],
    form: {
      code: "AE-DXB-4N5D",
      title: "Dubai Highlights — 4 Nights / 5 Days",
      serviceType: "tour_international",
      summary: "Return flights, 4-star hotel, city tour, desert safari with BBQ dinner, and Marina dhow cruise.",
      destination: "Dubai",
      country: "United Arab Emirates",
      durationDays: 5,
      durationNights: 4,
      basePrice: 62000,
      currency: "BDT",
      visaRequired: true,
      cancellationPolicy: "Advance 40% at booking. Full payment 20 days before departure.",
    },
    days: [
      { dayNumber: 1, title: "Arrival Dubai", description: "Meet & greet, hotel check-in.", overnightLocation: "Dubai" },
      { dayNumber: 2, title: "City Tour", description: "Burj Khalifa area, Dubai Mall, old Dubai creek.", overnightLocation: "Dubai" },
      { dayNumber: 3, title: "Desert Safari", description: "Dune bashing, camel ride, BBQ dinner.", overnightLocation: "Dubai" },
      { dayNumber: 4, title: "Marina Cruise", description: "Dhow cruise dinner. Free morning.", overnightLocation: "Dubai" },
      { dayNumber: 5, title: "Departure", description: "Checkout and airport transfer.", overnightLocation: "—" },
    ],
    inclusions: [
      { type: "included", label: "Return airfare", sortOrder: 0 },
      { type: "included", label: "4-star hotel B&B", sortOrder: 1 },
      { type: "included", label: "Desert safari + dhow cruise", sortOrder: 2 },
      { type: "excluded", label: "UAE visa fee (if applicable)", sortOrder: 3 },
    ],
    pricing: [{ label: "Per person (twin share)", travelerMin: 2, travelerMax: null, price: 62000, currency: "BDT" }],
  },
  {
    id: "bd-coxs-bazar",
    labelEn: "Cox's Bazar Beach (3N/4D)",
    labelBn: "কক্সবাজার বিচ (৩রাত/৪দিন)",
    serviceTypes: ["tour_domestic"],
    form: {
      code: "BD-CXB-3N4D",
      title: "Cox's Bazar Beach Holiday — 3 Nights / 4 Days",
      serviceType: "tour_domestic",
      summary: "Dhaka–Cox's Bazar transport, sea-view resort, Inani Beach and Himchari visit.",
      destination: "Cox's Bazar",
      country: "Bangladesh",
      durationDays: 4,
      durationNights: 3,
      basePrice: 18500,
      currency: "BDT",
      visaRequired: false,
      cancellationPolicy: "25% cancellation charge within 72 hours of check-in.",
    },
    days: [
      { dayNumber: 1, title: "Dhaka → Cox's Bazar", description: "Travel and hotel check-in.", overnightLocation: "Cox's Bazar" },
      { dayNumber: 2, title: "Beach Day", description: "Leisure at Laboni Beach.", overnightLocation: "Cox's Bazar" },
      { dayNumber: 3, title: "Inani & Himchari", description: "Sightseeing tour.", overnightLocation: "Cox's Bazar" },
      { dayNumber: 4, title: "Return", description: "Checkout and return to Dhaka.", overnightLocation: "—" },
    ],
    inclusions: [
      { type: "included", label: "AC transport Dhaka ↔ Cox's Bazar", sortOrder: 0 },
      { type: "included", label: "Resort accommodation", sortOrder: 1 },
      { type: "excluded", label: "Meals unless specified", sortOrder: 2 },
    ],
    pricing: [{ label: "Per person", travelerMin: 1, travelerMax: null, price: 18500, currency: "BDT" }],
  },
  {
    id: "sa-umrah-economy",
    labelEn: "Umrah Economy Package (10D)",
    labelBn: "উমরাহ ইকোনমি প্যাকেজ (১০দিন)",
    serviceTypes: ["hajj_umrah"],
    form: {
      code: "UMR-ECO-10D",
      title: "Umrah Economy Package — 10 Days",
      serviceType: "hajj_umrah",
      summary: "Return flights, Makkah 5N + Madinah 4N economy hotels, visa, ground transport, and ziyarat.",
      destination: "Makkah",
      country: "Saudi Arabia",
      durationDays: 10,
      durationNights: 9,
      basePrice: 145000,
      currency: "BDT",
      visaRequired: true,
      cancellationPolicy: "Airline and visa rules apply. Agency service fee may be non-refundable after visa issue.",
    },
    days: [
      { dayNumber: 1, title: "Departure to Jeddah", description: "Flight from Dhaka.", overnightLocation: "Flight" },
      { dayNumber: 2, title: "Umrah & Makkah", description: "Transfer to Makkah hotel. Perform Umrah.", overnightLocation: "Makkah" },
      { dayNumber: 3, title: "Makkah Stay", description: "Ibadah and optional ziyarat.", overnightLocation: "Makkah" },
      { dayNumber: 7, title: "Madinah Transfer", description: "Travel to Madinah.", overnightLocation: "Madinah" },
      { dayNumber: 10, title: "Return", description: "Departure to Bangladesh.", overnightLocation: "—" },
    ],
    inclusions: [
      { type: "included", label: "Return airfare", sortOrder: 0 },
      { type: "included", label: "Umrah visa", sortOrder: 1 },
      { type: "included", label: "Makkah & Madinah hotels", sortOrder: 2 },
      { type: "included", label: "Ground transport", sortOrder: 3 },
      { type: "excluded", label: "Food & personal shopping", sortOrder: 4 },
    ],
    pricing: [{ label: "Per pilgrim (quad share)", travelerMin: 1, travelerMax: null, price: 145000, currency: "BDT" }],
  },
  {
    id: "visa-schengen",
    labelEn: "Schengen Tourist Visa Service",
    labelBn: "শেনজেন ট্যুরিস্ট ভিসা সার্ভিস",
    serviceTypes: ["visa"],
    form: {
      code: "VISA-SCH-TUR",
      title: "Schengen Tourist Visa — Document & Appointment Service",
      serviceType: "visa",
      summary: "Document checklist, form filling, appointment booking, and file submission support for Schengen tourist visa.",
      destination: "Germany",
      country: "Germany",
      durationDays: 1,
      durationNights: 0,
      basePrice: 15000,
      currency: "BDT",
      visaRequired: false,
      cancellationPolicy: "Service fee non-refundable after embassy appointment is booked.",
    },
    days: [],
    inclusions: [
      { type: "included", label: "Document checklist review", sortOrder: 0 },
      { type: "included", label: "Application form assistance", sortOrder: 1 },
      { type: "included", label: "VFS appointment booking", sortOrder: 2 },
      { type: "excluded", label: "Embassy visa fee & VFS charge", sortOrder: 3 },
    ],
    pricing: [{ label: "Service fee per applicant", travelerMin: 1, travelerMax: null, price: 15000, currency: "BDT" }],
  },
  {
    id: "my-kuala-lumpur",
    labelEn: "Malaysia — Kuala Lumpur (4N/5D)",
    labelBn: "মালয়েশিয়া — কুয়ালালামপুর (৪রাত/৫দিন)",
    serviceTypes: ["tour_international"],
    form: {
      code: "MY-KUL-4N5D",
      title: "Kuala Lumpur City Break — 4 Nights / 5 Days",
      serviceType: "tour_international",
      summary: "Return flights, 4-star hotel, KL city tour, Batu Caves, and Genting day trip.",
      destination: "Kuala Lumpur",
      country: "Malaysia",
      durationDays: 5,
      durationNights: 4,
      basePrice: 38000,
      currency: "BDT",
      visaRequired: false,
      cancellationPolicy: "30% advance at booking. Balance 14 days before departure.",
    },
    days: [
      { dayNumber: 1, title: "Arrival KL", description: "Airport transfer and hotel check-in.", overnightLocation: "Kuala Lumpur" },
      { dayNumber: 2, title: "KL City Tour", description: "Petronas area, Batu Caves, local markets.", overnightLocation: "Kuala Lumpur" },
      { dayNumber: 3, title: "Genting Highlands", description: "Day trip to Genting.", overnightLocation: "Kuala Lumpur" },
      { dayNumber: 4, title: "Free Day", description: "Shopping at Bukit Bintang.", overnightLocation: "Kuala Lumpur" },
      { dayNumber: 5, title: "Departure", description: "Checkout and airport transfer.", overnightLocation: "—" },
    ],
    inclusions: [
      { type: "included", label: "Return airfare DAC ↔ KUL", sortOrder: 0 },
      { type: "included", label: "Hotel with breakfast", sortOrder: 1 },
      { type: "included", label: "City tour + Genting trip", sortOrder: 2 },
      { type: "excluded", label: "Meals not mentioned", sortOrder: 3 },
    ],
    pricing: [{ label: "Per person (twin share)", travelerMin: 2, travelerMax: null, price: 38000, currency: "BDT" }],
  },
  {
    id: "sg-singapore",
    labelEn: "Singapore Family (3N/4D)",
    labelBn: "সিঙ্গাপুর ফ্যামিলি (৩রাত/৪দিন)",
    serviceTypes: ["tour_international"],
    form: {
      code: "SG-SIN-3N4D",
      title: "Singapore Family Holiday — 3 Nights / 4 Days",
      serviceType: "tour_international",
      summary: "Flights, city hotel, Sentosa, Gardens by the Bay, and Night Safari.",
      destination: "Singapore",
      country: "Singapore",
      durationDays: 4,
      durationNights: 3,
      basePrice: 52000,
      currency: "BDT",
      visaRequired: false,
      cancellationPolicy: "50% advance non-refundable within 10 days of travel.",
    },
    days: [
      { dayNumber: 1, title: "Arrival Singapore", description: "Transfer and Marina Bay evening.", overnightLocation: "Singapore" },
      { dayNumber: 2, title: "Sentosa & Gardens", description: "Sentosa island and Gardens by the Bay.", overnightLocation: "Singapore" },
      { dayNumber: 3, title: "City & Night Safari", description: "Merlion, Orchard Road, Night Safari.", overnightLocation: "Singapore" },
      { dayNumber: 4, title: "Departure", description: "Checkout and airport transfer.", overnightLocation: "—" },
    ],
    inclusions: [
      { type: "included", label: "Return airfare", sortOrder: 0 },
      { type: "included", label: "3-star hotel B&B", sortOrder: 1 },
      { type: "included", label: "Sentosa + Night Safari tickets", sortOrder: 2 },
      { type: "excluded", label: "Singapore visa (if required)", sortOrder: 3 },
    ],
    pricing: [{ label: "Per person (twin share)", travelerMin: 2, travelerMax: null, price: 52000, currency: "BDT" }],
  },
  {
    id: "tr-istanbul",
    labelEn: "Turkey — Istanbul (5N/6D)",
    labelBn: "তুরস্ক — ইস্তানবুল (৫রাত/৬দিন)",
    serviceTypes: ["tour_international"],
    form: {
      code: "TR-IST-5N6D",
      title: "Istanbul Heritage Tour — 5 Nights / 6 Days",
      serviceType: "tour_international",
      summary: "Return flights, boutique hotel, Bosphorus cruise, Hagia Sophia, Grand Bazaar, and Cappadocia day trip option.",
      destination: "Istanbul",
      country: "Turkey",
      durationDays: 6,
      durationNights: 5,
      basePrice: 75000,
      currency: "BDT",
      visaRequired: true,
      cancellationPolicy: "40% advance at booking. Turkey e-visa assistance included.",
    },
    days: [
      { dayNumber: 1, title: "Arrival Istanbul", description: "Airport pickup and old city hotel.", overnightLocation: "Istanbul" },
      { dayNumber: 2, title: "Old City Tour", description: "Hagia Sophia, Blue Mosque, Hippodrome.", overnightLocation: "Istanbul" },
      { dayNumber: 3, title: "Bosphorus Cruise", description: "Half-day cruise and Spice Bazaar.", overnightLocation: "Istanbul" },
      { dayNumber: 4, title: "Free Day / Cappadocia option", description: "Leisure or optional day trip.", overnightLocation: "Istanbul" },
      { dayNumber: 5, title: "Grand Bazaar", description: "Shopping and Turkish bath option.", overnightLocation: "Istanbul" },
      { dayNumber: 6, title: "Departure", description: "Checkout and airport transfer.", overnightLocation: "—" },
    ],
    inclusions: [
      { type: "included", label: "Return airfare", sortOrder: 0 },
      { type: "included", label: "Boutique hotel B&B", sortOrder: 1 },
      { type: "included", label: "Bosphorus cruise", sortOrder: 2 },
      { type: "included", label: "Turkey e-visa assistance", sortOrder: 3 },
      { type: "excluded", label: "Cappadocia day trip (optional)", sortOrder: 4 },
    ],
    pricing: [{ label: "Per person (twin share)", travelerMin: 2, travelerMax: null, price: 75000, currency: "BDT" }],
  },
];

export function getPackageQuickTemplates(
  serviceType?: ServiceType | null,
  allowedServiceTypes?: ServiceType[],
): PackageQuickTemplate[] {
  const allowed = allowedServiceTypes?.length ? new Set(allowedServiceTypes) : null;
  return PACKAGE_QUICK_TEMPLATES.filter((tpl) => {
    if (serviceType && !tpl.serviceTypes.includes(serviceType)) return false;
    if (allowed && !tpl.serviceTypes.some((t) => allowed.has(t))) return false;
    return true;
  });
}
