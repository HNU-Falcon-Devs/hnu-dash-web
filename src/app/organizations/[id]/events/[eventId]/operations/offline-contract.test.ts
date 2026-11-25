import { describe, expect, it } from "vitest";
import { count, pageNumber, parseClaim, parsePageRows, parsePreparation, parseSummary, reason, timestamp, validPolicy,
  validAcknowledgement } from "./offline-contract";

const E = "11111111-1111-4111-8111-111111111111";
const U = "22222222-2222-4222-8222-222222222222";
const R = "33333333-3333-4333-8333-333333333333";
const cutoff = "2026-12-06T03:00:00+00:00";
const seal = "2026-12-06T03:01:00Z";
const policy = { id: E, state: "SYNCING", offline_enabled: true, offline_upload_cutoff: cutoff };
const summary = { event_id: E, event_state: "SYNCING", upload_cutoff: cutoff, sealed_at: seal, sealed_by: U,
  confirmed_at: null, confirmed_by: null, preparation_count: 1, completed_count: 0, loss_count: 0,
  unaccounted_count: 1, claim_count: 1, reviewed_count: 0, unreviewed_count: 1,
  can_seal: false, can_confirm: false, can_finalize: false };
const prep = { preparation_id: E, assignment_id: U, staff_user_id: U, issued_at: "2026-12-05T01:00:00Z",
  expires_at: "2026-12-05T03:00:00Z", revoked_at: null, uploaded_count: 1, disposition: null,
  declared_count: null, reason: null, accounted_at: null, accounted_by: null };
const claim = { capture_id: R, preparation_id: E, checkpoint_id: U, student_id: "0000001", staff_user_id: U,
  claimed_at: "2026-12-05T01:10:00+08:00", received_at: "2026-12-05T02:00:00Z", review_eligible: false,
  decision: null, reason: null, receipt_id: null, receipt_outcome: null, reviewed_at: null, reviewed_by: null };

describe("M4.2 response and input boundary", () => {
  it.each(["2026-02-30T01:00:00Z", "2026-11-01T00:00:00", "2026-01-01T24:00:00Z", "bad", null])("rejects invalid or offset-free timestamp %s", value => {
    expect(timestamp(value)).toBe(false);
  });
  it("accepts ISO offsets, fractional seconds and actual calendar dates", () => {
    expect(timestamp("2028-02-29T03:00:00.123456+08:00")).toBe(true);
    expect(timestamp("2026-12-06T03:00:00+00:00")).toBe(true);
  });
  it.each([-1, 0.5, "1", Number.MAX_SAFE_INTEGER + 1, null])("rejects unsafe count %s", value => expect(count(value)).toBe(false));
  it("checks exact reason without trimming payload", () => {
    expect(reason(" x ")).toBe(true);
    expect(reason(" \n\t")).toBe(false);
    expect(reason("x".repeat(500))).toBe(true);
    expect(reason("x".repeat(501))).toBe(false);
  });
  it("never infers online-only from missing or malformed policy", () => {
    expect(validPolicy(policy)).toBe(true);
    expect(validPolicy({ ...policy, offline_enabled: false, offline_upload_cutoff: null })).toBe(true);
    expect(validPolicy({ ...policy, offline_enabled: undefined })).toBe(false);
    expect(validPolicy({ ...policy, offline_upload_cutoff: null })).toBe(false);
    expect(validPolicy({ ...policy, offline_enabled: false })).toBe(false);
  });
  it.each([{ event_id: U }, { event_state: "OPEN" }, { upload_cutoff: "2026-12-07T03:00:00Z" },
    { sealed_by: "bad" }, { sealed_at: "2026-12-05T03:00:00Z" }, { preparation_count: -1 },
    { unaccounted_count: 0 }, { can_finalize: true }, { can_confirm: true }, { can_seal: true }, { reviewed_count: "0" }])(
    "rejects malformed or inconsistent summary %#", override => expect(parseSummary({ ...summary, ...override }, policy)).toBeNull());
  it("allows exact zero-session summary, but does not infer readiness", () => {
    const zero = { ...summary, preparation_count: 0, unaccounted_count: 0, claim_count: 0, unreviewed_count: 0 };
    expect(parseSummary(zero, policy)?.can_confirm).toBe(false);
    expect(parseSummary({ ...zero, can_confirm: true }, policy)?.can_confirm).toBe(true);
  });
  it("accepts bounded known preparations and loss with actual count but no declaration", () => {
    expect(parsePreparation(prep)?.uploaded_count).toBe(1);
    const lost = { ...prep, disposition: "lost", reason: "Lost", accounted_at: seal, accounted_by: U };
    expect(parsePreparation(lost)?.declared_count).toBeNull();
    expect(parsePreparation({ ...lost, declared_count: 1 })).toBeNull();
    expect(parsePreparation({ ...lost, accounted_by: null })).toBeNull();
    expect(parsePreparation({ ...lost, disposition: "completed", reason: null, declared_count: 0 })).toBeNull();
  });
  it("validates eligibility, original IDs, and canonical receipt provenance", () => {
    expect(parseClaim(claim)?.student_id).toBe("0000001");
    const rejected = { ...claim, decision: "reject", reason: "No evidence", reviewed_at: seal, reviewed_by: U };
    expect(parseClaim(rejected)?.receipt_id).toBeNull();
    expect(parseClaim({ ...rejected, receipt_id: U })).toBeNull();
    const approved = { ...rejected, decision: "approve", receipt_id: U, receipt_outcome: "duplicate" };
    expect(parseClaim(approved)).toBeNull();
    expect(parseClaim({ ...approved, review_eligible: true })?.receipt_outcome).toBe("duplicate");
    expect(parseClaim({ ...claim, student_id: 123 })).toBeNull();
  });
  it("bounds independent page offsets and rejects oversized, duplicate, unordered and incomplete pages", () => {
    expect(pageNumber("99999999999999999999", 500)).toBe(1);
    expect(pageNumber("100", 500)).toBe(3);
    expect(pageNumber("2", 0)).toBe(1);
    expect((pageNumber("9999999999", Number.MAX_SAFE_INTEGER) - 1) * 200).toBeLessThanOrEqual(2147483647);
    const parse = (value: unknown, expected: number) => parsePageRows(value, parsePreparation, row => row.preparation_id, row => row.issued_at, expected);
    expect(parse([prep], 1)).toHaveLength(1);
    expect(parse([prep, prep], 2)).toBeNull();
    expect(parse([prep], 2)).toBeNull();
    expect(parse([prep, { ...prep, preparation_id: U, issued_at: "2026-12-04T01:00:00Z" }], 2)).toBeNull();
  });
  it("validates exact acknowledgement target, decision, reason, audit and replay shape", () => {
    const ack = { capture_id: R, decision: "reject", reason: " exact ", receipt_id: null, receipt_outcome: null,
      reviewed_at: seal, reviewed_by: U, replayed: true };
    expect(validAcknowledgement("review", ack, E, R, "reject", " exact ")).toBe(true);
    expect(validAcknowledgement("review", ack, E, R, "reject", "exact")).toBe(false);
    expect(validAcknowledgement("review", { ...ack, reviewed_by: null }, E, R, "reject", " exact ")).toBe(false);
    expect(validAcknowledgement("enable", [true], E, null, null, null)).toBe(false);
  });
});
