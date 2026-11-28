// Policy 2 fixture-only transport contract. Never select this from offline_enabled.
import { isUuid } from "@/app/organizations/[id]/events/validation";

export const PAGE_SIZE = 200;
export const LOSS = ["missing", "lost", "revoked", "undrained"] as const;
export const BASIS = ["synthetic_organizer_observation", "synthetic_event_record"] as const;
export type Row = Record<string, unknown>;
export function obj(v: unknown): Row | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : null;
}
export function count(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
}
export function text(v: unknown): v is string { return typeof v === "string" && v.length > 0; }
export function oneOf(v: unknown, options: readonly string[]): v is string {
  return typeof v === "string" && options.includes(v);
}
export function reason(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // PostgreSQL btrim removes spaces, not arbitrary whitespace.
  const s = v.replace(/^ +| +$/g, "");
  return /\S/u.test(s) && [...s].length <= 500 ? s : null;
}
export function bool(v: unknown): v is boolean { return typeof v === "boolean"; }
export function student(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9-]{1,64}$/.test(v);
}
export function uuid(v: unknown): v is string { return isUuid(v); }

// JS Date alone drops microseconds. Normalize to a fixed-width UTC string,
// preserving all six decimal digits for comparisons and exact retry payloads.
export function utc(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, se, frac = "", zone] = m;
  const check = new Date(0);
  check.setUTCFullYear(+y, +mo - 1, +d);
  if (+y === 0 || check.getUTCFullYear() !== +y || check.getUTCMonth() !== +mo - 1 ||
      check.getUTCDate() !== +d || +h > 23 || +mi > 59 || +se > 59 ||
      (zone !== "Z" && (+zone.slice(1, 3) > 23 || +zone.slice(4) > 59))) return null;
  const fraction = frac.padEnd(6, "0");
  const ms = Date.parse(v.slice(0, 19) + "." + fraction.slice(0, 3) + zone);
  if (!Number.isFinite(ms)) return null;
  const iso = new Date(ms).toISOString();
  if (!/^\d{4}-/.test(iso) || iso.startsWith("0000")) return null;
  return iso.slice(0, -1) + fraction.slice(3) + "Z";
}
export function instant(v: unknown): v is string { return utc(v) !== null; }
export function sameTime(a: unknown, b: unknown): boolean {
  return a === null || b === null ? a === b : utc(a) !== null && utc(a) === utc(b);
}
export function addHours(v: string, hours: number): string | null {
  const t = utc(v);
  if (!t) return null;
  const d = new Date(Date.parse(t) + hours * 3600000);
  if (!Number.isFinite(d.getTime())) return null;
  return utc(d.toISOString().slice(0, -1) + t.slice(23, 26) + "Z");
}
const optionalTime = (v: unknown) => v === null || instant(v);
const optionalUuid = (v: unknown) => v === null || uuid(v);
const audit = (at: unknown, by: unknown) => instant(at) && uuid(by);
const timeOrder = (a: string, b: string) => utc(a)!.localeCompare(utc(b)!);

export type Window = { checkpoint_id: string; opens_at: string; closes_at: string };
export type PlannedWindow = Window & { label: string; direction: "IN" | "OUT"; sort_order: number };
export type FixtureContext = {
  policy_version: 2; event_id: string; organization_id: string; actor_id: string;
  role: "head" | "admin" | "head_admin"; title: string; starts_at: string; ends_at: string;
  checkpoints: readonly PlannedWindow[];
  // Only a trusted fixture/validated receipt may supply closure, never current deadline minus 24h.
  closed_at: string | null;
};
export function validContext(c: FixtureContext): boolean {
  return c.policy_version === 2 && uuid(c.event_id) && uuid(c.organization_id) &&
    uuid(c.actor_id) && oneOf(c.role, ["head","admin","head_admin"]) && text(c.title) &&
    instant(c.starts_at) && instant(c.ends_at) && timeOrder(c.starts_at,c.ends_at)<0 &&
    optionalTime(c.closed_at) && Array.isArray(c.checkpoints) && c.checkpoints.length>0 &&
    new Set(c.checkpoints.map(w => w.checkpoint_id)).size===c.checkpoints.length &&
    c.checkpoints.every(w=>uuid(w.checkpoint_id)&&text(w.label)&&oneOf(w.direction,["IN","OUT"])&&
      count(w.sort_order)&&instant(w.opens_at)&&instant(w.closes_at)&&timeOrder(w.opens_at,w.closes_at)<0&&
      timeOrder(w.opens_at,c.starts_at)>=0&&timeOrder(w.closes_at,c.ends_at)<=0);
}
export function normalizeWindows(c: FixtureContext, proposed: readonly Window[]): Window[] | null {
  if (!validContext(c) || proposed.length !== c.checkpoints.length ||
    new Set(proposed.map(w=>w.checkpoint_id)).size!==proposed.length) return null;
  const result: Window[] = [];
  for (const planned of c.checkpoints) {
    const w = proposed.find(w=>w.checkpoint_id===planned.checkpoint_id);
    if (!w) return null;
    const start=utc(w.opens_at), end=utc(w.closes_at);
    if (!start||!end||start>=end||start>utc(planned.opens_at)!||end<utc(planned.closes_at)!) return null;
    result.push({checkpoint_id: planned.checkpoint_id, opens_at:start, closes_at:end});
  }
  return result.sort((a,b)=>a.checkpoint_id.localeCompare(b.checkpoint_id));
}
export function overlaps(windows: readonly Window[]): boolean {
  return windows.some((a,i)=>windows.slice(i+1).some(b=>utc(a.opens_at)!<utc(b.closes_at)!&&utc(b.opens_at)!<utc(a.closes_at)!));
}
export function changedWindows(c: FixtureContext, windows: readonly Window[]): boolean {
  return c.checkpoints.some(p=>!windows.some(w=>w.checkpoint_id===p.checkpoint_id&&
    sameTime(w.opens_at,p.opens_at)&&sameTime(w.closes_at,p.closes_at)));
}

