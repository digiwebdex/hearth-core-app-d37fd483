import {
  Plane, StickyNote, Building2, Hotel, Palmtree, Briefcase, Bus, ShieldCheck,
  GraduationCap, Users, Map, Ship, Moon,
  Contact, CalendarCheck, Calculator, Boxes, UserCog, Wallet, Globe, BarChart3,
  Megaphone, Workflow, Network, UserPlus, KeyRound, ShieldHalf,
  type LucideIcon,
} from "lucide-react";

// ── Public-website content model ──
// Single source of truth for the marketing site's Business Services and Platform
// Modules, shared by the homepage, the Modules page and the Solutions page.
//
// IMPORTANT (v2 capability model): Business SERVICES are what agencies SELL. They
// are chosen at onboarding and are NEVER gated by SaaS plan. Platform MODULES are
// what the SaaS product provides; some carry a plan tier.

export interface MarketingItem {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
}

/** The 13 travel business services an agency can sell — never plan-gated. */
export const TRAVEL_SERVICES: MarketingItem[] = [
  { id: "air_ticket", name: "Air Ticket", desc: "Domestic & international ticketing with fare, PNR and reissue tracking.", icon: Plane },
  { id: "visa", name: "Visa", desc: "Tourist, business and work visa processing with document checklists.", icon: StickyNote },
  { id: "hajj", name: "Hajj", desc: "Pilgrim groups, packages, rooming and installment management.", icon: Building2 },
  { id: "umrah", name: "Umrah", desc: "Year-round Umrah packages, group departures and operations desk.", icon: Moon },
  { id: "hotel", name: "Hotel", desc: "Hotel bookings and contracted rates for individuals and groups.", icon: Hotel },
  { id: "holiday", name: "Holiday", desc: "Domestic & international holiday packages with day-wise itineraries.", icon: Palmtree },
  { id: "corporate", name: "Corporate Travel", desc: "Corporate accounts, travel policies and approval workflows.", icon: Briefcase },
  { id: "transport", name: "Transport", desc: "Ground transport, car rental and coach arrangements.", icon: Bus },
  { id: "insurance", name: "Insurance", desc: "Travel & medical insurance add-ons attached to any booking.", icon: ShieldCheck },
  { id: "student", name: "Student Visa", desc: "Study-abroad admissions, student visa and consultancy pipeline.", icon: GraduationCap },
  { id: "manpower", name: "Manpower", desc: "Overseas employment, recruitment and manpower processing.", icon: Users },
  { id: "group_tour", name: "Group Tour", desc: "Group departures, MICE and event travel with rooming lists.", icon: Map },
  { id: "cruise", name: "Cruise", desc: "Cruise and launch holiday bookings with cabin management.", icon: Ship },
];

/** The 14 platform modules the SaaS provides. */
export const PLATFORM_MODULES: MarketingItem[] = [
  { id: "crm", name: "CRM", desc: "Clients, leads and follow-ups with a unified inquiry pipeline.", icon: Contact },
  { id: "booking", name: "Booking", desc: "One generic booking engine for every travel service.", icon: CalendarCheck },
  { id: "accounting", name: "Accounting", desc: "Receivables, payables, cash/bank ledger and profitability.", icon: Calculator },
  { id: "inventory", name: "Inventory", desc: "Visa stock, ticket stock and allotment tracking.", icon: Boxes },
  { id: "hr", name: "HR", desc: "Staff profiles, attendance and leave management.", icon: UserCog },
  { id: "payroll", name: "Payroll", desc: "Salary structures, payroll runs and payslips.", icon: Wallet },
  { id: "website_cms", name: "Website CMS", desc: "Your own public website & builder with a custom domain.", icon: Globe },
  { id: "reports", name: "Reports", desc: "Sales, payments, staff and profitability analytics.", icon: BarChart3 },
  { id: "marketing", name: "Marketing", desc: "SMS, email and WhatsApp campaigns, loyalty and referrals.", icon: Megaphone },
  { id: "automation", name: "Automation", desc: "Rule-based notifications and multi-step workflow engine.", icon: Workflow },
  { id: "branch", name: "Branch", desc: "Multi-branch operations with per-branch reporting.", icon: Network },
  { id: "user_management", name: "User Management", desc: "Invite staff, assign branches and manage accounts.", icon: UserPlus },
  { id: "roles", name: "Roles", desc: "Predefined roles for owner, manager, sales, accounts & ops.", icon: KeyRound },
  { id: "permissions", name: "Permissions", desc: "Fine-grained module & action permissions, enforced server-side.", icon: ShieldHalf },
];

export interface IndustrySolution {
  id: string;
  name: string;
  tagline: string;
  services: string[]; // service names showcased
  icon: LucideIcon;
}

/** Industry solutions (onboarding presets) — which services each agency type sells. */
export const INDUSTRY_SOLUTIONS: IndustrySolution[] = [
  { id: "hajj_agency", name: "Hajj & Umrah Agency", tagline: "Manage pilgrims, groups, rooming and installments end to end.", services: ["Hajj", "Umrah", "Visa", "Transport"], icon: Building2 },
  { id: "ticketing", name: "Air Ticketing Office", tagline: "Fast ticketing with fare, PNR, reissue, refund and commission tracking.", services: ["Air Ticket", "Hotel", "Insurance"], icon: Plane },
  { id: "visa_center", name: "Visa Processing Center", tagline: "Document checklists, appointment tracking and status pipelines.", services: ["Visa", "Student Visa", "Insurance"], icon: StickyNote },
  { id: "tour_operator", name: "Tour Operator", tagline: "Build holiday packages, run group departures and sell online.", services: ["Holiday", "Group Tour", "Hotel", "Transport"], icon: Palmtree },
  { id: "corporate", name: "Corporate Travel", tagline: "Corporate accounts, travel policies and approval workflows.", services: ["Corporate Travel", "Air Ticket", "Hotel"], icon: Briefcase },
  { id: "manpower", name: "Manpower & Student", tagline: "Overseas employment and study-abroad consultancy pipelines.", services: ["Manpower", "Student Visa", "Visa"], icon: GraduationCap },
];
