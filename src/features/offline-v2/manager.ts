import { addHours, BASIS, basisReference, bool, changedWindows, compareText, compareTime, count, instant,
  LOSS, normalizeWindows, obj, oneOf, overlaps, PAGE_SIZE, parseAccounting, parseClaim, parseCoverage,
  parsePage, parsePreparation, parseResult, parseSummary, reason, sameTime, utc, uuid, validContext, withinBounds,
  type Claim, type FixtureContext, type Preparation, type Summary, type Window, type Row } from "./contract";

export type Rpc = (name: string, args: Row) => Promise<{data: unknown; error: {code?: string}|null}>;
export type Transport = { verify: (context: FixtureContext) => Promise<boolean>; rpc: Rpc };
export type Operation =
  | { kind:"close"; windows: Window[]; overlap: boolean; earlyAcknowledged:boolean; why:string }
  | { kind:"extend"; deadline:string; why:string }
  | { kind:"seal"; acknowledge:boolean; why:string }
  | { kind:"loss"; preparation:Preparation; disposition:string; why:string }
  | { kind:"review"; claim:Claim; decision:string; why:string; category:string; reference:string; captureAt:string }
  | { kind:"confirm"; acknowledge:boolean; why:string }
  | { kind:"finalize" };
type Request = { name:string; args:Row; before:Summary; expectedUploaded?:number };
export type PageOffsets = { preparations:number; claims:number; coverage:number; results:number; exceptionsOnly:boolean };
export const firstPage:PageOffsets={preparations:0,claims:0,coverage:0,results:0,exceptionsOnly:false};
export type Snapshot = NonNullable<Awaited<ReturnType<typeof readSnapshot>>>;

// No runtime entry point. The test harness supplies a trusted immutable fixture
// context and scoped transport. Neither is derived from a user URL or flag.
export async function readSnapshot(c:FixtureContext,t:Transport,offsets:PageOffsets) {
  if (!validContext(c)||!Object.entries(offsets).every(([key,v])=>key==="exceptionsOnly"?bool(v):
    count(v)&&v<=2147483647&&v%PAGE_SIZE===0)||!await t.verify(c)) return null;
  const args={p_event_id:c.event_id};
  async function read(name:string,extra:Row={}) {
    const r=await t.rpc(name,{...args,...extra});
    if (r.error) throw new Error("Scoped successor read unavailable");
    return r.data;
  }
  const s=parseSummary(await read("get_event_offline_summary_v2"),c.event_id);
  if (!s) return null;
  const page=(offset:number)=>({p_limit:PAGE_SIZE,p_offset:offset});
  const [p,q,v,f]=await Promise.all([
    read("get_event_offline_preparations_v2",page(offsets.preparations)),
    read("get_event_offline_claims_v2",{...page(offsets.claims),p_exceptions_only:offsets.exceptionsOnly}),
    read("get_event_checkpoint_coverage_v2",page(offsets.coverage)),
    s.event_state==="FINALIZED"?read("get_event_finalized_results_v2",page(offsets.results)):Promise.resolve([])
  ]);
  const preparations=parsePage(p,parsePreparation,r=>r.assignment_id,(a,b)=>compareTime(a.assigned_at,b.assigned_at)||compareText(a.assignment_id,b.assignment_id));
  const claims=parsePage(q,r=>parseClaim(r,c),r=>r.capture_id,(a,b)=>compareTime(a.received_at,b.received_at)||compareText(a.capture_id,b.capture_id));
  const coverage=parsePage(v,r=>parseCoverage(r,c,s),r=>r.student_id+":"+r.checkpoint_id,
    (a,b)=>compareText(a.student_id,b.student_id)||a.checkpoint_sort_order-b.checkpoint_sort_order||compareText(a.checkpoint_id,b.checkpoint_id));
  const results=parsePage(f,r=>parseResult(r,c,s),r=>r.student_id,(a,b)=>compareText(a.student_id,b.student_id));
  if (!preparations||!claims||!coverage||!results||!await t.verify(c)||
    preparations.length!==Math.max(0,Math.min(PAGE_SIZE,s.known_preparations+s.unused_assignments-offsets.preparations))||
    (!offsets.exceptionsOnly&&claims.length!==Math.max(0,Math.min(PAGE_SIZE,s.submitted_claims-offsets.claims)))||
    claims.some(r=>offsets.exceptionsOnly&&r.initial_disposition!=="exception"||
      s.event_state!=="FINALIZED"&&r.final_receipt_id!==null||
      s.event_state==="FINALIZED"&&(r.disposition==="exception"||r.provisional_winner!==(r.final_receipt_id!==null)))||
    (s.event_state==="FINALIZED"&&results.length!==Math.max(0,Math.min(PAGE_SIZE,s.finalized_records!-offsets.results)))) return null;
  // Separate Backend calls are not an atomic snapshot. A changed summary
  // invalidates the view; even equal summaries cannot prove identical winners.
  const latest=parseSummary(await read("get_event_offline_summary_v2"),c.event_id);
  if (!latest||!await t.verify(c)||Object.keys(s).some(k=>(s as unknown as Row)[k]!==(latest as unknown as Row)[k])) return null;
  return {summary:latest,preparations,claims,coverage,results,offsets:{...offsets}};
}
const optionalReason=(why:string)=>why===""?null:reason(why);

