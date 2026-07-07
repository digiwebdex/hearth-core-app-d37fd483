// Booking lifecycle transition map — the FRONTEND mirror of the backend Central
// Status Engine (`backend/src/lib/statusEngine.js` → WORKFLOW_STATUS_REGISTRY.bookingStatus).
// Paired source of truth (see docs/v2-master/10 §2): the backend ENFORCES these
// transitions on write; the UI mirrors them so it never offers a status the API
// will reject with 400 INVALID_STATUS_TRANSITION. Keep the two in sync.

export type BookingLifecycleStatus =
  | "inquiry" | "pending" | "confirmed" | "ticketed" | "traveling" | "completed" | "cancelled";

/** Allowed next statuses from each current status (excludes the no-op self). */
export const BOOKING_STATUS_TRANSITIONS: Record<BookingLifecycleStatus, BookingLifecycleStatus[]> = {
  inquiry: ["pending", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["ticketed", "cancelled"],
  ticketed: ["traveling", "cancelled"],
  traveling: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * The statuses a booking may be set to from `current`, for populating the edit UI.
 * Always includes `current` itself (a no-op is valid). If `current` is unknown/legacy,
 * every status is offered (mirrors the backend's "never trap a legacy record" rule).
 */
export function allowedBookingStatuses(current?: string | null): BookingLifecycleStatus[] {
  const all = Object.keys(BOOKING_STATUS_TRANSITIONS) as BookingLifecycleStatus[];
  if (!current || !(current in BOOKING_STATUS_TRANSITIONS)) return all;
  const cur = current as BookingLifecycleStatus;
  return [cur, ...BOOKING_STATUS_TRANSITIONS[cur]];
}
