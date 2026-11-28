import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createManager, fixtureSession, firstPage, type Operation, type Transport } from "./manager";
import { FixtureOrganizer } from "./organizer";
import { type FixtureContext, type Row } from "./contract";
import { ACTOR, EVENT, PREP, CAPTURE, context, openSummary, closedAt, cutoff, syncing, ready, prep, exception } from "./test-fixtures";

function harness(c:FixtureContext=context,initial:Row=openSummary) {
  let summary=initial;
  let preparations:unknown[]=[initial.completed_preparations===1?{...prep,uploaded_count:0,accounting:{preparation_id:PREP,disposition:"completed",uploaded_count:0,declared_count:0,reason:null,accounted_at:cutoff,accounted_by:ACTOR}}:{...prep,uploaded_count:0}];
  let claims:unknown[]=[];
  let results:unknown[]=[];
  const mutate=vi.fn<(name:string,args:Row)=>Promise<{data:unknown;error:{code?:string}|null}>>();
  mutate.mockResolvedValue({data:null,error:{code:"55000"}});
  const verify=vi.fn(async()=>true);
  const rpc=vi.fn(async(name:string,args:Row)=>{
    if(name==="get_event_offline_summary_v2") return {data:summary,error:null};
    if(name==="get_event_offline_preparations_v2") return {data:preparations,error:null};
    if(name==="get_event_offline_claims_v2") return {data:claims,error:null};
    if(name==="get_event_checkpoint_coverage_v2") return {data:[],error:null};
    if(name==="get_event_finalized_results_v2") return {data:results,error:null};
    return mutate(name,args);
  });
  const transport:Transport={verify,rpc};
  const session=fixtureSession(c,"new-fixture");
  const manager=createManager(c,transport,session);
  return {manager,session,transport,rpc,verify,mutate,
    setSummary:(s:Row)=>{summary=s;},setPreparations:(p:unknown[])=>{preparations=p;},
    setClaims:(q:unknown[])=>{claims=q;},setResults:(r:unknown[])=>{results=r;}};
}
const close:Operation={kind:"close",windows:context.checkpoints.map(w=>({checkpoint_id:w.checkpoint_id,opens_at:w.opens_at,closes_at:w.closes_at})),
  overlap:false,earlyAcknowledged:false,why:""};
const late="2027-01-01T06:00:00Z";
const closeReceipt=(args:Row,replayed:boolean)=>({policy_version:2,event_id:EVENT,request_id:args.p_request_id,event_state:"SYNCING",
  closed_at:closedAt,closed_by:ACTOR,reason:args.p_reason,overlap_acknowledged:args.p_overlap_acknowledged,
  effective_windows:args.p_windows,initial_sync_deadline:cutoff,replayed});

