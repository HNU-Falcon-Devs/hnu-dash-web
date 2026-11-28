// No "use server" directive or exported Server Action. Only an explicitly
// authorized test harness may bind this module to trusted fixture context.
import { createClient } from "@/lib/supabase/server";
import { validContext, type FixtureContext } from "./contract";
import type { Transport } from "./manager";

const names=new Set([
  "get_event_offline_summary_v2","get_event_offline_preparations_v2","get_event_offline_claims_v2",
  "get_event_checkpoint_coverage_v2","get_event_finalized_results_v2",
  "close_event_v2","extend_event_sync_deadline_v2","seal_offline_uploads_v2",
  "account_offline_preparation_loss_v2","review_offline_capture_v2",
  "confirm_offline_reconciliation_v2","finalize_event_v2"
]);

export function bindFixtureTransport(fixture:FixtureContext):Transport {
  const c=structuredClone(fixture);
  async function scopedClient() {
    if(!validContext(c)) return null;
    const client=await createClient();
    const identity=await client.auth.getUser();
    if(identity.error||identity.data.user?.id!==c.actor_id) return null;
    const verified=await client.rpc("hnu_verified_user");
    if(verified.error||verified.data!==true) return null;
    const scope=await client.rpc("can_manage_org",{org_id:c.organization_id});
    if(scope.error||scope.data!==true) return null;
    return client;
  }
  return {
    async verify(context) {
      return context.policy_version===2&&context.event_id===c.event_id&&
        context.organization_id===c.organization_id&&context.actor_id===c.actor_id&&
        Boolean(await scopedClient());
    },
    async rpc(name,args) {
      if(!names.has(name)||args.p_event_id!==c.event_id) return {data:null,error:{code:"42501"}};
      const client=await scopedClient();
      if(!client) return {data:null,error:{code:"42501"}};
      // No fixture lookup, service key, privileged identity, or v1 fallback.
      // Backend independently binds the event to current live manager scope.
      const result=await client.rpc(name,args);
      return {data:result.data,error:result.error?{code:result.error.code}:null};
    }
  };
}
