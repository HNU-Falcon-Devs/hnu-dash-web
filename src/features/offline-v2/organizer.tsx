"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BASIS, LOSS, PAGE_SIZE, addHours, changedWindows, normalizeWindows, overlaps, utc, withinBounds,
  type Claim, type FixtureContext, type Preparation, type Window } from "./contract";
import { firstPage, type Manager, type Operation, type PageOffsets } from "./manager";

const field="w-full rounded border border-slate-400 bg-transparent p-2";
const value=(data:FormData,key:string)=>String(data.get(key)??"");
const checked=(data:FormData,key:string)=>data.get(key)==="on";

function ExplicitForm({label,children,onSubmit,disabled=false}:{
  label:string;children?:ReactNode;onSubmit:(data:FormData)=>void;disabled?:boolean
}) {
  const [confirmed,setConfirmed]=useState(false);
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(disabled||!confirmed) return;
    const data=new FormData(e.currentTarget);
    setConfirmed(false);onSubmit(data);
  }
  return <form aria-label={label} onSubmit={submit} onChange={e=>{
    if((e.target as HTMLInputElement).name!=="explicit") setConfirmed(false);
  }} className="space-y-3 rounded border p-3">
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="font-medium">{label}</legend>
      {children}
      <label className="flex gap-2"><input name="explicit" type="checkbox" required checked={confirmed}
        onChange={e=>setConfirmed(e.target.checked)}/> I explicitly confirm this action.</label>
      <Button type="submit" size="sm" disabled={!confirmed||disabled}>{label}</Button>
    </fieldset>
  </form>;
}
function Reason({required=true}:{required?:boolean}) {
  return <label className="block">Reason<textarea name="why" required={required} maxLength={500} className={field}/></label>;
}
function Acknowledge() {
  return <label className="flex gap-2"><input type="checkbox" name="acknowledge"/> I acknowledge unused assignments or no preparations; this is not proof of synchronization.</label>;
}
function CloseForm({context,submit,disabled}:{context:FixtureContext;submit:(o:Operation)=>void;disabled:boolean}) {
  const [windows,setWindows]=useState<Window[]>(()=>context.checkpoints.map(w=>({
    checkpoint_id:w.checkpoint_id,opens_at:w.opens_at,closes_at:w.closes_at
  })));
  const normalized=normalizeWindows(context,windows);
  const overlap=normalized!==null&&overlaps(normalized);
  const changed=normalized!==null&&changedWindows(context,normalized);
  const early=utc(new Date().toISOString())!<utc(context.ends_at)!;
  function update(i:number,key:"opens_at"|"closes_at",v:string) {
    setWindows(old=>old.map((w,j)=>i===j?{...w,[key]:v}:w));
  }
  return <ExplicitForm label="Close event manually" disabled={disabled||!normalized} onSubmit={data=>{
    submit({kind:"close",windows,overlap:checked(data,"overlap"),earlyAcknowledged:checked(data,"early"),why:value(data,"why")});
  }}>
    <p>Original windows are immutable. Independently extend the start earlier or the end later. Each interval is half-open [start, end). Backend closure uses server time.</p>
    <p>Use ISO date and time with seconds, explicit UTC offset or Z, and up to six fractional digits.</p>
    {context.checkpoints.map((p,i)=><fieldset key={p.checkpoint_id} className="space-y-2">
      <legend>{p.label} ({p.direction})</legend>
      <p>Planned: {p.opens_at} — {p.closes_at}</p>
      <label className="block">Effective start {p.label}<input className={field} required value={windows[i].opens_at}
        onChange={e=>update(i,"opens_at",e.target.value)}/></label>
      <label className="block">Effective end {p.label}<input className={field} required value={windows[i].closes_at}
        onChange={e=>update(i,"closes_at",e.target.value)}/></label>
      <p>UTC: {utc(windows[i].opens_at)??"Invalid"} — {utc(windows[i].closes_at)??"Invalid"}</p>
    </fieldset>)}
    {!normalized&&<p role="alert">Invalid schedule: do not shorten, shift or omit any planned window.</p>}
    {overlap&&<label className="flex gap-2"><input name="overlap" type="checkbox" required/> I acknowledge overlapping effective windows.</label>}
    <label className="flex gap-2"><input name="early" type="checkbox" required={early}/> I acknowledge closure may occur before the planned event end ({context.ends_at}).</label>
    <Reason required={early||changed}/>
  </ExplicitForm>;
}
function LossForm({row,submit,disabled}:{row:Preparation;submit:(o:Operation)=>void;disabled:boolean}) {
  return <ExplicitForm label={"Account loss "+row.preparation_id} disabled={disabled} onSubmit={data=>submit({
    kind:"loss",preparation:row,disposition:value(data,"disposition"),why:value(data,"why")
  })}>
    <p>Immutable loss disposition. Actual received count: {row.uploaded_count}. Declared count remains null. Not successful synchronization.</p>
    <label className="block">Loss category<select name="disposition" required defaultValue="" className={field}>
      <option value="">Select category</option>{LOSS.map(x=><option key={x}>{x}</option>)}
    </select></label><Reason/>
  </ExplicitForm>;
}
function ReviewForm({row,submit,disabled}:{row:Claim;submit:(o:Operation)=>void;disabled:boolean}) {
  const [decision,setDecision]=useState("");
  const [captureAt,setCaptureAt]=useState("");
  const allowed=decision==="reject"||decision==="approve"&&withinBounds(row,captureAt);
  return <ExplicitForm label={"Review exception "+row.capture_id} disabled={disabled} onSubmit={data=>{
    if(allowed) submit({kind:"review",claim:row,decision,why:value(data,"why"),category:value(data,"category"),
      reference:value(data,"reference"),captureAt});
  }}>
    <p>Hard bounds: [{row.hard_start}, {row.hard_end}); receipt upper bound: {row.received_at}.</p>
    <p>Reliable partial interval: {row.plausible_start===null?"Unavailable":row.plausible_start+" — "+row.plausible_end}. Timing basis: {row.timing_basis}.</p>
    <label className="block">Individual decision<select required value={decision} onChange={e=>setDecision(e.target.value)} className={field}>
      <option value="">Choose explicitly</option><option value="approve">Approve</option><option value="reject">Reject</option>
    </select></label>
    {decision==="approve"&&<>
      <p>Record synthetic corroboration only. This assertion is not physical proof or server verification of the observation.</p>
      <label className="block">Corroboration category<select name="category" required defaultValue="" className={field}>
        <option value="">Choose category</option>{BASIS.map(x=><option key={x}>{x}</option>)}
      </select></label>
      <label className="block">Synthetic reference<input name="reference" required pattern="synthetic:[A-Za-z0-9_-]{1,128}" className={field}/></label>
      <label className="block">Validated capture instant<input required value={captureAt} onChange={e=>setCaptureAt(e.target.value)} className={field}/></label>
      {!allowed&&<p role="alert">Enter an explicit offset instant within all available bounds.</p>}
      <p>UTC: {utc(captureAt)??"Invalid"}</p>
    </>}
    <Reason/>
  </ExplicitForm>;
}
function Pager({name,offset,length,disabled,go}:{name:string;offset:number;length:number;disabled:boolean;go:(n:number)=>void}) {
  return <nav aria-label={name+" pagination"} className="flex flex-wrap gap-2">
    <span>Page {offset/PAGE_SIZE+1}; {length} rows on this page</span>
    <Button type="button" size="sm" disabled={disabled||offset===0} onClick={()=>go(offset-PAGE_SIZE)}>Previous {name}</Button>
    <Button type="button" size="sm" disabled={disabled||length<PAGE_SIZE||offset+PAGE_SIZE>2147483647} onClick={()=>go(offset+PAGE_SIZE)}>Next {name}</Button>
  </nav>;
}

