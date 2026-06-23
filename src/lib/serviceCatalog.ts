import type { ServiceType } from "@/lib/serviceTypes";

export interface ServiceSubcategoryDef {
  id: string;
  /** Maps to TravelPackage / booking serviceType for filtering */
  legacyServiceType: ServiceType;
}

export interface ServiceCategoryDef {
  id: string;
  legacyServiceType: ServiceType;
  subcategories: ServiceSubcategoryDef[];
}

/** Bangladesh travel-agency service catalog — 14 main categories with sub-services */
export const SERVICE_CATALOG: ServiceCategoryDef[] = [
  {
    id: "air_ticketing",
    legacyServiceType: "air_ticket",
    subcategories: [
      { id: "air_domestic_flight", legacyServiceType: "air_ticket" },
      { id: "air_international_flight", legacyServiceType: "air_ticket" },
      { id: "air_one_way", legacyServiceType: "air_ticket" },
      { id: "air_round_trip", legacyServiceType: "air_ticket" },
      { id: "air_multi_city", legacyServiceType: "air_ticket" },
      { id: "air_group_booking", legacyServiceType: "air_ticket" },
      { id: "air_corporate_flight", legacyServiceType: "air_ticket" },
      { id: "air_charter", legacyServiceType: "air_ticket" },
      { id: "air_rescheduling", legacyServiceType: "air_ticket" },
      { id: "air_cancellation_refund", legacyServiceType: "air_ticket" },
    ],
  },
  {
    id: "hajj_umrah",
    legacyServiceType: "hajj_umrah",
    subcategories: [
      { id: "hajj_package", legacyServiceType: "hajj_umrah" },
      { id: "umrah_package", legacyServiceType: "hajj_umrah" },
      { id: "ramadan_umrah", legacyServiceType: "hajj_umrah" },
      { id: "vip_umrah", legacyServiceType: "hajj_umrah" },
      { id: "family_umrah", legacyServiceType: "hajj_umrah" },
      { id: "hajj_visa", legacyServiceType: "hajj_umrah" },
      { id: "umrah_visa", legacyServiceType: "hajj_umrah" },
      { id: "makkah_hotel", legacyServiceType: "hajj_umrah" },
      { id: "madinah_hotel", legacyServiceType: "hajj_umrah" },
      { id: "ziyarah_tour", legacyServiceType: "hajj_umrah" },
      { id: "hajj_airport_transfer", legacyServiceType: "hajj_umrah" },
    ],
  },
  {
    id: "visa_processing",
    legacyServiceType: "visa",
    subcategories: [
      { id: "visa_tourist", legacyServiceType: "visa" },
      { id: "visa_business", legacyServiceType: "visa" },
      { id: "visa_student", legacyServiceType: "visa" },
      { id: "visa_medical", legacyServiceType: "visa" },
      { id: "visa_work", legacyServiceType: "visa" },
      { id: "visa_family_visit", legacyServiceType: "visa" },
      { id: "visa_transit", legacyServiceType: "visa" },
      { id: "visa_extension", legacyServiceType: "visa" },
      { id: "visa_consultation", legacyServiceType: "visa" },
      { id: "visa_document_verification", legacyServiceType: "visa" },
    ],
  },
  {
    id: "manpower",
    legacyServiceType: "b2b_agent",
    subcategories: [
      { id: "mp_overseas_recruitment", legacyServiceType: "b2b_agent" },
      { id: "mp_work_permit", legacyServiceType: "b2b_agent" },
      { id: "mp_employer_demand", legacyServiceType: "b2b_agent" },
      { id: "mp_candidate_registration", legacyServiceType: "b2b_agent" },
      { id: "mp_cv_preparation", legacyServiceType: "b2b_agent" },
      { id: "mp_interview_scheduling", legacyServiceType: "b2b_agent" },
      { id: "mp_medical_processing", legacyServiceType: "b2b_agent" },
      { id: "mp_bmet_processing", legacyServiceType: "b2b_agent" },
      { id: "mp_immigration_clearance", legacyServiceType: "b2b_agent" },
      { id: "mp_job_placement", legacyServiceType: "b2b_agent" },
      { id: "mp_training_orientation", legacyServiceType: "b2b_agent" },
    ],
  },
  {
    id: "hotel_accommodation",
    legacyServiceType: "hotel",
    subcategories: [
      { id: "hotel_booking", legacyServiceType: "hotel" },
      { id: "resort_booking", legacyServiceType: "hotel" },
      { id: "apartment_booking", legacyServiceType: "hotel" },
      { id: "villa_booking", legacyServiceType: "hotel" },
      { id: "guest_house", legacyServiceType: "hotel" },
      { id: "hostel_booking", legacyServiceType: "hotel" },
      { id: "corporate_accommodation", legacyServiceType: "hotel" },
      { id: "group_accommodation", legacyServiceType: "hotel" },
    ],
  },
  {
    id: "transportation",
    legacyServiceType: "transport",
    subcategories: [
      { id: "trans_airport_pickup", legacyServiceType: "transport" },
      { id: "trans_airport_drop", legacyServiceType: "transport" },
      { id: "trans_car_rental", legacyServiceType: "transport" },
      { id: "trans_microbus", legacyServiceType: "transport" },
      { id: "trans_bus_rental", legacyServiceType: "transport" },
      { id: "trans_chauffeur", legacyServiceType: "transport" },
      { id: "trans_vip", legacyServiceType: "transport" },
      { id: "trans_city", legacyServiceType: "transport" },
      { id: "trans_intercity", legacyServiceType: "transport" },
    ],
  },
  {
    id: "tour_packages",
    legacyServiceType: "tour_domestic",
    subcategories: [
      { id: "tour_domestic", legacyServiceType: "tour_domestic" },
      { id: "tour_coxs_bazar", legacyServiceType: "tour_domestic" },
      { id: "tour_sundarbans", legacyServiceType: "tour_domestic" },
      { id: "tour_sajek", legacyServiceType: "tour_domestic" },
      { id: "tour_sylhet", legacyServiceType: "tour_domestic" },
      { id: "tour_international", legacyServiceType: "tour_international" },
      { id: "tour_thailand", legacyServiceType: "tour_international" },
      { id: "tour_malaysia", legacyServiceType: "tour_international" },
      { id: "tour_singapore", legacyServiceType: "tour_international" },
      { id: "tour_dubai", legacyServiceType: "tour_international" },
      { id: "tour_turkey", legacyServiceType: "tour_international" },
      { id: "tour_europe", legacyServiceType: "tour_international" },
      { id: "tour_family", legacyServiceType: "tour_domestic" },
      { id: "tour_honeymoon", legacyServiceType: "tour_international" },
      { id: "tour_group", legacyServiceType: "tour_domestic" },
      { id: "tour_corporate", legacyServiceType: "corporate_travel" },
      { id: "tour_educational", legacyServiceType: "tour_domestic" },
      { id: "tour_adventure", legacyServiceType: "tour_domestic" },
      { id: "tour_medical", legacyServiceType: "medical_tourism" },
    ],
  },
  {
    id: "cruise_holiday",
    legacyServiceType: "cruise",
    subcategories: [
      { id: "cruise_ocean", legacyServiceType: "cruise" },
      { id: "cruise_river", legacyServiceType: "cruise" },
      { id: "cruise_luxury", legacyServiceType: "cruise" },
      { id: "holiday_package", legacyServiceType: "cruise" },
      { id: "beach_holiday", legacyServiceType: "cruise" },
      { id: "island_holiday", legacyServiceType: "cruise" },
      { id: "luxury_vacation", legacyServiceType: "cruise" },
      { id: "weekend_getaway", legacyServiceType: "cruise" },
    ],
  },
  {
    id: "study_abroad",
    legacyServiceType: "study_abroad",
    subcategories: [
      { id: "study_university", legacyServiceType: "study_abroad" },
      { id: "study_college", legacyServiceType: "study_abroad" },
      { id: "study_student_visa", legacyServiceType: "study_abroad" },
      { id: "study_scholarship", legacyServiceType: "study_abroad" },
      { id: "study_sop", legacyServiceType: "study_abroad" },
      { id: "study_application", legacyServiceType: "study_abroad" },
      { id: "study_accommodation", legacyServiceType: "study_abroad" },
      { id: "study_pre_departure", legacyServiceType: "study_abroad" },
    ],
  },
  {
    id: "corporate_travel",
    legacyServiceType: "corporate_travel",
    subcategories: [
      { id: "corp_travel_mgmt", legacyServiceType: "corporate_travel" },
      { id: "corp_employee_booking", legacyServiceType: "corporate_travel" },
      { id: "corp_conference", legacyServiceType: "corporate_travel" },
      { id: "corp_event", legacyServiceType: "mice_event" },
      { id: "corp_incentive", legacyServiceType: "corporate_travel" },
      { id: "corp_visa", legacyServiceType: "visa" },
      { id: "corp_hotel", legacyServiceType: "hotel" },
      { id: "corp_reporting", legacyServiceType: "corporate_travel" },
    ],
  },
  {
    id: "travel_documentation",
    legacyServiceType: "custom",
    subcategories: [
      { id: "doc_passport", legacyServiceType: "custom" },
      { id: "doc_passport_renewal", legacyServiceType: "custom" },
      { id: "doc_e_passport", legacyServiceType: "custom" },
      { id: "doc_travel_permit", legacyServiceType: "custom" },
      { id: "doc_immigration", legacyServiceType: "custom" },
      { id: "doc_notary", legacyServiceType: "custom" },
      { id: "doc_attestation", legacyServiceType: "custom" },
      { id: "doc_embassy_legalization", legacyServiceType: "custom" },
    ],
  },
  {
    id: "event_attraction",
    legacyServiceType: "mice_event",
    subcategories: [
      { id: "evt_theme_park", legacyServiceType: "mice_event" },
      { id: "evt_museum", legacyServiceType: "mice_event" },
      { id: "evt_concert", legacyServiceType: "mice_event" },
      { id: "evt_sports", legacyServiceType: "mice_event" },
      { id: "evt_expo", legacyServiceType: "mice_event" },
      { id: "evt_festival", legacyServiceType: "mice_event" },
      { id: "evt_entertainment", legacyServiceType: "mice_event" },
      { id: "evt_city_pass", legacyServiceType: "mice_event" },
    ],
  },
  {
    id: "travel_insurance",
    legacyServiceType: "custom",
    subcategories: [
      { id: "ins_single_trip", legacyServiceType: "custom" },
      { id: "ins_multi_trip", legacyServiceType: "custom" },
      { id: "ins_student", legacyServiceType: "custom" },
      { id: "ins_family", legacyServiceType: "custom" },
      { id: "ins_medical", legacyServiceType: "custom" },
      { id: "ins_hajj_umrah", legacyServiceType: "custom" },
      { id: "ins_business", legacyServiceType: "custom" },
    ],
  },
  {
    id: "additional_services",
    legacyServiceType: "custom",
    subcategories: [
      { id: "add_consultation", legacyServiceType: "custom" },
      { id: "add_currency_exchange", legacyServiceType: "custom" },
      { id: "add_intl_sim", legacyServiceType: "custom" },
      { id: "add_esim", legacyServiceType: "custom" },
      { id: "add_tour_guide", legacyServiceType: "custom" },
      { id: "add_meet_greet", legacyServiceType: "custom" },
      { id: "add_vip_airport", legacyServiceType: "custom" },
      { id: "add_lounge", legacyServiceType: "custom" },
      { id: "add_translation", legacyServiceType: "custom" },
      { id: "add_concierge", legacyServiceType: "custom" },
    ],
  },
];