export type Summary = {
  policy_version: 2; event_id: string; event_state: "DRAFT"|"OPEN"|"SYNCING"|"FINALIZED";
  sync_deadline: string|null; sealed: boolean; known_preparations: number; accounted_preparations: number;
  completed_preparations: number; loss_accounted_preparations: number; unused_assignments: number;
  submitted_claims: number; eligible_claims: number; rejected_claims: number; pending_exceptions: number;
  provisional_winners: number; evidence_ready: boolean; reconciliation_confirmed: boolean;
  can_finalize: boolean; finalized_at: string|null; finalized_by: string|null; finalized_records: number|null;
};
export function parseSummary(v: unknown, eventId: string): Summary | null {
  const r=obj(v);
  if (!r||r.policy_version!==2||r.event_id!==eventId||
    !oneOf(r.event_state,["DRAFT","OPEN","SYNCING","FINALIZED"])||
    !["sealed","evidence_ready","reconciliation_confirmed","can_finalize"].every(k=>bool(r[k]))||
    !["known_preparations","accounted_preparations","completed_preparations","loss_accounted_preparations",
      "unused_assignments","submitted_claims","eligible_claims","rejected_claims","pending_exceptions","provisional_winners"].every(k=>count(r[k]))) return null;
  const s=r as Summary;
  const closed=s.event_state==="SYNCING"||s.event_state==="FINALIZED";
  if ((closed?!instant(s.sync_deadline):s.sync_deadline!==null)||
    s.accounted_preparations>s.known_preparations||
    s.completed_preparations+s.loss_accounted_preparations!==s.accounted_preparations||
    s.eligible_claims+s.rejected_claims+s.pending_exceptions!==s.submitted_claims||
    s.provisional_winners>s.eligible_claims||
    s.evidence_ready!==(s.sealed&&s.accounted_preparations===s.known_preparations&&s.pending_exceptions===0)||
    (s.reconciliation_confirmed&&!s.evidence_ready)||
    s.can_finalize!==(s.event_state==="SYNCING"&&s.evidence_ready&&s.reconciliation_confirmed)||
    (!closed&&(s.sealed||s.accounted_preparations!==0||s.submitted_claims!==0))||
    (s.event_state==="FINALIZED"?
      !s.reconciliation_confirmed||!audit(s.finalized_at,s.finalized_by)||!count(s.finalized_records)||s.finalized_records===0:
      s.finalized_at!==null||s.finalized_by!==null||s.finalized_records!==null)) return null;
  return s;
}
export type Accounting = { preparation_id:string; disposition:string; uploaded_count:number; declared_count:number|null;
  reason:string|null; accounted_at:string; accounted_by:string };
export function parseAccounting(v: unknown): Accounting|null {
  const r=obj(v);
  if (!r||!uuid(r.preparation_id)||!count(r.uploaded_count)||!audit(r.accounted_at,r.accounted_by)||
    !(r.disposition==="completed"?r.declared_count===r.uploaded_count&&r.reason===null:
      oneOf(r.disposition,LOSS)&&r.declared_count===null&&reason(r.reason)!==null)) return null;
  return r as Accounting;
}
export type Preparation = { assignment_id:string; staff_user_id:string; assigned_at:string; revoked_at:string|null;
  preparation_id:string|null; issued_at:string|null; uploaded_count:number|null; accounting:Accounting|null };