function makeRequest(c:FixtureContext,s:Summary,operation:Operation,now:string,closedAt:string|null):Request|null {
  const base={p_event_id:c.event_id};
  const why="why" in operation?reason(operation.why):null;
  const request=(name:string,args:Row,expectedUploaded?:number):Request=>({name,args:{...base,...args},before:s,expectedUploaded});
  const needsAck=s.unused_assignments>0||s.known_preparations===0;
  if(operation.kind==="close"&&s.event_state==="OPEN") {
    const windows=normalizeWindows(c,operation.windows);
    if(!windows||overlaps(windows)&&!operation.overlap||
      (changedWindows(c,windows)||utc(now)!<utc(c.ends_at)!)&&!why||
      utc(now)!<utc(c.ends_at)!&&!operation.earlyAcknowledged||
      operation.why!==""&&!why) return null;
    return request("close_event_v2",{p_request_id:crypto.randomUUID(),p_windows:windows,
      p_overlap_acknowledged:operation.overlap,p_reason:why});
  }
  if(s.event_state!=="SYNCING") return null;
  if(operation.kind==="extend"&&!s.sealed&&c.role!=="admin"&&why) {
    const deadline=utc(operation.deadline),cap=closedAt?addHours(closedAt,168):null;
    if(!deadline||!s.sync_deadline||deadline<=utc(s.sync_deadline)!||cap&&deadline>cap) return null;
    return request("extend_event_sync_deadline_v2",{p_request_id:crypto.randomUUID(),p_new_deadline:deadline,p_reason:why});
  }
  if(operation.kind==="seal"&&!s.sealed&&why&&(!needsAck||operation.acknowledge)) {
    // Local clock is only an early-seal UX hint; Backend owns time and readiness.
    if(s.sync_deadline&&utc(now)!<utc(s.sync_deadline)!&&s.completed_preparations!==s.known_preparations) return null;
    return request("seal_offline_uploads_v2",{p_confirm:true,p_acknowledge_unused:operation.acknowledge,p_reason:why});
  }
  if(!s.sealed) return null;
  if(operation.kind==="loss"&&why&&oneOf(operation.disposition,LOSS)&&
      operation.preparation.preparation_id&&operation.preparation.accounting===null&&operation.preparation.uploaded_count!==null) {
    return request("account_offline_preparation_loss_v2",{p_preparation_id:operation.preparation.preparation_id,
      p_disposition:operation.disposition,p_reason:why},operation.preparation.uploaded_count);
  }
  if(operation.kind==="review"&&why&&operation.claim.initial_disposition==="exception"&&
    operation.claim.decision===null&&oneOf(operation.decision,["approve","reject"])) {
    const approve=operation.decision==="approve";
    const captureAt=approve?utc(operation.captureAt):null;
    if(approve&&(!oneOf(operation.category,BASIS)||!basisReference(operation.reference)||!withinBounds(operation.claim,captureAt))) return null;
    return request("review_offline_capture_v2",{p_capture_id:operation.claim.capture_id,p_decision:operation.decision,
      p_reason:why,p_basis_category:approve?operation.category:null,p_basis_reference:approve?operation.reference:null,
      p_validated_capture_at:captureAt});
  }
  if(operation.kind==="confirm"&&s.evidence_ready&&!s.reconciliation_confirmed&&
    (!needsAck||operation.acknowledge&&why)&&(operation.why===""||why)) {
    return request("confirm_offline_reconciliation_v2",{p_acknowledge_unused:operation.acknowledge,p_reason:optionalReason(operation.why)});
  }
  if(operation.kind==="finalize"&&s.can_finalize) return request("finalize_event_v2",{});
  return null;
}
function validReceipt(c:FixtureContext,req:Request,data:unknown):Row|null {
  const r=obj(data),a=req.args,s=req.before;
  if(!r||r.policy_version!==2||!bool(r.replayed)) return null;
  const actor=(at:string,by:string)=>instant(r[at])&&uuid(r[by])&&(r.replayed||r[by]===c.actor_id);
  const event=r.event_id===c.event_id;
  switch(req.name) {
    case "close_event_v2": {
      if(!event||r.event_state!=="SYNCING"||r.request_id!==a.p_request_id||!actor("closed_at","closed_by")||
        r.reason!==a.p_reason||r.overlap_acknowledged!==a.p_overlap_acknowledged||
        !sameTime(r.initial_sync_deadline,addHours(r.closed_at as string,24))||!Array.isArray(r.effective_windows)) return null;
      const windows=a.p_windows as Window[];
      if(r.effective_windows.length!==windows.length||!r.effective_windows.every((x,i)=>{
        const w=obj(x);return w&&w.checkpoint_id===windows[i].checkpoint_id&&sameTime(w.opens_at,windows[i].opens_at)&&sameTime(w.closes_at,windows[i].closes_at);
      })) return null;
      break;
    }
    case "extend_event_sync_deadline_v2":
      if(!event||r.request_id!==a.p_request_id||!actor("adjusted_at","adjusted_by")||!instant(r.previous_deadline)||
        !sameTime(r.new_deadline,a.p_new_deadline)||r.reason!==a.p_reason||
        utc(r.previous_deadline)!>=utc(r.new_deadline)!||
        (!r.replayed&&!sameTime(r.previous_deadline,s.sync_deadline))) return null;
      break;
    case "seal_offline_uploads_v2":
      if(!event||!actor("sealed_at","sealed_by")||!bool(r.early)||!count(r.unused_assignments)||
        r.acknowledged_unused!==a.p_acknowledge_unused||r.reason!==a.p_reason||
        (!r.replayed&&s.sync_deadline!==null&&r.early!==(utc(r.sealed_at)!<utc(s.sync_deadline)!))) return null;
      break;
    case "account_offline_preparation_loss_v2":
      if(!parseAccounting(r)||!actor("accounted_at","accounted_by")||r.preparation_id!==a.p_preparation_id||
        r.disposition!==a.p_disposition||r.reason!==a.p_reason||r.declared_count!==null||
        r.uploaded_count!==req.expectedUploaded) return null;
      break;
    case "review_offline_capture_v2":
      if(r.capture_id!==a.p_capture_id||!actor("reviewed_at","reviewed_by")||r.decision!==a.p_decision||
        r.reason!==a.p_reason||r.basis_category!==a.p_basis_category||r.basis_reference!==a.p_basis_reference||
        !sameTime(r.validated_capture_at,a.p_validated_capture_at)) return null;
      break;
    case "confirm_offline_reconciliation_v2":
      if(!event||!actor("confirmed_at","confirmed_by")||!count(r.unused_assignments)||
        r.acknowledged_unused!==a.p_acknowledge_unused||r.reason!==a.p_reason) return null;
      break;
    case "finalize_event_v2":
      if(!event||r.event_state!=="FINALIZED"||!actor("finalized_at","finalized_by")||
        !count(r.winner_count)||!count(r.record_count)||r.record_count===0) return null;
      break;
    default:return null;
  }
  return r;
}

