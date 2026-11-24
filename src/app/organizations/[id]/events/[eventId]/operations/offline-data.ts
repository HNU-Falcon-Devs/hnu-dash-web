import type { createClient } from "@/lib/supabase/server";
import { OFFLINE_PAGE_SIZE, pageNumber, parseClaim, parsePageRows, parsePreparation, parseSummary,
  type EventPolicy, type Summary, type Preparation, type Claim } from "./offline-contract";

type Client = Awaited<ReturnType<typeof createClient>>;
export type Evidence = {
  summary: Summary;
  preparations: Preparation[];
  claims: Claim[];
  preparationPage: number;
  claimPage: number;
};
export async function readOfflineSummary(client: Client, event: EventPolicy): Promise<Summary | null> {
  if (!event.offline_enabled) return null;
  const response = await client.rpc("get_event_offline_summary", { eid: event.id });
  return response.error ? null : parseSummary(response.data, event);
}

// The caller must already have freshly verified HNU identity, manager permission
// and the event's organization. Each RPC independently enforces that authority.
export async function readOfflineEvidence(client: Client, event: EventPolicy,
  preparationRequest: unknown, claimRequest: unknown): Promise<Evidence | null> {
  try {
    const summary = await readOfflineSummary(client, event);
    if (!summary) return null;
    const preparationPage = pageNumber(preparationRequest, summary.preparation_count);
    const claimPage = pageNumber(claimRequest, summary.claim_count);
    const preparationOffset = (preparationPage - 1) * OFFLINE_PAGE_SIZE;
    const claimOffset = (claimPage - 1) * OFFLINE_PAGE_SIZE;
    const [sessions, captures] = await Promise.all([
      client.rpc("get_event_offline_preparations", { eid: event.id, p_limit: OFFLINE_PAGE_SIZE, p_offset: preparationOffset }),
      client.rpc("get_event_offline_claims", { eid: event.id, p_limit: OFFLINE_PAGE_SIZE, p_offset: claimOffset }),
    ]);
    if (sessions.error || captures.error) return null;
    const preparations = parsePageRows(sessions.data, parsePreparation, row => row.preparation_id,
      row => row.issued_at, Math.min(OFFLINE_PAGE_SIZE, summary.preparation_count - preparationOffset));
    const claims = parsePageRows(captures.data, parseClaim, row => row.capture_id,
      row => row.received_at, Math.min(OFFLINE_PAGE_SIZE, summary.claim_count - claimOffset));
    if (!preparations || !claims) return null;
    // Separate reads are not atomic. Never assert readiness from local row counts.
    if (summary.unaccounted_count === 0 && preparations.some(row => row.disposition === null)) return null;
    if (summary.unreviewed_count === 0 && claims.some(row => row.decision === null)) return null;
    return { summary, preparations, claims, preparationPage, claimPage };
  } catch {
    return null;
  }
}