export function parsePreparation(v:unknown): Preparation|null {
  const r=obj(v);
  if (!r||!uuid(r.assignment_id)||!uuid(r.staff_user_id)||!instant(r.assigned_at)||!optionalTime(r.revoked_at)) return null;
  if (r.preparation_id===null) {
    if (r.issued_at!==null||r.uploaded_count!==null||r.accounting!==null) return null;
  } else {
    if (!uuid(r.preparation_id)||!instant(r.issued_at)||!count(r.uploaded_count)||
      timeOrder(r.issued_at,r.assigned_at)<0) return null;
    if (r.accounting!==null) {
      const a=parseAccounting(r.accounting);
      if (!a||a.preparation_id!==r.preparation_id||a.uploaded_count!==r.uploaded_count) return null;
    }
  }
  return r as Preparation;
}
export type Claim = { capture_id:string; preparation_id:string; event_id:string; checkpoint_id:string; student_id:string;
  received_at:string; hard_start:string; hard_end:string; plausible_start:string|null; plausible_end:string|null;
  initial_disposition:string; timing_basis:string; validated_capture_at:string|null; disposition:string;
  normalized_at:string|null; decision:string|null; review_reason:string|null; basis_category:string|null;
  basis_reference:string|null; reviewed_at:string|null; reviewed_by:string|null;
  provisional_winner:boolean; final_receipt_id:string|null };
export function basisReference(v:unknown):v is string { return typeof v==="string"&&/^synthetic:[A-Za-z0-9_-]{1,128}$/.test(v); }
export function withinBounds(c: Pick<Claim,"hard_start"|"hard_end"|"received_at"|"plausible_start"|"plausible_end">, v:unknown):boolean {
  const t=utc(v);
  return t!==null&&t>=utc(c.hard_start)!&&t<utc(c.hard_end)!&&t<=utc(c.received_at)!&&
    (c.plausible_start===null||(t>=utc(c.plausible_start)!&&t<=utc(c.plausible_end)!));
}
function validClock(v:unknown):boolean {
  const r=obj(v);
  if(!r||Object.keys(r).length!==10) return false;
  return ["anchor_request_elapsed_ms","anchor_response_elapsed_ms","qr_elapsed_ms","confirmation_elapsed_ms"]
    .every(k=>r[k]===null||typeof r[k]==="number"&&Number.isSafeInteger(r[k]))&&
    ["qr_wall_at","confirmation_wall_at"].every(k=>optionalTime(r[k]))&&
    ["anchor_boot_marker","capture_boot_marker"].every(k=>r[k]===null||typeof r[k]==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(r[k]))&&
    oneOf(r.anchor_provenance,["original","replayed","missing","unknown"])&&
    oneOf(r.anomaly,["none","missing","reboot","clock_jump","inconsistent","other"]);
}
export function parseClaim(v:unknown,c:FixtureContext):Claim|null {
  const r=obj(v);
  if (!r||r.event_id!==c.event_id||!uuid(r.capture_id)||!uuid(r.preparation_id)||
    !c.checkpoints.some(w=>w.checkpoint_id===r.checkpoint_id)||!student(r.student_id)||
    !instant(r.received_at)||!instant(r.hard_start)||!instant(r.hard_end)||
    !optionalTime(r.plausible_start)||!optionalTime(r.plausible_end)||
    ((r.plausible_start===null)!==(r.plausible_end===null))||
    !oneOf(r.initial_disposition,["eligible","rejected","exception"])||!oneOf(r.timing_basis,["uncertain_provenance","empty_hard_interval","invalid_elapsed_sequence","timestamp_overflow",
      "wall_elapsed_inconsistent","reliable_outside_bounds","partial_boundary_overlap","ordinary_interval","outside_frozen_roster"])||
    !optionalTime(r.validated_capture_at)||!optionalTime(r.normalized_at)||!bool(r.provisional_winner)||
    !optionalUuid(r.final_receipt_id)||!validClock(r.clock_payload)) return null;
  const a=r as Claim;
  if (a.initial_disposition==="eligible"&&a.timing_basis!=="ordinary_interval") return null;
  if (a.plausible_start!==null&&timeOrder(a.plausible_start,a.plausible_end!)>0) return null;
  if ((a.initial_disposition==="eligible")!==(a.validated_capture_at!==null)||
    (a.validated_capture_at!==null&&!withinBounds(a,a.validated_capture_at))) return null;
  if (a.decision===null) {
    if (a.review_reason!==null||a.basis_category!==null||a.basis_reference!==null||
      a.reviewed_at!==null||a.reviewed_by!==null||a.disposition!==a.initial_disposition||
      !sameTime(a.normalized_at,a.validated_capture_at)) return null;
  } else if (a.initial_disposition!=="exception"||!audit(a.reviewed_at,a.reviewed_by)||!reason(a.review_reason)||
    !(a.decision==="approve"?a.disposition==="eligible"&&oneOf(a.basis_category,BASIS)&&
      basisReference(a.basis_reference)&&withinBounds(a,a.normalized_at):
      a.decision==="reject"&&a.disposition==="rejected"&&a.basis_category===null&&a.basis_reference===null&&a.normalized_at===null)) return null;
  if (a.provisional_winner&&a.disposition!=="eligible"||a.final_receipt_id!==null&&!a.provisional_winner) return null;
  // Project only the consumed fields; do not expose raw clock payload in UI.
  const {capture_id,preparation_id,event_id,checkpoint_id,student_id,received_at,hard_start,hard_end,plausible_start,plausible_end,
    initial_disposition,timing_basis,validated_capture_at,disposition,normalized_at,decision,review_reason,basis_category,basis_reference,
    reviewed_at,reviewed_by,provisional_winner,final_receipt_id}=a;
  return {capture_id,preparation_id,event_id,checkpoint_id,student_id,received_at,hard_start,hard_end,plausible_start,plausible_end,
    initial_disposition,timing_basis,validated_capture_at,disposition,normalized_at,decision,review_reason,basis_category,basis_reference,
    reviewed_at,reviewed_by,provisional_winner,final_receipt_id};
}
export type Coverage = {student_id:string;checkpoint_id:string;checkpoint_label:string;checkpoint_direction:string;
  checkpoint_sort_order:number;provisional_capture_id:string|null;validated_capture_at:string|null;received_at:string|null;
  final_receipt_id:string|null;finalized:boolean};
