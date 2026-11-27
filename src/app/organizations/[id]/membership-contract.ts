import { isMembershipRole, isUuid } from "./validation";

export type Role = "staff" | "leader";
export type AssignmentInput = { organizationId: string; email: string; role: Role };
export type Intent = AssignmentInput & { requestId: string; token: string; executeBefore: string; replayBefore: string };
export type UpdateInput = { organizationId: string; userId: string; role: Role; active: boolean; revision: string };
export type MembershipSnapshot = { organization_id: string; user_id: string; role: Role; active: boolean; revision: string };
export type PrepareResult = { status: "intent_issued"; intent: Intent } | { status: "invalid_input" | "busy" | "unavailable" };
export type AssignmentStatus = "assigned" | "already_member" | "account_unavailable" | "organization_unavailable" | "invalid_input" | "request_mismatch" | "request_expired" | "rate_limited" | "busy";
export type UpdateStatus = "updated" | "unchanged" | "state_conflict" | "membership_unavailable" | "account_unavailable" | "organization_unavailable" | "invalid_input" | "rate_limited" | "busy";
export type Outcome<S extends string> = { status: S; replayed: boolean; retryAfter: number | null } | { status: "unknown" };

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export function isRevision(v: unknown): v is string {
  return typeof v === "string" && /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n;
}
export function normalizedEmail(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 1024) return null;
  const n = v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "").replace(/[A-Z]/g, c => c.toLowerCase());
  const at = n.indexOf("@");
  const local = n.slice(0, at);
  if (at < 1 || local.length > 64 || n.length > 254 || n.slice(at) !== "@hnu.edu.ph") return null;
  return /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local) ? n : null;
}
export function validAssignment(v: unknown): v is AssignmentInput {
  return record(v) && isUuid(v.organizationId) && normalizedEmail(v.email) !== null && isMembershipRole(v.role);
}
const deadline = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v) && Number.isFinite(Date.parse(v));
const tokenShape = (v: unknown): v is string => typeof v === "string" && v.length <= 512 && /^v1\.[A-Za-z0-9_-]{1,64}\.[0-9a-f-]{36}\.[0-9a-f-]{36}\.\d{1,12}\.\d{1,12}\.\d{1,12}\.[0-9a-f]{64}$/.test(v);
export function validIntent(v: unknown): v is Intent {
  if (!record(v) || !validAssignment(v) || !isUuid(v.requestId) || !tokenShape(v.token) || !deadline(v.executeBefore) || !deadline(v.replayBefore)) return false;
  const fields = v.token.split(".");
  return isUuid(fields[2]) && fields[3] === v.requestId &&
    Number(fields[5]) === Number(fields[4]) + 300 && Number(fields[6]) === Number(fields[4]) + 2592000 &&
    Date.parse(v.executeBefore) === Number(fields[5]) * 1000 && Date.parse(v.replayBefore) === Number(fields[6]) * 1000;
}
export function parsePreparation(v: unknown, input: AssignmentInput): PrepareResult {
  if (!record(v) || !exact(v, ["status", "request_id", "intent_token", "execute_before", "replay_before"])) return { status: "unavailable" };
  if (v.status === "busy" || v.status === "invalid_input") {
    return [v.request_id, v.intent_token, v.execute_before, v.replay_before].every(x => x === null) ? { status: v.status } : { status: "unavailable" };
  }
  const intent = { ...input, requestId: v.request_id, token: v.intent_token, executeBefore: v.execute_before, replayBefore: v.replay_before };
  return v.status === "intent_issued" && validIntent(intent) ? { status: "intent_issued", intent } : { status: "unavailable" };
}
export function validUpdate(v: unknown): v is UpdateInput {
  return record(v) && isUuid(v.organizationId) && isUuid(v.userId) && isMembershipRole(v.role) && typeof v.active === "boolean" && isRevision(v.revision);
}
const assignmentStatuses = ["assigned", "already_member", "account_unavailable", "organization_unavailable", "invalid_input", "request_mismatch", "request_expired", "rate_limited", "busy"] as const;
const updateStatuses = ["updated", "unchanged", "state_conflict", "membership_unavailable", "account_unavailable", "organization_unavailable", "invalid_input", "rate_limited", "busy"] as const;
function snapshot(v: unknown): v is MembershipSnapshot {
  return record(v) && exact(v, ["organization_id", "user_id", "role", "active", "revision"]) && isUuid(v.organization_id) && isUuid(v.user_id) && isMembershipRole(v.role) && typeof v.active === "boolean" && isRevision(v.revision);
}
function parseOutcome<S extends string>(v: unknown, statuses: readonly S[], org: string, update?: UpdateInput): Outcome<S> {
  if (!record(v) || !exact(v, ["status", "membership", "replayed", "retry_after_seconds"]) ||
      typeof v.status !== "string" || !statuses.includes(v.status as S) || typeof v.replayed !== "boolean") return { status: "unknown" };
  const s = v.status;
  if (v.replayed && (update || !["assigned", "already_member", "account_unavailable", "organization_unavailable", "busy"].includes(s))) return { status: "unknown" };
  if (["assigned", "already_member", "updated", "unchanged", "state_conflict"].includes(s)) {
    if (!snapshot(v.membership) || v.membership.organization_id.toLowerCase() !== org.toLowerCase() ||
        (update && v.membership.user_id.toLowerCase() !== update.userId.toLowerCase())) return { status: "unknown" };
    if (update && s !== "state_conflict" && (v.membership.role !== update.role || v.membership.active !== update.active ||
        BigInt(v.membership.revision) !== BigInt(update.revision) + (s === "updated" ? 1n : 0n))) return { status: "unknown" };
  } else if (v.membership !== null) return { status: "unknown" };
  if (s === "rate_limited") {
    if (typeof v.retry_after_seconds !== "number" || !Number.isSafeInteger(v.retry_after_seconds) || v.retry_after_seconds <= 0) return { status: "unknown" };
  } else if (v.retry_after_seconds !== null) return { status: "unknown" };
  return { status: s as S, replayed: v.replayed, retryAfter: v.retry_after_seconds as number | null };
}
export function assignmentOutcome(v: unknown, intent: Intent): Outcome<AssignmentStatus> {
  const result = parseOutcome(v, assignmentStatuses, intent.organizationId);
  if (result.status === "assigned" && record(v) && snapshot(v.membership) &&
      (v.membership.role !== intent.role || !v.membership.active || v.membership.revision !== "1")) return { status: "unknown" };
  return result;
}
export function updateOutcome(v: unknown, input: UpdateInput): Outcome<UpdateStatus> {
  return parseOutcome(v, updateStatuses, input.organizationId, input);
}
