import { describe, expect, it } from "vitest";
import { addHours, normalizeWindows, overlaps, parseAccounting, parseClaim, parseCoverage, parsePage, parsePreparation,
  parseResult, parseSummary, utc, withinBounds } from "./contract";

import { EVENT, ORG, ACTOR, IN, OUT, PREP, context, openSummary, closedAt, cutoff, syncing, ready, prep, exception } from "./test-fixtures";

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