describe("fixture-only manager interactions",()=>{
  it("fails closed for mixed version or denied scopes without v1 fallback",async()=>{
    const h=harness(context,{...openSummary,policy_version:1});
    expect(await h.manager.refresh()).toBeNull();
    expect(await h.manager.submit(close,true,late)).toMatch(/blocked/i);
    expect(h.mutate).not.toHaveBeenCalled();
    h.setSummary(openSummary);h.verify.mockResolvedValue(false);
    expect(await h.manager.refresh()).toBeNull();
    expect(h.rpc.mock.calls.every(([name])=>name.endsWith("_v2"))).toBe(true);
  });
  it("requires reason for early closure, overlap acknowledgement and explicit confirmation",async()=>{
    const h=harness();
    await h.manager.refresh();
    expect(await h.manager.submit(close,false,late)).toMatch(/blocked/i);
    expect(await h.manager.submit(close,true,"2027-01-01T04:00:00Z")).toMatch(/invalid/i);
    const windows=close.windows.map(w=>({...w}));windows[0].closes_at="2027-01-01T03:00:00.000001Z";
    expect(await h.manager.submit({...close,windows,why:"Extend"},true,late)).toMatch(/invalid/i);
    expect(h.mutate).not.toHaveBeenCalled();
  });
  it("retains exact normalized closure UUID and payload across response loss and remount",async()=>{
    const h=harness();
    await h.manager.refresh();
    h.mutate.mockImplementationOnce(async()=>{h.setSummary(syncing);throw Error("lost response");});
    expect(await h.manager.submit(close,true,late)).toMatch(/unconfirmed/i);
    const first=h.mutate.mock.calls[0];
    expect(h.session.pending).not.toBeNull();
    const remounted=createManager(context,h.transport,h.session);
    await remounted.refresh();
    expect(await remounted.submit(close,true,late)).toMatch(/blocked/i);
    h.mutate.mockImplementationOnce(async(_name,args)=>({data:closeReceipt(args,true),error:null}));
    expect(await remounted.retry(true)).toMatch(/Backend confirmed/);
    expect(h.mutate.mock.calls[1]).toEqual(first);
    expect(h.session.closedAt).toBe(closedAt);
    expect(h.session.pending).toBeNull();
    expect(remounted.current()?.summary.sync_deadline).toBe(cutoff);
  });
  it("blocks new actions on lost session even if current server state is readable",async()=>{
    const h=harness();
    const m=createManager(context,h.transport,fixtureSession(context,"lost-session"));
    expect(await m.refresh()).not.toBeNull();
    expect(await m.submit(close,true,late)).toMatch(/blocked/i);
    expect(h.mutate).not.toHaveBeenCalled();
  });
  it("restricts deadline extension to head and exact elapsed cap; expired unsealed allowed",async()=>{
    const c={...context,closed_at:closedAt};
    const h=harness(c,syncing);
    await h.manager.refresh();
    expect(await h.manager.submit({kind:"extend",deadline:"2027-01-08T05:00:00.123457Z",why:"Extra time"},true,late)).toMatch(/invalid/i);
    h.mutate.mockImplementationOnce(async(_name,args)=>{
      h.setSummary({...syncing,sync_deadline:args.p_new_deadline});
      return {data:{policy_version:2,event_id:EVENT,request_id:args.p_request_id,previous_deadline:cutoff,
        new_deadline:args.p_new_deadline,reason:args.p_reason,adjusted_at:"2027-01-03T00:00:00Z",adjusted_by:ACTOR,replayed:false},error:null};
    });
    expect(await h.manager.submit({kind:"extend",deadline:"2027-01-08T05:00:00.123456Z",why:"Extra time"},true,"2027-01-03T00:00:00Z")).toMatch(/Backend confirmed/);
    const admin=harness({...c,role:"admin"},syncing);await admin.manager.refresh();
    expect(await admin.manager.submit({kind:"extend",deadline:"2027-01-04T00:00:00Z",why:"Extra time"},true,late)).toMatch(/invalid/i);
    expect(admin.mutate).not.toHaveBeenCalled();
  });
  it("rejects early seal while incomplete, requires unused acknowledgement, and uses actual loss counts",async()=>{
    const h=harness(context,{...syncing,unused_assignments:1});
    const unused={...prep,assignment_id:"99999999-9999-4999-8999-999999999999",preparation_id:null,issued_at:null,uploaded_count:null};
    h.setPreparations([prep,unused]);await h.manager.refresh();
    expect(await h.manager.submit({kind:"seal",acknowledge:true,why:"Seal"},true,late)).toMatch(/invalid/i);
    expect(await h.manager.submit({kind:"seal",acknowledge:false,why:"Seal"},true,"2027-01-03T00:00:00Z")).toMatch(/invalid/i);
    h.mutate.mockImplementationOnce(async()=>{h.setSummary({...syncing,unused_assignments:1,sealed:true});
      return {data:{policy_version:2,event_id:EVENT,sealed_at:cutoff,sealed_by:ACTOR,early:false,unused_assignments:1,
        acknowledged_unused:true,reason:"Seal",replayed:false},error:null};});
    expect(await h.manager.submit({kind:"seal",acknowledge:true,why:"Seal"},true,"2027-01-03T00:00:00Z")).toMatch(/Backend confirmed/);
    h.mutate.mockImplementationOnce(async()=>{
      const accounting={preparation_id:PREP,disposition:"lost",uploaded_count:1,declared_count:null,reason:"Missing device",
        accounted_at:cutoff,accounted_by:ACTOR};
      h.setPreparations([{...prep,accounting},unused]);h.setSummary({...syncing,unused_assignments:1,sealed:true,
        accounted_preparations:1,loss_accounted_preparations:1,evidence_ready:true});
      return {data:{...accounting,policy_version:2,replayed:false},error:null};
    });
    expect(await h.manager.submit({kind:"loss",preparation:h.manager.current()!.preparations[0],disposition:"lost",why:"Missing device"},true,late)).toMatch(/Backend confirmed/);
    expect(h.manager.current()?.summary.completed_preparations).toBe(0);
  });
  it("blocks review outside server bounds, permits only synthetic individual corroboration",async()=>{
    const h=harness(context,{...syncing,sealed:true,submitted_claims:1,pending_exceptions:1});
    h.setClaims([exception]);await h.manager.refresh();
    const claim=h.manager.current()!.claims[0];
    const op:Operation={kind:"review",claim,decision:"approve",why:"Corroborated",category:"synthetic_event_record",reference:"synthetic:record_a",
      captureAt:"2027-01-01T01:00:00.000001Z"};
    expect(await h.manager.submit({...op,captureAt:"2027-01-01T01:00:00Z"},true,late)).toMatch(/invalid/i);
    expect(await h.manager.submit({...op,reference:"real-data"},true,late)).toMatch(/invalid/i);
    h.mutate.mockImplementationOnce(async(_name,args)=>{
      h.setClaims([{...exception,decision:"approve",review_reason:"Corroborated",basis_category:op.category,
        basis_reference:op.reference,reviewed_at:cutoff,reviewed_by:ACTOR,disposition:"eligible",normalized_at:op.captureAt,provisional_winner:true}]);
      h.setSummary({...syncing,sealed:true,submitted_claims:1,eligible_claims:1,provisional_winners:1});
      return {data:{policy_version:2,capture_id:CAPTURE,decision:"approve",reason:"Corroborated",basis_category:op.category,
        basis_reference:op.reference,validated_capture_at:args.p_validated_capture_at,reviewed_at:cutoff,reviewed_by:ACTOR,replayed:false},error:null};
    });
    expect(await h.manager.submit(op,true,late)).toMatch(/Backend confirmed/);
    expect(h.mutate.mock.calls[0][1].p_validated_capture_at).toBe(op.captureAt);
    expect(await h.manager.submit(op,true,late)).toMatch(/invalid/i);
  });
  it("separates evidence readiness, confirmation, explicit finalization and validated results",async()=>{
    const h=harness(context,ready);await h.manager.refresh();
    expect(await h.manager.submit({kind:"finalize"},true,late)).toMatch(/invalid/i);
    h.mutate.mockImplementationOnce(async()=>{
      h.setSummary({...ready,reconciliation_confirmed:true,can_finalize:true});
      return {data:{policy_version:2,event_id:EVENT,confirmed_at:cutoff,confirmed_by:ACTOR,unused_assignments:0,
        acknowledged_unused:false,reason:null,replayed:false},error:null};
    });
    expect(await h.manager.submit({kind:"confirm",acknowledge:false,why:""},true,late)).toMatch(/Backend confirmed/);
    expect(h.rpc.mock.calls.some(([name])=>name==="get_event_finalized_results_v2")).toBe(false);
    h.mutate.mockImplementationOnce(async()=>{
      h.setSummary({...ready,event_state:"FINALIZED",reconciliation_confirmed:true,can_finalize:false,
        finalized_at:cutoff,finalized_by:ACTOR,finalized_records:1});
      h.setResults([{event_id:EVENT,student_id:"000001",status:"ABSENT",required_checkpoint_count:2,accepted_checkpoint_count:0}]);
      return {data:{policy_version:2,event_id:EVENT,event_state:"FINALIZED",finalized_at:cutoff,finalized_by:ACTOR,
        winner_count:0,record_count:1,replayed:false},error:null};
    });
    expect(await h.manager.submit({kind:"finalize"},true,late)).toMatch(/Backend confirmed/);
    expect(h.manager.current()?.results[0].status).toBe("ABSENT");
  });
  it("rejects stale evidence before mutation and invalid pagination",async()=>{
    const h=harness();await h.manager.refresh();
    h.setSummary(syncing);
    expect(await h.manager.submit(close,true,late)).toMatch(/changed/i);
    expect(h.mutate).not.toHaveBeenCalled();
    expect(await h.manager.refresh({...firstPage,claims:1})).toBeNull();
  });
  it("renders only explicit controls, makes invalid window editable and denies automatic dispatch",async()=>{
    const h=harness();
    render(<FixtureOrganizer manager={h.manager}/>);
    expect(screen.queryByRole("form",{name:"Close event manually"})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Refresh authoritative evidence"}));
    fireEvent.click(await screen.findByRole("button",{name:"Open closure dialog"}));
    const form=await screen.findByRole("form",{name:"Close event manually"});
    const input=within(form).getByRole("textbox",{name:"Effective start Entry"});
    const button=within(form).getByRole("button",{name:"Close event manually"});
    expect(button).toBeDisabled();
    fireEvent.change(input,{target:{value:"bad"}});
    expect(input).toBeEnabled();
    expect(within(form).getByRole("alert")).toHaveTextContent(/Invalid schedule/);
    fireEvent.change(input,{target:{value:context.checkpoints[0].opens_at}});
    expect(within(form).queryByRole("alert")).not.toBeInTheDocument();
    expect(h.mutate).not.toHaveBeenCalled();
  });
  it("keeps authoritative page/filter after rejected multi-page action",async()=>{
    const h=harness(context,{...syncing,sealed:true,submitted_claims:201,pending_exceptions:201});
    // The mock returns the requested page; original exceptions remain filterable.
    const pageOne=Array.from({length:200},(_,i)=>({...exception,capture_id:"77777777-7777-4777-8777-"+String(i).padStart(12,"0")}));
    const pageTwo=[{...exception,capture_id:"77777777-7777-4777-8777-999999999999"}];
    const original=h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation(async(name,args)=>name==="get_event_offline_claims_v2"
      ?{data:args.p_offset===200?pageTwo:pageOne,error:null}:original(name,args));
    await h.manager.refresh({...firstPage,claims:200,exceptionsOnly:true});
    render(<FixtureOrganizer manager={h.manager}/>);
    const nav=screen.getByRole("navigation",{name:"claims pagination"});
    expect(within(nav).getByText(/Page 2; 1 rows/)).toBeInTheDocument();
    const form=screen.getByRole("form",{name:"Review exception "+pageTwo[0].capture_id});
    fireEvent.change(within(form).getByRole("combobox",{name:"Individual decision"}),{target:{value:"reject"}});
    fireEvent.change(within(form).getByRole("textbox",{name:"Reason"}),{target:{value:"Synthetic reason"}});
    fireEvent.click(within(form).getByRole("checkbox",{name:/explicitly confirm/}));
    fireEvent.submit(form);
    await screen.findByText(/initial request; no write persisted/);
    const returnedNav=screen.getByRole("navigation",{name:"claims pagination"});
    expect(within(returnedNav).getByText(/Page 2; 1 rows/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox",{name:"Original exceptions only"})).toBeChecked();
    expect(within(returnedNav).getByRole("button",{name:"Previous claims"})).toBeEnabled();
    expect(h.mutate).toHaveBeenCalledTimes(1);
  });
  it("closure dialog supports cancellation, keyboard trapping and focus restoration",async()=>{
    const h=harness();await h.manager.refresh();
    render(<FixtureOrganizer manager={h.manager}/>);
    const opener=screen.getByRole("button",{name:"Open closure dialog"});
    opener.focus();fireEvent.click(opener);
    const dialog=screen.getByRole("dialog",{name:"Confirm event closure"});
    const closeModal=within(dialog).getByRole("button",{name:"Close modal"});
    const cancel=within(dialog).getByRole("button",{name:"Cancel closure"});
    expect(closeModal).toHaveFocus();
    fireEvent.keyDown(window,{key:"Tab",shiftKey:true});expect(cancel).toHaveFocus();
    fireEvent.keyDown(window,{key:"Tab"});expect(closeModal).toHaveFocus();
    fireEvent.keyDown(window,{key:"Escape"});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();expect(opener).toHaveFocus();
    fireEvent.click(opener);fireEvent.click(screen.getByRole("button",{name:"Cancel closure"}));
    expect(opener).toHaveFocus();expect(h.mutate).not.toHaveBeenCalled();
  });
  it("closure submission moves focus to loading and outcome, with explicit confirmation",async()=>{
    const h=harness();await h.manager.refresh();
    let resolve!:(v:{data:unknown;error:{code?:string}|null})=>void;
    h.mutate.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    render(<FixtureOrganizer manager={h.manager}/>);
    fireEvent.click(screen.getByRole("button",{name:"Open closure dialog"}));
    const form=screen.getByRole("form",{name:"Close event manually"});
    fireEvent.click(within(form).getByRole("checkbox",{name:/acknowledge closure may/}));
    fireEvent.change(within(form).getByRole("textbox",{name:"Reason"}),{target:{value:"Synthetic closure"}});
    fireEvent.click(within(form).getByRole("checkbox",{name:/explicitly confirm/}));
    fireEvent.submit(form);
    await waitFor(()=>expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Loading scoped evidence…")).toHaveFocus();
    await act(async()=>resolve({data:null,error:{code:"22023"}}));
    expect(await screen.findByText(/initial request; no write persisted/)).toHaveFocus();
    expect(screen.getByRole("button",{name:"Open closure dialog"})).toBeEnabled();
  });
  it.each(["22023","55000","42501"])("initial deterministic %s rejection permits a corrected request only after scoped refresh",async(code)=>{
    const h=harness();await h.manager.refresh();
    h.mutate.mockResolvedValueOnce({data:null,error:{code}});
    expect(await h.manager.submit(close,true,late)).toMatch(/rejected/i);
    expect(h.session.pending).toBeNull();expect(h.session.pendingOutcome).toBeNull();
    await h.manager.refresh();
    h.mutate.mockImplementationOnce(async(_name,args)=>{h.setSummary(syncing);return {data:closeReceipt(args,false),error:null};});
    expect(await h.manager.submit({...close,why:"Corrected"},true,late)).toMatch(/Backend confirmed/);
    expect(h.mutate.mock.calls[1][1].p_request_id).not.toBe(h.mutate.mock.calls[0][1].p_request_id);
  });
  it.each(["22023","55000","42501","23505"])("preserves earlier ambiguous request after retry returns %s",async(code)=>{
    const h=harness();await h.manager.refresh();
    h.mutate.mockRejectedValueOnce(Error("response lost"));
    expect(await h.manager.submit(close,true,late)).toMatch(/unconfirmed/i);
    const pending=structuredClone(h.session.pending);
    h.mutate.mockResolvedValueOnce({data:null,error:{code}});
    await h.manager.retry(true);
    expect(h.session.pending).toEqual(pending);
    expect(h.mutate.mock.calls[1]).toEqual(h.mutate.mock.calls[0]);
    expect(h.session.pendingOutcome).toBe(code==="23505"?"conflict":code==="42501"?"denied":"ambiguous");
    await h.manager.refresh();
    expect(await h.manager.submit({...close,why:"Replacement"},true,late)).toMatch(/blocked/i);
    expect(h.session.pending).toEqual(pending);
    if(code==="23505") {
      expect(await h.manager.retry(true)).toMatch(/conflict/i);
      expect(h.mutate).toHaveBeenCalledTimes(2);
    }
  });
  it("retains ambiguous request on lost authorization before a retry and accepts exact replay after restoration",async()=>{
    const h=harness();await h.manager.refresh();
    h.mutate.mockImplementationOnce(async()=>{h.setSummary(syncing);throw Error("response lost");});
    await h.manager.submit(close,true,late);
    const pending=structuredClone(h.session.pending);
    h.verify.mockResolvedValue(false);
    expect(await h.manager.retry(true)).toMatch(/denied/i);
    expect(h.session.pending).toEqual(pending);expect(h.mutate).toHaveBeenCalledTimes(1);
    h.verify.mockResolvedValue(true);
    h.mutate.mockImplementationOnce(async(_name,args)=>({data:closeReceipt(args,true),error:null}));
    expect(await h.manager.retry(true)).toMatch(/Backend confirmed/);
    expect(h.mutate.mock.calls[1]).toEqual(h.mutate.mock.calls[0]);
    expect(h.session.pending).toBeNull();
  });
  it("prevents concurrent exact retry from a remounted manager sharing the session",async()=>{
    const h=harness();await h.manager.refresh();
    let resolve!:(v:{data:unknown;error:{code?:string}|null})=>void;
    h.mutate.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    const first=h.manager.submit(close,true,late);
    await waitFor(()=>expect(h.mutate).toHaveBeenCalledTimes(1));
    const pending=structuredClone(h.session.pending);
    const remounted=createManager(context,h.transport,h.session);
    expect(await remounted.retry(true)).toMatch(/still in flight/i);
    expect(h.mutate).toHaveBeenCalledTimes(1);expect(h.session.pending).toEqual(pending);
    resolve({data:null,error:{code:"40001"}});await first;
    expect(h.session.pending).toEqual(pending);expect(h.session.dispatching).toBe(false);
  });
  it("keeps a first-dispatch immutable conflict for support without replacement",async()=>{
    const h=harness();await h.manager.refresh();
    h.mutate.mockResolvedValueOnce({data:null,error:{code:"23505"}});
    expect(await h.manager.submit(close,true,late)).toMatch(/immutable conflict/i);
    const pending=structuredClone(h.session.pending);
    expect(h.session.pendingOutcome).toBe("conflict");
    await h.manager.refresh();
    expect(await h.manager.submit({...close,why:"Replacement"},true,late)).toMatch(/blocked/i);
    expect(h.session.pending).toEqual(pending);
    expect(await h.manager.retry(true)).toMatch(/conflict/i);
    expect(h.mutate).toHaveBeenCalledTimes(1);
  });
  it("one explicit finalization dispatch with pending feedback and no optimistic result",async()=>{
    const h=harness(context,{...ready,reconciliation_confirmed:true,can_finalize:true});
    await h.manager.refresh();
    let resolve!:(v:{data:unknown;error:{code?:string}|null})=>void;
    h.mutate.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    render(<FixtureOrganizer manager={h.manager}/>);
    const form=screen.getByRole("form",{name:"Finalize event manually"});
    expect(within(form).getByRole("button",{name:"Finalize event manually"})).toBeDisabled();
    fireEvent.click(within(form).getByRole("checkbox",{name:/explicitly confirm/}));
    fireEvent.submit(form);fireEvent.submit(form);
    await waitFor(()=>expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Finalized synthetic results")).not.toBeInTheDocument();
    await act(async()=>resolve({data:null,error:{code:"40001"}}));
    expect(await screen.findByRole("form",{name:"Retry exact request"})).toBeInTheDocument();
    expect(h.mutate).toHaveBeenCalledTimes(1);
  });
});
