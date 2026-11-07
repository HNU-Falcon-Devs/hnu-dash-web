import { describe, expect, it } from "vitest";
import { isMembershipRole, isUuid } from "./validation";

describe("membership input guards", () => {
  it("accepts canonical UUIDs regardless of hex casing", () => {
    expect(isUuid("12345678-abcd-4e0a-aabc-123456789abc")).toBe(true);
    expect(isUuid("12345678-ABCD-4E0A-AABC-123456789ABC")).toBe(true);
  });
  it("rejects partial, malformed, non-string and empty IDs", () => {
    for (const value of ["", "not-a-uuid", "12345678-abcdef", "12345678-abcd-4e0a-aabc-123456789abc/other", null, 123]) {
      expect(isUuid(value)).toBe(false);
    }
  });
  it("accepts only approved backend roles", () => {
    expect(isMembershipRole("leader")).toBe(true);
    expect(isMembershipRole("staff")).toBe(true);
    expect(isMembershipRole("admin")).toBe(false);
    expect(isMembershipRole("owner")).toBe(false);
    expect(isMembershipRole(null)).toBe(false);
  });
});
