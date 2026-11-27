import { beforeEach, describe, expect, it, vi } from "vitest";
import { assignMembership, prepareMembership, updateMembership } from "./actions";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type Intent, type UpdateInput } from "./membership-contract";
vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const epoch = 1800000000;
const input = { organizationId: ORG, email: "test@hnu.edu.ph", role: "staff" as const };
const intent: Intent = { ...input, requestId: REQUEST, token: ["v1","synthetic",USER,REQUEST,epoch,epoch+300,epoch+2592000,"a".repeat(64)].join("."), executeBefore: new Date((epoch+300)*1000).toISOString().replace(".000",""), replayBefore: new Date((epoch+2592000)*1000).toISOString().replace(".000","") };
const change: UpdateInput = { organizationId: ORG, userId: USER, role: "leader", active: false, revision: "9007199254740993" };
const rpc = vi.fn();
const from = vi.fn();
const envelope = (status: string, membership: unknown = null, replayed = false, retry_after_seconds: number | null = null) => ({status, membership, replayed, retry_after_seconds});
const snapshot = { organization_id: ORG, user_id: USER, role: "staff", active: true, revision: "1" };
const response = (data: unknown) => { rpc.mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data,error:null}); };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({status:"authenticated",email:"admin@hnu.edu.ph"});
  vi.mocked(createClient).mockResolvedValue({rpc,from} as unknown as Awaited<ReturnType<typeof createClient>>);
});
describe("authoritative membership actions", () => {
  it("prepares through RPC, with exact payload and no direct write", async () => {
    response({status:"intent_issued",request_id:REQUEST,intent_token:intent.token,execute_before:intent.executeBefore,replay_before:intent.replayBefore});
    expect(await prepareMembership(input)).toEqual({status:"intent_issued",intent});
    expect(rpc).toHaveBeenCalledWith("prepare_org_member_assignment",{p_organization_id:ORG,p_email:input.email,p_role:"staff"});
    expect(from).not.toHaveBeenCalled();
  });
  it("reuses immutable intent and interprets historical success", async () => {
    response(envelope("assigned",snapshot,true));
    expect(await assignMembership(intent)).toEqual({status:"assigned",replayed:true,retryAfter:null});
    expect(rpc).toHaveBeenCalledWith("assign_verified_org_member",{p_organization_id:ORG,p_email:input.email,p_role:"staff",p_request_id:REQUEST,p_intent_token:intent.token});
    expect(from).not.toHaveBeenCalled();
  });
  it.each(["account_unavailable","organization_unavailable","invalid_input","request_mismatch","request_expired","busy"] as const)("preserves generic assignment status %s",async status=>{
    response(envelope(status)); expect((await assignMembership(intent)).status).toBe(status);
  });
  it("preserves duplicate conflict and rate limiting",async()=>{
    response(envelope("already_member",snapshot));expect((await assignMembership(intent)).status).toBe("already_member");
    response(envelope("rate_limited",null,false,12));expect(await assignMembership(intent)).toEqual({status:"rate_limited",replayed:false,retryAfter:12});
  });
  it("rejects malformed successes and leaks no raw error",async()=>{
    response(envelope("assigned",null));expect(await assignMembership(intent)).toEqual({status:"unknown"});
    rpc.mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:null,error:{message:"private token"}});
    expect(await assignMembership(intent)).toEqual({status:"unknown"});
  });
  it.each(["signed-out","denied","error"] as const)("blocks %s",async status=>{
    vi.mocked(getAuthState).mockResolvedValue({status});
    expect((await prepareMembership(input)).status).toBe("unavailable");
    expect((await assignMembership(intent)).status).toBe("unknown");
    expect((await updateMembership(change)).status).toBe("unknown");
    expect(createClient).not.toHaveBeenCalled();
  });
  it("blocks nonadmin and invalid input",async()=>{
    rpc.mockResolvedValueOnce({data:false,error:null});
    expect((await prepareMembership(input)).status).toBe("unavailable");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect((await prepareMembership({...input,email:"not-hnu@example.com"})).status).toBe("invalid_input");
    expect((await updateMembership({...change,revision:"0"})).status).toBe("unknown");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("sends lossless revision and both keys, allows pure deactivation",async()=>{
    response(envelope("updated",{...snapshot,role:"leader",active:false,revision:"9007199254740994"}));
    expect((await updateMembership(change)).status).toBe("updated");
    expect(rpc).toHaveBeenCalledWith("update_org_member",{p_organization_id:ORG,p_user_id:USER,p_role:"leader",p_active:false,p_expected_revision:"9007199254740993"});
    expect(from).not.toHaveBeenCalled();
  });
  it("reports state conflict and malformed/unknown update without retry",async()=>{
    response(envelope("state_conflict",snapshot));
    expect((await updateMembership(change)).status).toBe("state_conflict");
    response(envelope("updated",snapshot));
    expect((await updateMembership(change)).status).toBe("unknown");
    expect(rpc).toHaveBeenCalledTimes(4);
  });
});