// No ordinary route, navigation, runtime URL, environment flag or server action
// imports this component. Only explicit synthetic test harnesses mount it.
export function FixtureOrganizer({manager}:{manager:Manager}) {
  return <Organizer key={manager.context.organization_id+":"+manager.context.event_id+":"+manager.context.actor_id} manager={manager}/>;
}
function Organizer({manager}:{manager:Manager}) {
  const [view,setView]=useState(()=>manager.current());
  const [offsets,setOffsets]=useState<PageOffsets>(firstPage);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const locked=useRef(false);
  const c=manager.context;
  async function run(action:()=>Promise<string>) {
    if(locked.current) return;
    locked.current=true;setBusy(true);setMessage("");setView(null);
    try {setMessage(await action());setView(manager.current());}
    catch {setMessage("Unconfirmed operation. Reload scoped evidence.");}
    finally {locked.current=false;setBusy(false);}
  }
  function refresh(next:PageOffsets) {
    setOffsets(next);
    void run(async()=>await manager.refresh(next)?"Authoritative scoped evidence refreshed.":"Evidence unavailable, denied or changed. No actions available.");
  }
  function submit(operation:Operation) {
    setOffsets(firstPage);
    void run(()=>manager.submit(operation,true));
  }
  const s=view?.summary;
  const blocked=busy||manager.session.pending!==null||manager.session.lost;
  return <section aria-label="Synthetic successor organizer" className="space-y-4">
    <Card><CardHeader><CardTitle>{c.title} — Policy 2 fixture</CardTitle></CardHeader><CardContent className="space-y-3">
      <p>Fixture-only. Not an operational event route or institutional attendance. The Backend owns all authorization and state.</p>
      <Button type="button" size="sm" disabled={busy} onClick={()=>refresh(offsets)}>Refresh authoritative evidence</Button>
      {busy&&<p role="status">Loading scoped evidence…</p>}
      {message&&<p role="status" aria-live="polite">{message}</p>}
      {manager.session.lost&&<p role="alert">Session state lost. Reconcile with support before any new action.</p>}
      {manager.session.pending&&<ExplicitForm label="Retry exact request" disabled={busy||manager.session.lost}
        onSubmit={()=>{setOffsets(firstPage);void run(()=>manager.retry(true));}}>
        <p role="alert">Unconfirmed request retained. No replacement request or new operation is allowed.</p>
      </ExplicitForm>}
      {manager.session.receipt&&manager.session.receipt.closed_at!==undefined&&
        <p>Historical closure receipt: {String(manager.session.receipt.closed_at)}; initial deadline: {String(manager.session.receipt.initial_sync_deadline)}. Current state comes from refreshed summary.</p>}
    </CardContent></Card>
    {s&&view&&<>
      <Card><CardHeader><CardTitle>Organizer lifecycle</CardTitle></CardHeader><CardContent className="space-y-3">
        <p>Current state: {s.event_state}; upload deadline: {s.sync_deadline??"Not set"}; sealed: {s.sealed?"Yes":"No"}.</p>
        <p>Authoritative closure: {manager.session.closedAt??"Unavailable in current scoped summary"}.</p>
        <p>Known preparations: {s.known_preparations}; accounted: {s.accounted_preparations}; completed: {s.completed_preparations}; loss-accounted: {s.loss_accounted_preparations}; unused assignments: {s.unused_assignments}.</p>
        <p>Submitted claims: {s.submitted_claims}; eligible: {s.eligible_claims}; rejected: {s.rejected_claims}; pending exceptions: {s.pending_exceptions}; provisional winners: {s.provisional_winners}.</p>
        <p>Known preparations are not all devices; received claims are not official attendance. No timer closes, seals or finalizes.</p>
        {s.event_state==="OPEN"&&<CloseForm context={c} submit={submit} disabled={blocked}/>}
        {s.event_state==="SYNCING"&&!s.sealed&&<>
          {c.role!=="admin"&&<ExplicitForm label="Extend synchronization deadline" disabled={blocked} onSubmit={data=>submit({
            kind:"extend",deadline:value(data,"deadline"),why:value(data,"why")
          })}>
            <p>Only extend, including after expiry while unsealed. Maximum: {manager.session.closedAt?addHours(manager.session.closedAt,168):"Closure + 168 elapsed hours (closure unknown; Backend validates)"}.</p>
            <label className="block">New deadline with explicit offset<input name="deadline" required className={field}/></label><Reason/>
          </ExplicitForm>}
          <ExplicitForm label="Seal uploads manually" disabled={blocked} onSubmit={data=>submit({
            kind:"seal",acknowledge:checked(data,"acknowledge"),why:value(data,"why")
          })}>
            <p>Before deadline every known preparation must be completed. At or after deadline loss accounting may follow. Backend decides server time. Sealing is irreversible.</p>
            <Acknowledge/><Reason/>
          </ExplicitForm>
        </>}
        {s.event_state==="SYNCING"&&s.sealed&&s.evidence_ready&&!s.reconciliation_confirmed&&
          <ExplicitForm label="Confirm reconciliation" disabled={blocked} onSubmit={data=>submit({
            kind:"confirm",acknowledge:checked(data,"acknowledge"),why:value(data,"why")
          })}><p>Confirmation is separate from finalization. Accounted losses are not completed synchronization.</p><Acknowledge/>
            <Reason required={s.unused_assignments>0||s.known_preparations===0}/></ExplicitForm>}
        {s.event_state==="SYNCING"&&s.can_finalize&&<ExplicitForm label="Finalize event manually" disabled={blocked}
          onSubmit={()=>submit({kind:"finalize"})}><p>Irreversible synthetic prototype results. Backend rechecks readiness and confirmation.</p></ExplicitForm>}
        <p>Evidence ready: {s.evidence_ready?"Yes":"No"}; reconciliation confirmed: {s.reconciliation_confirmed?"Yes":"No"}.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Preparation accounting</CardTitle></CardHeader><CardContent className="space-y-3">
        {!view.preparations.length&&<p role="status">No preparation/assignment rows on this page.</p>}
        {view.preparations.map(row=><article key={row.assignment_id} className="space-y-2 border-b pb-2">
          <p>Assignment {row.assignment_id} · Staff {row.staff_user_id} · {row.revoked_at?"Revoked":"Active period"}</p>
          <p>{row.preparation_id??"Unused assignment"} · Received {row.uploaded_count??"Not applicable"} · {row.accounting?.disposition??"Unaccounted / unused"} · Declared {row.accounting?.declared_count??"Not declared"}</p>
          {row.accounting&&<p>Audit: {row.accounting.accounted_at} · {row.accounting.accounted_by} · {row.accounting.reason??"Completion"}</p>}
          {s.event_state==="SYNCING"&&s.sealed&&row.preparation_id&&row.accounting===null&&
            <LossForm row={row} submit={submit} disabled={blocked}/>}
        </article>)}
        <Pager name="preparations" offset={offsets.preparations} length={view.preparations.length} disabled={busy}
          go={preparations=>refresh({...offsets,preparations})}/>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Claims and individual exceptions</CardTitle></CardHeader><CardContent className="space-y-3">
        <label className="flex gap-2"><input type="checkbox" checked={offsets.exceptionsOnly} disabled={busy}
          onChange={e=>refresh({...offsets,claims:0,exceptionsOnly:e.target.checked})}/> Original exceptions only</label>
        {!view.claims.length&&<p role="status">No claims on this page.</p>}
        {view.claims.map(row=><article key={row.capture_id} className="space-y-2 border-b pb-2">
          <p>{row.capture_id} · Student {row.student_id} · Checkpoint {row.checkpoint_id}</p>
          <p>Initial {row.initial_disposition}; resolved {row.disposition}; received {row.received_at}; normalized {row.normalized_at??"Not established"}; {row.provisional_winner?"Provisional winner":"Not a provisional winner"}.</p>
          {row.decision&&<p>Decision: {row.decision}; {row.review_reason}; {row.basis_reference??"No corroboration reference"}; {row.reviewed_at} · {row.reviewed_by}</p>}
          {s.event_state==="SYNCING"&&s.sealed&&row.initial_disposition==="exception"&&row.decision===null&&
            <ReviewForm row={row} submit={submit} disabled={blocked}/>}
        </article>)}
        <Pager name="claims" offset={offsets.claims} length={view.claims.length} disabled={busy}
          go={claims=>refresh({...offsets,claims})}/>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{s.event_state==="FINALIZED"?"Materialized checkpoint evidence":"Provisional checkpoint coverage"}</CardTitle></CardHeader><CardContent className="space-y-3">
        <p>Pages are independent reads and may change before confirmation. Missing provisional evidence is not finalized absence.</p>
        {!view.coverage.length&&<p role="status">No coverage rows on this page.</p>}
        {view.coverage.map(row=><p key={row.student_id+":"+row.checkpoint_id}>{row.student_id} · {row.checkpoint_label} ·
          {row.provisional_capture_id?row.validated_capture_at:"No winner"} · {row.final_receipt_id??"No final receipt"}</p>)}
        <Pager name="coverage" offset={offsets.coverage} length={view.coverage.length} disabled={busy}
          go={coverage=>refresh({...offsets,coverage})}/>
      </CardContent></Card>
      {s.event_state==="FINALIZED"&&<Card><CardHeader><CardTitle>Finalized synthetic results</CardTitle></CardHeader><CardContent className="space-y-3">
        <p>Backend finalized {s.finalized_records} records at {s.finalized_at} by {s.finalized_by}.</p>
        {!view.results.length&&<p role="status">No results on this page.</p>}
        {view.results.map(row=><p key={row.student_id}>{row.student_id} · {row.status} · {row.accepted_checkpoint_count}/{row.required_checkpoint_count}</p>)}
        <Pager name="results" offset={offsets.results} length={view.results.length} disabled={busy}
          go={results=>refresh({...offsets,results})}/>
      </CardContent></Card>}
    </>}
  </section>;
}