export type SessionState={ pending:Request|null; receipt:Row|null; closureReceipt:Row|null; closedAt:string|null; lost:boolean };
// Keep this instance above the mounted panel. An unknown/lost session must be
// explicitly marked lost by the harness; never create a replacement request.
export function fixtureSession(c:FixtureContext,mode:"new-fixture"|"lost-session"):SessionState {
  return {pending:null,receipt:null,closureReceipt:null,closedAt:c.closed_at,lost:mode==="lost-session"};
}
export function createManager(c:FixtureContext,t:Transport,session:SessionState) {
  let busy=false;
  let snapshot:Snapshot|null=null;
  const scope=structuredClone(c);
  const unavailable="Successor evidence unavailable or changed. Refresh scoped Backend evidence.";
  async function refresh(offsets:PageOffsets=firstPage):Promise<Snapshot|null> {
    if(busy) return null;
    busy=true;snapshot=null;
    try{snapshot=await readSnapshot(scope,t,offsets);return snapshot;}catch{return null;}finally{busy=false;}
  }
  async function dispatch(req:Request):Promise<string> {
    busy=true;snapshot=null;
    try {
      if(!await t.verify(scope)) return "Identity or manager scope changed. No further action.";
      const result=await t.rpc(req.name,structuredClone(req.args));
      if(!await t.verify(scope)) return "Identity changed; outcome unconfirmed.";
      if(result.error) return result.error.code==="23505"?"Immutable conflict. Reconcile with support; do not replace the request.":"Backend did not confirm. Exact retry only.";
      const receipt=validReceipt(scope,req,result.data);
      if(!receipt) return "Malformed acknowledgement. Exact retry only.";
      if(req.name==="close_event_v2") {session.closedAt=receipt.closed_at as string;session.closureReceipt=receipt;}
      session.receipt=receipt;
      // Even successful receipts are historical. Always read current state.
      snapshot=await readSnapshot(scope,t,firstPage);
      if(!snapshot) return unavailable+" Exact retry remains available.";
      if(req.name==="finalize_event_v2"&&(snapshot.summary.event_state!=="FINALIZED"||
        !sameTime(snapshot.summary.finalized_at,receipt.finalized_at)||
        snapshot.summary.finalized_by!==receipt.finalized_by||snapshot.summary.finalized_records!==receipt.record_count||
        snapshot.summary.provisional_winners!==receipt.winner_count)) {
        snapshot=null;return "Finalized receipt and authoritative summary disagree. Exact retry only.";
      }
      if(req.name==="close_event_v2"&&!["SYNCING","FINALIZED"].includes(snapshot.summary.event_state)||
        req.name==="extend_event_sync_deadline_v2"&&(!snapshot.summary.sync_deadline||utc(snapshot.summary.sync_deadline)!<utc(receipt.new_deadline)!)||
        req.name==="seal_offline_uploads_v2"&&!snapshot.summary.sealed||
        req.name==="confirm_offline_reconciliation_v2"&&!snapshot.summary.reconciliation_confirmed) {
        snapshot=null;return "Receipt and current summary disagree. Exact retry only.";
      }
      session.pending=null;
      return "Backend confirmed operation; refreshed current evidence.";
    } catch {return "Outcome unconfirmed. Exact retry only.";}finally{busy=false;}
  }
  return {
    context:scope,session,refresh,
    current:()=>snapshot,
    async submit(operation:Operation,confirmed:boolean,now=new Date().toISOString()):Promise<string> {
      if(busy||session.pending||session.lost||!confirmed||!instant(now)||!snapshot) return "Action blocked. Confirm and refresh evidence; unresolved requests cannot be replaced.";
      const previous=snapshot;
      busy=true;snapshot=null;
      try {
        snapshot=await readSnapshot(scope,t,previous.offsets);
        if(!snapshot||JSON.stringify(previous)!==JSON.stringify(snapshot)) return "Evidence changed or became unavailable. Review refreshed evidence before confirming again.";
      } catch {return unavailable;} finally {busy=false;}
      // Bind individual mutation targets to the current scoped page, not caller assertions.
      if(operation.kind==="loss") {
        const target=operation.preparation.preparation_id;
        const row=snapshot.preparations.find(r=>r.preparation_id===target&&r.preparation_id!==null);
        if(!row) return unavailable;
        operation={...operation,preparation:row};
      }
      if(operation.kind==="review") {
        const target=operation.claim.capture_id;
        const row=snapshot.claims.find(r=>r.capture_id===target);
        if(!row) return unavailable;
        operation={...operation,claim:row};
      }
      const req=makeRequest(scope,snapshot.summary,operation,now,session.closedAt);
      if(!req) return "Invalid operation or current lifecycle does not permit it.";
      session.pending=req;session.receipt=null;
      return dispatch(req);
    },
    async retry(confirmed:boolean):Promise<string> {
      if(busy||!confirmed||session.lost||!session.pending) return "No confirmed exact retry available.";
      return dispatch(session.pending);
    }
  };
}
export type Manager=ReturnType<typeof createManager>;