const SUB_BY_ID = new Map<string, ServiceSubcategoryDef & { categoryId: string }>();
for (const cat of SERVICE_CATALOG) {
  for (const sub of cat.subcategories) {
    SUB_BY_ID.set(sub.id, { ...sub, categoryId: cat.id });
  }
}

export const ALL_SUBCATEGORY_IDS = [...SUB_BY_ID.keys()];

export const AGENCY_PRESETS = [
  { id: "hajj_agency", categoryIds: ["hajj_umrah", "visa_processing", "transportation"] },
  { id: "tour_agency", categoryIds: ["tour_packages", "hotel_accommodation", "transportation"] },
  { id: "visa_center", categoryIds: ["visa_processing", "travel_documentation"] },
  { id: "manpower_agency", categoryIds: ["manpower", "visa_processing", "travel_documentation"] },
  { id: "study_consultancy", categoryIds: ["study_abroad", "visa_processing"] },
  { id: "full_service", categoryIds: SERVICE_CATALOG.map((c) => c.id) },
] as const;

export type AgencyPresetId = (typeof AGENCY_PRESETS)[number]["id"];

export function getCategoryById(id: string): ServiceCategoryDef | undefined {
  return SERVICE_CATALOG.find((c) => c.id === id);
}

export function getSubcategoryIdsForCategories(categoryIds: string[]): string[] {
  const ids: string[] = [];
  for (const catId of categoryIds) {
    const cat = getCategoryById(catId);
    if (cat) ids.push(...cat.subcategories.map((s) => s.id));
  }
  return [...new Set(ids)];
}

