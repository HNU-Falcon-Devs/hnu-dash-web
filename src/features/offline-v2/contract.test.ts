import { describe, expect, it } from "vitest";
import { addHours, normalizeWindows, overlaps, parseAccounting, parseClaim, parseCoverage, parsePage, parsePreparation,
  parseResult, parseSummary, utc, withinBounds, type FixtureContext } from "./contract";

export const EVENT="11111111-1111-4111-8111-111111111111";
export const ORG="22222222-2222-4222-8222-222222222222";
export const ACTOR="33333333-3333-4333-8333-333333333333";
export const IN="44444444-4444-4444-8444-444444444444";
export const OUT="55555555-5555-4555-8555-555555555555";
export const PREP="66666666-6666-4666-8666-666666666666";
export const CAPTURE="77777777-7777-4777-8777-777777777777";
export const ASSIGNMENT="88888888-8888-4888-8888-888888888888";
export const context:FixtureContext={
  policy_version:2,event_id:EVENT,organization_id:ORG,actor_id:ACTOR,role:"head",title:"Synthetic event",
  starts_at:"2027-01-01T00:00:00Z",ends_at:"2027-01-01T05:00:00Z",closed_at:null,
  checkpoints:[
    {checkpoint_id:IN,label:"Entry",direction:"IN",sort_order:1,opens_at:"2027-01-01T01:00:00.000001Z",closes_at:"2027-01-01T02:00:00Z"},
    {checkpoint_id:OUT,label:"Exit",direction:"OUT",sort_order:2,opens_at:"2027-01-01T03:00:00Z",closes_at:"2027-01-01T04:00:00Z"}
  ]
};
export const openSummary={
  policy_version:2,event_id:EVENT,event_state:"OPEN",sync_deadline:null,sealed:false,
  known_preparations:1,accounted_preparations:0,completed_preparations:0,loss_accounted_preparations:0,unused_assignments:0,
  submitted_claims:0,eligible_claims:0,rejected_claims:0,pending_exceptions:0,provisional_winners:0,
  evidence_ready:false,reconciliation_confirmed:false,can_finalize:false,finalized_at:null,finalized_by:null,finalized_records:null
};
export const closedAt="2027-01-01T05:00:00.123456Z";
export const cutoff="2027-01-02T05:00:00.123456Z";
export const syncing={...openSummary,event_state:"SYNCING",sync_deadline:cutoff};
export const ready={...syncing,sealed:true,accounted_preparations:1,completed_preparations:1,evidence_ready:true};
export const prep={assignment_id:ASSIGNMENT,staff_user_id:ACTOR,assigned_at:"2027-01-01T00:00:00Z",revoked_at:null,
  preparation_id:PREP,issued_at:"2027-01-01T00:01:00Z",uploaded_count:1,accounting:null};
export const exception={capture_id:CAPTURE,preparation_id:PREP,event_id:EVENT,checkpoint_id:IN,student_id:"000001",
  received_at:"2027-01-01T06:00:00Z",hard_start:"2027-01-01T01:00:00.000001Z",hard_end:"2027-01-01T02:00:00Z",
  plausible_start:"2027-01-01T01:00:00Z",plausible_end:"2027-01-01T01:00:01Z",
  initial_disposition:"exception",timing_basis:"partial_boundary_overlap",validated_capture_at:null,
  disposition:"exception",normalized_at:null,decision:null,review_reason:null,basis_category:null,basis_reference:null,
  reviewed_at:null,reviewed_by:null,provisional_winner:false,final_receipt_id:null,
  clock_payload:{anchor_request_elapsed_ms:null,anchor_response_elapsed_ms:null,qr_elapsed_ms:null,confirmation_elapsed_ms:null,
    qr_wall_at:null,confirmation_wall_at:null,anchor_boot_marker:null,capture_boot_marker:null,anchor_provenance:"missing",anomaly:"missing"}};

