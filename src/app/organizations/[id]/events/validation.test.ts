import { describe, expect, it } from "vitest";
import { asManilaInput, formatManila, manilaLocalToOffset, validateDraftEvent } from "./validation";

function fields(title = "General Assembly", start = "2026-12-05T09:30", end = "2026-12-05T11:00", levels = ["1", "2", "3", "4"]) {
  const f = new FormData();
  f.set("title", title);
  f.set("starts_at", start);
  f.set("ends_at", end);
  for (const level of levels) f.append("year_levels", level);
  return f;
}

describe("draft event validation and Philippine time conversion", () => {
  it("adds an explicit +08:00 offset and round-trips a timestamp", () => {
    expect(manilaLocalToOffset("2026-12-05T09:30")).toBe("2026-12-05T09:30:00+08:00");
    expect(asManilaInput("2026-12-05T01:30:00Z")).toBe("2026-12-05T09:30");
    expect(formatManila("2026-12-05T01:30:00Z")).toMatch(/9:30/);
  });

  it("normalizes trimmed titles and distinct target levels", () => {
    expect(validateDraftEvent(fields("  General Assembly  ", undefined, undefined, ["6", "2"]))).toEqual({
      input: {
        title: "General Assembly",
        startsAt: "2026-12-05T09:30:00+08:00",
        endsAt: "2026-12-05T11:00:00+08:00",
        yearLevels: [2, 6],
      },
    });
  });

  it("rejects malformed dates, nonexistent calendar days and ambiguous offsets", () => {
    for (const start of ["", "2026-02-30T09:30", "2026-12-05T25:30", "2026-12-05T09:30Z", "2026-12-05"]) {
      expect(validateDraftEvent(fields("Valid event", start)).message).toMatch(/valid start and end/);
    }
  });

  it("rejects equal or reversed schedules", () => {
    expect(validateDraftEvent(fields("Valid event", "2026-12-05T11:00", "2026-12-05T11:00")).message).toMatch(/after the start/);
    expect(validateDraftEvent(fields("Valid event", "2026-12-05T12:00", "2026-12-05T11:00")).message).toMatch(/after the start/);
  });

  it("rejects out-of-range, empty and duplicate year selections", () => {
    for (const levels of [[], ["0"], ["7"], ["1", "1"], ["2", "x"]]) {
      expect(validateDraftEvent(fields("Valid event", undefined, undefined, levels)).message).toMatch(/target year levels/);
    }
  });

  it("rejects too-short and too-long titles", () => {
    expect(validateDraftEvent(fields("X")).message).toMatch(/title/);
    expect(validateDraftEvent(fields("X".repeat(161))).message).toMatch(/title/);
  });
});
