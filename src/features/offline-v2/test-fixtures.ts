import type { FixtureContext } from "./contract";

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

