import { describe, it, expect } from "vitest";
import { buildServiceDetailsFromForm, groupDepartures } from "@/lib/bookingServiceDetails";
import { emptyForm } from "@/components/bookings/types";

describe("bookingServiceDetails", () => {
  it("builds visa serviceDetails from form", () => {
    const details = buildServiceDetailsFromForm({
      ...emptyForm,
      type: "visa",
      visaCountry: "UAE",
      passportNumber: "AB123",
    });
    expect(details.visaCountry).toBe("UAE");
    expect(details.passportNumber).toBe("AB123");
    expect(details.workflowStatus).toBe("not_started");
  });

  it("groups tour departures by date and destination", () => {
    const groups = groupDepartures([
      { id: "1", type: "tour", destination: "Dubai", travelDateFrom: "2026-07-01", travelerCount: 2 },
      { id: "2", type: "tour", destination: "Dubai", travelDateFrom: "2026-07-01", travelerCount: 3 },
      { id: "3", type: "visa", destination: "UAE", travelDateFrom: "2026-07-01", travelerCount: 1 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].bookingCount).toBe(2);
    expect(groups[0].travelerCount).toBe(5);
  });
});