export function getSubcategoryIdsForPreset(presetId: AgencyPresetId): string[] {
  const preset = AGENCY_PRESETS.find((p) => p.id === presetId);
  if (!preset) return [];
  return getSubcategoryIdsForCategories([...preset.categoryIds]);
}

export function normalizeEnabledSubcategories(values?: string[] | null): string[] {
  if (!values?.length) return [];
  const valid = new Set(ALL_SUBCATEGORY_IDS);
  return [...new Set(values.map((v) => String(v).trim()).filter((id) => valid.has(id)))];
}

export function deriveServiceTypesFromSubcategories(subcategoryIds: string[]): ServiceType[] {
  const types = new Set<ServiceType>();
  for (const id of subcategoryIds) {
    const sub = SUB_BY_ID.get(id);
    if (sub) types.add(sub.legacyServiceType);
  }
  return [...types];
}

export function deriveCategoryIdsFromSubcategories(subcategoryIds: string[]): string[] {
  const cats = new Set<string>();
  for (const id of subcategoryIds) {
    const sub = SUB_BY_ID.get(id);
    if (sub) cats.add(sub.categoryId);
  }
  return [...cats];
}

export function getLocalizedCategoryLabel(categoryId: string, isBn = false): string {
  const labels: Record<string, { en: string; bn: string }> = {
    air_ticketing: { en: "Air Ticketing", bn: "এয়ার টিকেটিং" },
    hajj_umrah: { en: "Hajj & Umrah", bn: "হজ্জ ও উমরাহ" },
    visa_processing: { en: "Visa Processing", bn: "ভিসা প্রসেসিং" },
    manpower: { en: "Manpower & Overseas Employment", bn: "ম্যানপাওয়ার ও বিদেশে কর্মসংস্থান" },
    hotel_accommodation: { en: "Hotel & Accommodation", bn: "হোটেল ও আবাসন" },
    transportation: { en: "Transportation", bn: "যানবাহন / ট্রান্সপোর্ট" },
    tour_packages: { en: "Tour Packages", bn: "ট্যুর প্যাকেজ" },
    cruise_holiday: { en: "Cruise & Holiday", bn: "ক্রুজ ও হলিডে" },
    study_abroad: { en: "Study Abroad", bn: "স্টাডি অ্যাবরড" },
    corporate_travel: { en: "Corporate Travel", bn: "কর্পোরেট ট্রাভেল" },
    travel_documentation: { en: "Travel Documentation", bn: "ট্রাভেল ডকুমেন্টেশন" },
    event_attraction: { en: "Event & Attraction Tickets", bn: "ইভেন্ট ও অ্যাট্রাকশন টিকেট" },
    travel_insurance: { en: "Travel Insurance", bn: "ট্রাভেল ইন্স্যুরেন্স" },
    additional_services: { en: "Additional Services", bn: "অতিরিক্ত সেবা" },
  };
  const row = labels[categoryId];
  if (!row) return categoryId;
  return isBn ? row.bn : row.en;
}

