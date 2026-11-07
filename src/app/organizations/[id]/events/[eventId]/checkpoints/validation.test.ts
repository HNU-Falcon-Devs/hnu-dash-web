import { describe, expect, it } from "vitest";
import { validateCheckpoint } from "./validation";

const window = { starts_at: "2026-12-05T01:00:00Z", ends_at: "2026-12-05T04:00:00Z" };

function fields({
  label = "Morning entry",
  direction = "IN",
  open = "2026-12-05T09:30",
  close = "2026-12-05T11:00",
  order = "0",
}: { label?: string; direction?: string; open?: string; close?: string; order?: string } = {}) {
  const form = new FormData();
  form.set("label", label);
  form.set("direction", direction);
  form.set("opens_at", open);
  form.set("closes_at", close);
  form.set("sort_order", order);
  return form;
}

describe("checkpoint validation", () => {
  it("normalizes label and translates valid Philippine times to explicit +08:00", () => {
    expect(validateCheckpoint(fields({ label: "  Entry  ", direction: "IN", order: "-2" }), window)).toEqual({
      input: {
        label: "Entry", direction: "IN", opens_at: "2026-12-05T09:30:00+08:00",
        closes_at: "2026-12-05T11:00:00+08:00", sort_order: -2,
      },
    });
  });

  it("allows a standalone OUT checkpoint and times on event boundaries", () => {
    expect(validateCheckpoint(fields({
      direction: "OUT", open: "2026-12-05T09:00", close: "2026-12-05T12:00",
    }), window).input?.direction).toBe("OUT");
  });

  it("rejects invalid labels, directions and out-of-range integers", () => {
    for (const form of [
      fields({ label: "x" }),
      fields({ label: "x".repeat(81) }),
      fields({ direction: "TIME_OUT" }),
      fields({ order: "1.5" }),
      fields({ order: "2147483648" }),
      fields({ order: "-2147483649" }),
      fields({ order: "" }),
    ]) expect(validateCheckpoint(form, window).message).toBeDefined();
  });

  it("rejects invalid calendar dates and ambiguous timezone values", () => {
    for (const open of ["2026-02-30T09:00", "2026-12-05T24:00", "2026-12-05T09:30Z", ""]) {
      expect(validateCheckpoint(fields({ open }), window).message).toMatch(/valid opening and closing/);
    }
  });

  it("rejects zero, reversed, and out-of-event windows", () => {
    for (const form of [
      fields({ open: "2026-12-05T09:30", close: "2026-12-05T09:30" }),
      fields({ open: "2026-12-05T11:30", close: "2026-12-05T10:00" }),
      fields({ open: "2026-12-05T08:59", close: "2026-12-05T10:00" }),
      fields({ open: "2026-12-05T09:00", close: "2026-12-05T12:01" }),
    ]) expect(validateCheckpoint(form, window).message).toBeDefined();
  });

  it("fails safely for a malformed Backend event schedule", () => {
    expect(validateCheckpoint(fields(), { starts_at: "bad", ends_at: window.ends_at }).message).toContain("parent event schedule");
  });
});
