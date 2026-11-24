import { isUuid } from "../../validation";

export const OFFLINE_PAGE_SIZE = 200;
export const LOSS_TYPES = ["missing", "lost", "revoked", "undrained"] as const;
export const DECISIONS = ["approve", "reject"] as const;
export type Loss = typeof LOSS_TYPES[number];
export type Decision = typeof DECISIONS[number];
export type EventPolicy = {
  id: string;
  state: string;
  offline_enabled: boolean;
  offline_upload_cutoff: string | null;
};
export type Summary = {
  event_id: string; event_state: string; upload_cutoff: string | null;
  sealed_at: string | null; sealed_by: string | null;
  confirmed_at: string | null; confirmed_by: string | null;
  preparation_count: number; completed_count: number; loss_count: number;
  unaccounted_count: number; claim_count: number; reviewed_count: number;
  unreviewed_count: number; can_seal: boolean | null; can_confirm: boolean; can_finalize: boolean;
};
export type Preparation = {
  preparation_id: string; assignment_id: string; staff_user_id: string;
  issued_at: string; expires_at: string; revoked_at: string | null;
  uploaded_count: number; disposition: Loss | "completed" | null;
  declared_count: number | null; reason: string | null; accounted_at: string | null; accounted_by: string | null;
};
export type Claim = {
  capture_id: string; preparation_id: string; checkpoint_id: string; student_id: string;
  staff_user_id: string; claimed_at: string; received_at: string; review_eligible: boolean;
  decision: Decision | null; reason: string | null; receipt_id: string | null;
  receipt_outcome: "accepted" | "duplicate" | null; reviewed_at: string | null; reviewed_by: string | null;
};