export function getLocalizedSubcategoryLabel(subId: string, isBn = false): string {
  const labels: Record<string, { en: string; bn: string }> = {
    air_domestic_flight: { en: "Domestic Flight Booking", bn: "ডোমেস্টিক ফ্লাইট বুকিং" },
    air_international_flight: { en: "International Flight Booking", bn: "আন্তর্জাতিক ফ্লাইট বুকিং" },
    air_one_way: { en: "One Way Ticket", bn: "ওয়ান ওয়ে টিকেট" },
    air_round_trip: { en: "Round Trip Ticket", bn: "রাউন্ড ট্রিপ টিকেট" },
    air_multi_city: { en: "Multi-City Flight", bn: "মাল্টি-সিটি ফ্লাইট" },
    air_group_booking: { en: "Group Flight Booking", bn: "গ্রুপ ফ্লাইট বুকিং" },
    air_corporate_flight: { en: "Corporate Flight Booking", bn: "কর্পোরেট ফ্লাইট বুকিং" },
    air_charter: { en: "Charter Flight", bn: "চার্টার ফ্লাইট" },
    air_rescheduling: { en: "Flight Rescheduling", bn: "ফ্লাইট রিশিডিউল" },
    air_cancellation_refund: { en: "Cancellation & Refund", bn: "বাতিল ও রিফান্ড" },
    hajj_package: { en: "Hajj Package", bn: "হজ্জ প্যাকেজ" },
    umrah_package: { en: "Umrah Package", bn: "উমরাহ প্যাকেজ" },
    ramadan_umrah: { en: "Ramadan Umrah Package", bn: "রমজান উমরাহ প্যাকেজ" },
    vip_umrah: { en: "VIP Umrah Package", bn: "ভিআইপি উমরাহ প্যাকেজ" },
    family_umrah: { en: "Family Umrah Package", bn: "ফ্যামিলি উমরাহ প্যাকেজ" },
    hajj_visa: { en: "Hajj Visa", bn: "হজ্জ ভিসা" },
    umrah_visa: { en: "Umrah Visa", bn: "উমরাহ ভিসা" },
    makkah_hotel: { en: "Makkah Hotel Booking", bn: "মক্কা হোটেল বুকিং" },
    madinah_hotel: { en: "Madinah Hotel Booking", bn: "মদিনা হোটেল বুকিং" },
    ziyarah_tour: { en: "Ziyarah Tour", bn: "জিয়ারাত ট্যুর" },
    hajj_airport_transfer: { en: "Airport Transfer", bn: "এয়ারপোর্ট ট্রান্সফার" },
    visa_tourist: { en: "Tourist Visa", bn: "ট্যুরিস্ট ভিসা" },
    visa_business: { en: "Business Visa", bn: "বিজনেস ভিসা" },
    visa_student: { en: "Student Visa", bn: "স্টুডেন্ট ভিসা" },
    visa_medical: { en: "Medical Visa", bn: "মেডিকেল ভিসা" },
    visa_work: { en: "Work Visa", bn: "ওয়ার্ক ভিসা" },
    visa_family_visit: { en: "Family Visit Visa", bn: "ফ্যামিলি ভিজিট ভিসা" },
    visa_transit: { en: "Transit Visa", bn: "ট্রানজিট ভিসা" },
    visa_extension: { en: "Visa Extension", bn: "ভিসা এক্সটেনশন" },
    visa_consultation: { en: "Visa Consultation", bn: "ভিসা কনসালটেশন" },
    visa_document_verification: { en: "Document Verification", bn: "ডকুমেন্ট ভেরিফিকেশন" },
    mp_overseas_recruitment: { en: "Overseas Recruitment", bn: "বিদেশে নিয়োগ" },
    mp_work_permit: { en: "Work Permit Processing", bn: "ওয়ার্ক পারমিট প্রসেসিং" },
    mp_employer_demand: { en: "Employer Demand Management", bn: "এমপ্লয়ার ডিমান্ড ম্যানেজমেন্ট" },
    mp_candidate_registration: { en: "Candidate Registration", bn: "প্রার্থী নিবন্ধন" },
    mp_cv_preparation: { en: "CV Preparation", bn: "সিভি প্রস্তুতি" },
    mp_interview_scheduling: { en: "Interview Scheduling", bn: "ইন্টারভিউ শিডিউলিং" },
    mp_medical_processing: { en: "Medical Processing", bn: "মেডিকেল প্রসেসিং" },
    mp_bmet_processing: { en: "BMET Processing", bn: "বিএমইটি প্রসেসিং" },
    mp_immigration_clearance: { en: "Immigration Clearance", bn: "ইমিগ্রেশন ক্লিয়ারেন্স" },
    mp_job_placement: { en: "Overseas Job Placement", bn: "বিদেশে চাকরি প্লেসমেন্ট" },
    mp_training_orientation: { en: "Training & Orientation", bn: "ট্রেনিং ও ওরিয়েন্টেশন" },
    hotel_booking: { en: "Hotel Booking", bn: "হোটেল বুকিং" },
    resort_booking: { en: "Resort Booking", bn: "রিসোর্ট বুকিং" },
    apartment_booking: { en: "Apartment Booking", bn: "অ্যাপার্টমেন্ট বুকিং" },
    villa_booking: { en: "Villa Booking", bn: "ভিলা বুকিং" },
    guest_house: { en: "Guest House Booking", bn: "গেস্ট হাউস বুকিং" },
    hostel_booking: { en: "Hostel Booking", bn: "হোস্টেল বুকিং" },
    corporate_accommodation: { en: "Corporate Accommodation", bn: "কর্পোরেট আবাসন" },
    group_accommodation: { en: "Group Accommodation", bn: "গ্রুপ আবাসন" },
    trans_airport_pickup: { en: "Airport Pickup", bn: "এয়ারপোর্ট পিকআপ" },
    trans_airport_drop: { en: "Airport Drop", bn: "এয়ারপোর্ট ড্রপ" },
    trans_car_rental: { en: "Car Rental", bn: "গাড়ি ভাড়া" },
    trans_microbus: { en: "Microbus Rental", bn: "মাইক্রোবাস ভাড়া" },
    trans_bus_rental: { en: "Bus Rental", bn: "বাস ভাড়া" },
    trans_chauffeur: { en: "Chauffeur Service", bn: "চালক সহ গাড়ি" },
    trans_vip: { en: "VIP Transport", bn: "ভিআইপি ট্রান্সপোর্ট" },
    trans_city: { en: "City Transfer", bn: "সিটি ট্রান্সফার" },
    trans_intercity: { en: "Intercity Transfer", bn: "আন্তঃনগর ট্রান্সফার" },
    tour_domestic: { en: "Domestic Tours", bn: "দেশীয় ট্যুর" },
    tour_coxs_bazar: { en: "Cox's Bazar Tour", bn: "কক্সবাজার ট্যুর" },
    tour_sundarbans: { en: "Sundarbans Tour", bn: "সুন্দরবন ট্যুর" },
    tour_sajek: { en: "Sajek Tour", bn: "সাজেক ট্যুর" },
    tour_sylhet: { en: "Sylhet Tour", bn: "সিলেট ট্যুর" },
    tour_international: { en: "International Tours", bn: "আন্তর্জাতিক ট্যুর" },
    tour_thailand: { en: "Thailand Tour", bn: "থাইল্যান্ড ট্যুর" },
    tour_malaysia: { en: "Malaysia Tour", bn: "মালয়েশিয়া ট্যুর" },
    tour_singapore: { en: "Singapore Tour", bn: "সিঙ্গাপুর ট্যুর" },
    tour_dubai: { en: "Dubai Tour", bn: "দুবাই ট্যুর" },
    tour_turkey: { en: "Turkey Tour", bn: "তুরস্ক ট্যুর" },
    tour_europe: { en: "Europe Tour", bn: "ইউরোপ ট্যুর" },
    tour_family: { en: "Family Tour", bn: "ফ্যামিলি ট্যুর" },
    tour_honeymoon: { en: "Honeymoon Tour", bn: "হানিমুন ট্যুর" },
    tour_group: { en: "Group Tour", bn: "গ্রুপ ট্যুর" },
    tour_corporate: { en: "Corporate Tour", bn: "কর্পোরেট ট্যুর" },
    tour_educational: { en: "Educational Tour", bn: "শিক্ষা ট্যুর" },
    tour_adventure: { en: "Adventure Tour", bn: "অ্যাডভেঞ্চার ট্যুর" },
    tour_medical: { en: "Medical Tourism", bn: "মেডিকেল ট্যুরিজম" },
    cruise_ocean: { en: "Ocean Cruise", bn: "সমুদ্র ক্রুজ" },
    cruise_river: { en: "River Cruise", bn: "নদী ক্রুজ" },
    cruise_luxury: { en: "Luxury Cruise", bn: "লাক্সারি ক্রুজ" },
    holiday_package: { en: "Holiday Package", bn: "হলিডে প্যাকেজ" },
    beach_holiday: { en: "Beach Holiday", bn: "বিচ হলিডে" },
    island_holiday: { en: "Island Holiday", bn: "আইল্যান্ড হলিডে" },
    luxury_vacation: { en: "Luxury Vacation", bn: "লাক্সারি ভ্যাকেশন" },
    weekend_getaway: { en: "Weekend Getaway", bn: "উইকেন্ড গেটঅ্যাওয়ে" },
    study_university: { en: "University Admission", bn: "বিশ্ববিদ্যালয় ভর্তি" },
    study_college: { en: "College Admission", bn: "কলেজ ভর্তি" },
    study_student_visa: { en: "Student Visa", bn: "স্টুডেন্ট ভিসা" },
    study_scholarship: { en: "Scholarship Assistance", bn: "স্কলারশিপ সহায়তা" },
    study_sop: { en: "SOP Assistance", bn: "এসওপি সহায়তা" },
    study_application: { en: "Application Processing", bn: "আবেদন প্রসেসিং" },
    study_accommodation: { en: "Accommodation Support", bn: "আবাসন সহায়তা" },
    study_pre_departure: { en: "Pre-Departure Guidance", bn: "প্রি-ডিপারচার গাইডেন্স" },
    corp_travel_mgmt: { en: "Business Travel Management", bn: "বিজনেস ট্রাভেল ম্যানেজমেন্ট" },
    corp_employee_booking: { en: "Employee Travel Booking", bn: "কর্মচারী ট্রাভেল বুকিং" },
    corp_conference: { en: "Conference Travel", bn: "কনফারেন্স ট্রাভেল" },
    corp_event: { en: "Event Travel", bn: "ইভেন্ট ট্রাভেল" },
    corp_incentive: { en: "Incentive Travel", bn: "ইনসেনটিভ ট্রাভেল" },
    corp_visa: { en: "Corporate Visa Service", bn: "কর্পোরেট ভিসা সেবা" },
    corp_hotel: { en: "Corporate Hotel Booking", bn: "কর্পোরেট হোটেল বুকিং" },
    corp_reporting: { en: "Corporate Reporting", bn: "কর্পোরেট রিপোর্টিং" },
    doc_passport: { en: "Passport Processing", bn: "পাসপোর্ট প্রসেসিং" },
    doc_passport_renewal: { en: "Passport Renewal", bn: "পাসপোর্ট নবায়ন" },
    doc_e_passport: { en: "E-Passport Service", bn: "ই-পাসপোর্ট সেবা" },
    doc_travel_permit: { en: "Travel Permit", bn: "ট্রাভেল পারমিট" },
    doc_immigration: { en: "Immigration Assistance", bn: "ইমিগ্রেশন সহায়তা" },
    doc_notary: { en: "Notary Service", bn: "নোটারি সেবা" },
    doc_attestation: { en: "Attestation Service", bn: "অ্যাটেস্টেশন সেবা" },
    doc_embassy_legalization: { en: "Embassy Legalization", bn: "এম্বাসি লিগ্যালাইজেশন" },
    evt_theme_park: { en: "Theme Park Tickets", bn: "থিম পার্ক টিকেট" },
    evt_museum: { en: "Museum Tickets", bn: "জাদুঘর টিকেট" },
    evt_concert: { en: "Concert Tickets", bn: "কনসার্ট টিকেট" },
    evt_sports: { en: "Sports Tickets", bn: "স্পোর্টস টিকেট" },
    evt_expo: { en: "Expo Tickets", bn: "এক্সপো টিকেট" },
    evt_festival: { en: "Festival Tickets", bn: "ফেস্টিভাল টিকেট" },
    evt_entertainment: { en: "Entertainment Tickets", bn: "এন্টারটেইনমেন্ট টিকেট" },
    evt_city_pass: { en: "City Attraction Pass", bn: "সিটি অ্যাট্রাকশন পাস" },
    ins_single_trip: { en: "Single Trip Insurance", bn: "সিঙ্গেল ট্রিপ ইন্স্যুরেন্স" },
    ins_multi_trip: { en: "Multi Trip Insurance", bn: "মাল্টি ট্রিপ ইন্স্যুরেন্স" },
    ins_student: { en: "Student Travel Insurance", bn: "স্টুডেন্ট ট্রাভেল ইন্স্যুরেন্স" },
    ins_family: { en: "Family Travel Insurance", bn: "ফ্যামিলি ট্রাভেল ইন্স্যুরেন্স" },
    ins_medical: { en: "Medical Travel Insurance", bn: "মেডিকেল ট্রাভেল ইন্স্যুরেন্স" },
    ins_hajj_umrah: { en: "Hajj & Umrah Insurance", bn: "হজ্জ ও উমরাহ ইন্স্যুরেন্স" },
    ins_business: { en: "Business Travel Insurance", bn: "বিজনেস ট্রাভেল ইন্স্যুরেন্স" },
    add_consultation: { en: "Travel Consultation", bn: "ট্রাভেল কনসালটেশন" },
    add_currency_exchange: { en: "Currency Exchange Assistance", bn: "মুদ্রা বিনিময় সহায়তা" },
    add_intl_sim: { en: "International SIM Card", bn: "আন্তর্জাতিক সিম কার্ড" },
    add_esim: { en: "eSIM Service", bn: "ই-সিম সেবা" },
    add_tour_guide: { en: "Tour Guide Service", bn: "ট্যুর গাইড সেবা" },
    add_meet_greet: { en: "Meet & Greet Service", bn: "মিট অ্যান্ড গ্রিট সেবা" },
    add_vip_airport: { en: "VIP Airport Assistance", bn: "ভিআইপি এয়ারপোর্ট সহায়তা" },
    add_lounge: { en: "Lounge Access", bn: "লাউঞ্জ অ্যাক্সেস" },
    add_translation: { en: "Translation Service", bn: "অনুবাদ সেবা" },
    add_concierge: { en: "Concierge Service", bn: "কনসিয়ার্জ সেবা" },
  };
  const row = labels[subId];
  if (!row) return subId.replace(/_/g, " ");
  return isBn ? row.bn : row.en;
}