describe("policy 2 pinned contracts",()=>{
  it("normalizes explicit offsets without losing microseconds or accepting impossible dates",()=>{
    expect(utc("2027-01-01T09:00:00.000001+08:00")).toBe("2027-01-01T01:00:00.000001Z");
    expect(addHours(closedAt,168)).toBe("2027-01-08T05:00:00.123456Z");
    for(const bad of ["2027-02-29T00:00:00Z","2027-01-01T00:00:00","2027-01-01T24:00:00Z","2027-01-01T00:00:00.1234567Z"])
      expect(utc(bad)).toBeNull();
  });
  it("allows independent extensions, rejects missing/duplicate windows and one-microsecond shortening",()=>{
    const proposed=context.checkpoints.map(w=>({...w}));
    proposed[0].opens_at="2027-01-01T00:30:00+00:00";
    proposed[1].closes_at="2027-01-01T06:00:00Z";
    expect(normalizeWindows(context,proposed)).toEqual([
      {checkpoint_id:IN,opens_at:"2027-01-01T00:30:00.000000Z",closes_at:"2027-01-01T02:00:00.000000Z"},
      {checkpoint_id:OUT,opens_at:"2027-01-01T03:00:00.000000Z",closes_at:"2027-01-01T06:00:00.000000Z"}
    ]);
    expect(normalizeWindows(context,[proposed[0]])).toBeNull();
    expect(normalizeWindows(context,[proposed[0],proposed[0]])).toBeNull();
    proposed[0].opens_at="2027-01-01T01:00:00.000002Z";
    expect(normalizeWindows(context,proposed)).toBeNull();
  });
  it("treats touching windows as non-overlap and detects a microsecond overlap",()=>{
    const a={...context.checkpoints[0]},b={...context.checkpoints[1],opens_at:a.closes_at};
    expect(overlaps([a,b])).toBe(false);
    expect(overlaps([{...a,closes_at:"2027-01-01T02:00:00.000001Z"},b])).toBe(true);
  });
  it("rejects v1, bad state, contradictory counts and false readiness",()=>{
    expect(parseSummary(openSummary,EVENT)).not.toBeNull();
    expect(parseSummary({...openSummary,policy_version:1},EVENT)).toBeNull();
    expect(parseSummary({...syncing,can_finalize:true},EVENT)).toBeNull();
    expect(parseSummary({...ready,accounted_preparations:0},EVENT)).toBeNull();
    expect(parseSummary({...ready,reconciliation_confirmed:true,can_finalize:true},EVENT)).not.toBeNull();
  });
  it("keeps unused assignments distinct from immutable loss and completed counts",()=>{
    expect(parsePreparation({...prep,preparation_id:null,issued_at:null,uploaded_count:null})).not.toBeNull();
    expect(parsePreparation({...prep,preparation_id:null})).toBeNull();
    const a={preparation_id:PREP,disposition:"lost",uploaded_count:1,declared_count:null,reason:"Synthetic loss",
      accounted_at:cutoff,accounted_by:ACTOR};
    expect(parseAccounting(a)).not.toBeNull();
    expect(parseAccounting({...a,declared_count:1})).toBeNull();
  });
  it("checks review bounds and precision and rejects hard-denial override and malformed clock",()=>{
    const row=parseClaim(exception,context)!;
    expect(row).not.toBeNull();
    expect(withinBounds(row,"2027-01-01T01:00:00Z")).toBe(false);
    expect(withinBounds(row,"2027-01-01T01:00:00.000001Z")).toBe(true);
    expect(withinBounds(row,"2027-01-01T01:00:01.000001Z")).toBe(false);
    expect(parseClaim({...exception,clock_payload:{}},context)).toBeNull();
    expect(parseClaim({...exception,initial_disposition:"rejected",decision:"approve"},context)).toBeNull();
    expect(parseClaim({...exception,event_id:ORG},context)).toBeNull();
  });
  it("rejects oversized and duplicate pages, mixed finalization and premature results",()=>{
    expect(parsePage([prep,prep],parsePreparation,r=>r.assignment_id,()=>0)).toBeNull();
    expect(parsePage(Array(201).fill(prep),parsePreparation,r=>r.assignment_id,()=>0)).toBeNull();
    const s=parseSummary(syncing,EVENT)!;
    const coverage={student_id:"000001",checkpoint_id:IN,checkpoint_label:"Entry",checkpoint_direction:"IN",
      checkpoint_sort_order:1,provisional_capture_id:null,validated_capture_at:null,received_at:null,final_receipt_id:null,finalized:false};
    expect(parseCoverage(coverage,context,s)).not.toBeNull();
    expect(parseCoverage({...coverage,finalized:true},context,s)).toBeNull();
    expect(parseResult({event_id:EVENT,student_id:"000001",status:"ABSENT",required_checkpoint_count:2,accepted_checkpoint_count:0},context,s)).toBeNull();
  });
});
