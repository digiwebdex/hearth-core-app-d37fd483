import { describe, it, expect } from "vitest";
import {
  BOOKING_PRESET_CONFIG,
  bookingMatchesPreset,
  bookingTypeToPreset,
  isBookingPreset,
} from "@/lib/bookingRoutePresets";

describe("bookingRoutePresets", () => {
  it("includes corporate preset", () => {
    expect(isBookingPreset("corporate")).toBe(true);
    expect(BOOKING_PRESET_CONFIG.corporate.typeFilter).toBe("corporate");
  });

  it("maps corporate booking type to corporate preset", () => {
    expect(bookingTypeToPreset("corporate")).toBe("corporate");
  });

  it("matches corporate bookings by type", () => {
    expect(
      bookingMatchesPreset({ type: "corporate", title: "Acme retreat" }, "corporate"),
    ).toBe(true);
    expect(
      bookingMatchesPreset({ type: "tour", title: "Acme retreat" }, "corporate"),
    ).toBe(false);
  });
});