export function getLocalizedPresetLabel(presetId: AgencyPresetId, isBn = false): string {
  const labels: Record<AgencyPresetId, { en: string; bn: string }> = {
    hajj_agency: { en: "Hajj & Umrah Agency", bn: "হজ্জ-উমরাহ এজেন্সি" },
    tour_agency: { en: "Tour & Travel Agency", bn: "ট্যুর ও ট্রাভেল এজেন্সি" },
    visa_center: { en: "Visa Center", bn: "ভিসা সেন্টার" },
    manpower_agency: { en: "Manpower Agency", bn: "ম্যানপাওয়ার এজেন্সি" },
    study_consultancy: { en: "Study Abroad Consultancy", bn: "স্টাডি অ্যাবরড কনসালটেন্সি" },
    full_service: { en: "Full Service Travel Agency", bn: "ফুল সার্ভিস ট্রাভেল এজেন্সি" },
  };
  const row = labels[presetId];
  return isBn ? row.bn : row.en;
}

export function buildTenantServicePayload(subcategoryIds: string[]) {
  const enabledSubcategories = normalizeEnabledSubcategories(subcategoryIds);
  const enabledServiceTypes = deriveServiceTypesFromSubcategories(enabledSubcategories);
  return { enabledSubcategories, enabledServiceTypes };
}
