import { describe, expect, it } from "vitest";
import { getDefaultEventForm } from "@/lib/storage";
import { MINUTE_OPTIONS, getMonthGrid, moveAnchor } from "@/lib/date";

describe("calendar helpers", () => {
  it("limits minute options to quarter hours", () => {
    expect(MINUTE_OPTIONS).toEqual(["00", "15", "30", "45"]);
  });

  it("builds a 5 or 6 week month grid", () => {
    const grid = getMonthGrid("2026-04-09");
    expect([35, 42]).toContain(grid.length);
  });

  it("moves the week anchor by 7 days", () => {
    expect(moveAnchor("2026-04-09", "week", 1)).toBe("2026-04-16");
  });

  it("initializes end date to start date by default", () => {
    const defaults = getDefaultEventForm("2026-04-09");
    expect(defaults.startDate).toBe("2026-04-09");
    expect(defaults.endDate).toBe("2026-04-09");
  });
});
