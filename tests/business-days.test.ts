import { describe, expect, it } from "vitest";
import { addBusinessDays, businessDaysLate, nextBusinessDays } from "@/lib/business-days";

describe("business day cadence", () => {
  it("adds three weekdays from Monday to Thursday", () => expect(addBusinessDays("2026-10-05", 3)).toBe("2026-10-08"));
  it("skips the weekend", () => expect(addBusinessDays("2026-10-08", 3)).toBe("2026-10-13"));
  it("counts overdue business days only", () => expect(businessDaysLate("2026-10-02", "2026-10-06")).toBe(2));
  it("forecasts business days", () => expect(nextBusinessDays("2026-10-02", 3)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]));
});