export function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function timestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year > 0 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day && hour < 24 && minute < 60 && second < 60;
}
export function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
export function reason(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && [...value].length <= 500;
}
export function loss(value: unknown): value is Loss {
  return LOSS_TYPES.some(item => item === value);
}
export function decision(value: unknown): value is Decision {
  return DECISIONS.some(item => item === value);
}
function audit(at: unknown, by: unknown): boolean {
  return (at === null && by === null) || (timestamp(at) && isUuid(by));
}
function sameTime(a: string | null, b: string | null): boolean {
  return a === null || b === null ? a === b : Date.parse(a) === Date.parse(b);
}
export function validPolicy(value: unknown): value is EventPolicy {
  const row = object(value);
  if (!row || !isUuid(row.id) || typeof row.state !== "string" || typeof row.offline_enabled !== "boolean") return false;
  if (!row.offline_enabled) return row.offline_upload_cutoff === null;
  return row.state === "DRAFT" ? row.offline_upload_cutoff === null
    : ["OPEN", "SYNCING", "FINALIZED"].includes(row.state) && timestamp(row.offline_upload_cutoff);
}
export function parseSummary(value: unknown, event: EventPolicy): Summary | null {
  const row = object(value);
  if (!row || !event.offline_enabled || row.event_id !== event.id || row.event_state !== event.state
    || !(row.upload_cutoff === null || timestamp(row.upload_cutoff))
    || !sameTime(row.upload_cutoff, event.offline_upload_cutoff)
    || !audit(row.sealed_at, row.sealed_by) || !audit(row.confirmed_at, row.confirmed_by)
    || !count(row.preparation_count) || !count(row.completed_count) || !count(row.loss_count)
    || !count(row.unaccounted_count) || !count(row.claim_count) || !count(row.reviewed_count)
    || !count(row.unreviewed_count)
    || row.completed_count > row.preparation_count
    || row.loss_count > row.preparation_count - row.completed_count
    || row.unaccounted_count !== row.preparation_count - row.completed_count - row.loss_count
    || row.reviewed_count > row.claim_count || row.unreviewed_count !== row.claim_count - row.reviewed_count
    || !(typeof row.can_seal === "boolean" || (row.can_seal === null && row.upload_cutoff === null))
    || typeof row.can_confirm !== "boolean" || typeof row.can_finalize !== "boolean") return null;
  const ready = row.sealed_at !== null && row.unaccounted_count === 0 && row.unreviewed_count === 0;
  if ((row.can_seal && (event.state !== "SYNCING" || row.sealed_at !== null || row.upload_cutoff === null))
    || (row.confirmed_at !== null && !ready)
    || (row.can_confirm && (event.state !== "SYNCING" || !ready || row.confirmed_at !== null))
    || (row.can_finalize && (event.state !== "SYNCING" || !ready || row.confirmed_at === null))
    || (event.state === "FINALIZED" && (!ready || row.confirmed_at === null))
    || (["DRAFT", "OPEN"].includes(event.state) && row.sealed_at !== null)) return null;
  return row as Summary;
}
function lossFields(row: Record<string, unknown>): boolean {
  return loss(row.disposition) && count(row.uploaded_count) && row.declared_count === null
    && reason(row.reason) && timestamp(row.accounted_at) && isUuid(row.accounted_by);
}
function reviewFields(row: Record<string, unknown>): boolean {
  return decision(row.decision) && reason(row.reason) && timestamp(row.reviewed_at) && isUuid(row.reviewed_by)
    && (row.decision === "reject" ? row.receipt_id === null && row.receipt_outcome === null
      : isUuid(row.receipt_id) && (row.receipt_outcome === "accepted" || row.receipt_outcome === "duplicate"));
}
export function parsePreparation(value: unknown): Preparation | null {
  const row = object(value);
  if (!row || !isUuid(row.preparation_id) || !isUuid(row.assignment_id) || !isUuid(row.staff_user_id)
    || !timestamp(row.issued_at) || !timestamp(row.expires_at) || Date.parse(row.issued_at) >= Date.parse(row.expires_at)
    || !(row.revoked_at === null || timestamp(row.revoked_at)) || !count(row.uploaded_count)) return null;
  const valid = row.disposition === null
    ? row.declared_count === null && row.reason === null && row.accounted_at === null && row.accounted_by === null
    : row.disposition === "completed"
      ? count(row.declared_count) && row.declared_count === row.uploaded_count && row.reason === null
        && timestamp(row.accounted_at) && isUuid(row.accounted_by)
      : lossFields(row);
  return valid ? row as Preparation : null;
}
export function parseClaim(value: unknown): Claim | null {
  const row = object(value);
  if (!row || !isUuid(row.capture_id) || !isUuid(row.preparation_id) || !isUuid(row.checkpoint_id)
    || !isUuid(row.staff_user_id) || typeof row.student_id !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(row.student_id)
    || !timestamp(row.claimed_at) || !timestamp(row.received_at) || typeof row.review_eligible !== "boolean") return null;
  const valid = row.decision === null
    ? row.reason === null && row.receipt_id === null && row.receipt_outcome === null && row.reviewed_at === null && row.reviewed_by === null
    : reviewFields(row) && (row.decision !== "approve" || row.review_eligible);
  return valid ? row as Claim : null;
}
export function pageNumber(value: unknown, total: number): number {
  const page = typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : 1;
  const max = Math.max(1, Math.min(Math.ceil(total / OFFLINE_PAGE_SIZE), Math.floor(2147483647 / OFFLINE_PAGE_SIZE) + 1));
  return Number.isSafeInteger(page) ? Math.min(page, max) : 1;
}
export function parsePageRows<T>(value: unknown, parse: (v: unknown) => T | null,
  id: (row: T) => string, time: (row: T) => string, expected: number): T[] | null {
  if (!Array.isArray(value) || value.length !== expected || expected > OFFLINE_PAGE_SIZE) return null;
  const rows: T[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const row = parse(item);
    if (!row || seen.has(id(row))) return null;
    const previous = rows.at(-1);
    if (previous && (Date.parse(time(previous)) > Date.parse(time(row))
      || (time(previous) === time(row) && id(previous) > id(row)))) return null;
    seen.add(id(row));
    rows.push(row);
  }
  return rows;
}
export type OfflineKind = "enable" | "seal" | "loss" | "review" | "confirm";
export function validAcknowledgement(kind: OfflineKind, value: unknown, eventId: string,
  target: string | null, choice: unknown, exactReason: unknown): boolean {
  if (kind === "enable") return value === true;
  const row = object(value);
  if (!row || typeof row.replayed !== "boolean") return false;
  if (kind === "seal") return row.event_id === eventId && timestamp(row.sealed_at) && isUuid(row.sealed_by);
  if (kind === "confirm") return row.event_id === eventId && timestamp(row.confirmed_at) && isUuid(row.confirmed_by);
  if (kind === "loss") return row.preparation_id === target && row.disposition === choice && row.reason === exactReason && lossFields(row);
  return row.capture_id === target && row.decision === choice && row.reason === exactReason && reviewFields(row);
}