export function parseCoverage(v:unknown,c:FixtureContext,s:Summary):Coverage|null {
  const r=obj(v),w=c.checkpoints.find(w=>w.checkpoint_id===r?.checkpoint_id);
  if (!r||!w||!student(r.student_id)||r.checkpoint_label!==w.label||r.checkpoint_direction!==w.direction||
    r.checkpoint_sort_order!==w.sort_order||!optionalUuid(r.provisional_capture_id)||!optionalUuid(r.final_receipt_id)||
    !optionalTime(r.validated_capture_at)||!optionalTime(r.received_at)||r.finalized!==(s.event_state==="FINALIZED")) return null;
  const winner=r.provisional_capture_id!==null;
  if (winner!==(r.validated_capture_at!==null)||winner!==(r.received_at!==null)||
    (r.final_receipt_id!==null)!==(winner&&r.finalized===true)) return null;
  return r as Coverage;
}
export type FinalResult = {event_id:string;student_id:string;status:string;required_checkpoint_count:number;accepted_checkpoint_count:number};
export function parseResult(v:unknown,c:FixtureContext,s:Summary):FinalResult|null {
  const r=obj(v);
  if (!r||s.event_state!=="FINALIZED"||r.event_id!==c.event_id||!student(r.student_id)||
    !oneOf(r.status,["PRESENT","INCOMPLETE","ABSENT"])||r.required_checkpoint_count!==c.checkpoints.length||
    !count(r.accepted_checkpoint_count)||r.accepted_checkpoint_count>c.checkpoints.length) return null;
  // Validate Backend's verdict; never replace it with a locally computed result.
  if ((r.status==="PRESENT")!==(r.accepted_checkpoint_count===r.required_checkpoint_count)||
    (r.status==="ABSENT")!==(r.accepted_checkpoint_count===0)) return null;
  return r as FinalResult;
}
export function parsePage<T>(v:unknown,parse:(v:unknown)=>T|null,key:(r:T)=>string,compare:(a:T,b:T)=>number):T[]|null {
  if (!Array.isArray(v)||v.length>PAGE_SIZE) return null;
  const result:T[]=[],seen=new Set<string>();
  for (const item of v) {
    const row=parse(item);
    if (!row||seen.has(key(row))||(result.length>0&&compare(result[result.length-1],row)>0)) return null;
    result.push(row);seen.add(key(row));
  }
  return result;
}
export function compareText(a:string,b:string):number {return a<b?-1:a>b?1:0;}
export function compareTime(a:string,b:string):number {return compareText(utc(a)!,utc(b)!);}
