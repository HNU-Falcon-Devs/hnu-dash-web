import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssignMembershipForm, MembershipEditor } from "./membership-forms";
import { assignMembership, prepareMembership, updateMembership } from "./actions";
import { type Intent } from "./membership-contract";

vi.mock("./actions", () => ({ assignMembership: vi.fn(), prepareMembership: vi.fn(), updateMembership: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const org = "11111111-1111-4111-8111-111111111111";
const user = "22222222-2222-4222-8222-222222222222";
const intent: Intent = { organizationId:org,email:"test@hnu.edu.ph",role:"staff",requestId:user,token:"test-only",executeBefore:"2099-01-01T00:00:00Z",replayBefore:"2099-01-30T00:00:00Z" };
const click = (name: string) => fireEvent.click(screen.getByRole("button",{name}));
function review() {
  render(<AssignMembershipForm organizationId={org} organizationName="Synthetic Organization" />);
  fireEvent.change(screen.getByLabelText("HNU email address"),{target:{value:" TEST@hnu.edu.ph "}});
  click("Review assignment");
}
function confirm() {
  fireEvent.click(screen.getByRole("checkbox"));
  click("Confirm assignment");
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prepareMembership).mockResolvedValue({status:"intent_issued",intent});
});
describe("membership confirmation and recovery",()=>{
  it("requires reviewed details and deliberate confirmation before minting",async()=>{
    review();
    expect(prepareMembership).not.toHaveBeenCalled();
    expect(screen.getByText(/Assign test@hnu.edu.ph as staff in Synthetic Organization/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Confirm assignment"})).toBeDisabled();
    vi.mocked(assignMembership).mockResolvedValue({status:"assigned",replayed:false,retryAfter:null});
    confirm();
    await screen.findByText("Backend confirmed the membership assignment.");
    expect(prepareMembership).toHaveBeenCalledWith({organizationId:org,email:"test@hnu.edu.ph",role:"staff"});
    expect(assignMembership).toHaveBeenCalledOnce();
  });
  it("retains exact intent on unknown response and replays without minting",async()=>{
    vi.mocked(assignMembership).mockRejectedValueOnce(new Error("transport")).mockResolvedValueOnce({status:"assigned",replayed:true,retryAfter:null});
    review();confirm();
    await screen.findByText(/Assignment outcome unknown/);
    expect(screen.getByLabelText("HNU email address")).toBeDisabled();
    click("Retry exact intent");
    await screen.findByText(/Historical receipt only/);
    expect(prepareMembership).toHaveBeenCalledOnce();
    expect(assignMembership).toHaveBeenNthCalledWith(1,intent);
    expect(assignMembership).toHaveBeenNthCalledWith(2,intent);
  });
  it("rate limit retains intent; busy requires new deliberate review",async()=>{
    vi.mocked(assignMembership).mockResolvedValueOnce({status:"rate_limited",replayed:false,retryAfter:1}).mockResolvedValueOnce({status:"busy",replayed:false,retryAfter:null});
    review();confirm();
    await screen.findByText(/Rate limited/);
    click("Retry exact intent");
    await screen.findByText(/Membership management is busy/);
    expect(screen.queryByRole("button",{name:"Retry exact intent"})).not.toBeInTheDocument();
    expect(prepareMembership).toHaveBeenCalledOnce();
  });
  it("requires reconciliation before abandoning an expired intent",async()=>{
    vi.mocked(assignMembership).mockResolvedValue({status:"request_expired",replayed:false,retryAfter:null});
    review();confirm();
    await screen.findByRole("button",{name:"Start a new review"});
    expect(screen.getByRole("button",{name:"Start a new review"})).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    click("Start a new review");
    expect(screen.getByRole("button",{name:"Review assignment"})).toBeEnabled();
    expect(prepareMembership).toHaveBeenCalledOnce();
  });
  it("requires revision confirmation and never auto-retries stale update",async()=>{
    vi.mocked(updateMembership).mockResolvedValue({status:"state_conflict",replayed:false,retryAfter:null});
    render(<MembershipEditor organizationId={org} userId={user} role="staff" active revision="9007199254740993" />);
    const form=screen.getByRole("form",{name:"Edit membership "+user});
    fireEvent.change(within(form).getByLabelText("Status"),{target:{value:"false"}});
    click("Review changes");
    expect(updateMembership).not.toHaveBeenCalled();
    expect(screen.getByText(/revision 9007199254740993/)).toBeInTheDocument();
    click("Confirm changes");
    await screen.findByText(/Membership changed since/);
    await waitFor(()=>expect(updateMembership).toHaveBeenCalledOnce());
    expect(updateMembership).toHaveBeenCalledWith({organizationId:org,userId:user,role:"staff",active:false,revision:"9007199254740993"});
    expect(screen.getByRole("button",{name:"Review changes"})).toBeDisabled();
  });
});
