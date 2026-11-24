import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManila } from "../../validation";
import { OfflineForm } from "./offline-forms";
import { OFFLINE_PAGE_SIZE, type EventPolicy } from "./offline-contract";
import type { Evidence } from "./offline-data";

type Query = Record<string, string | string[] | undefined>;
function href(root: string, query: Query, key?: string, page?: number): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (name === key || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(name, item);
  }
  if (key && page !== undefined) params.set(key, String(page));
  return root + "?" + params.toString();
}
function Time({ value }: { value: string | null }) {
  return value === null ? "Not recorded" : <time dateTime={value}>{formatManila(value)} (Asia/Manila)</time>;
}
function Pages({ root, query, page, total, name, pageKey }: {
  root: string; query: Query; page: number; total: number; name: string; pageKey: string;
}) {
  const last = Math.max(1, Math.min(Math.ceil(total / OFFLINE_PAGE_SIZE), Math.floor(2147483647 / OFFLINE_PAGE_SIZE) + 1));
  return <nav aria-label={name + " pagination"} className="flex flex-wrap gap-3">
    <span>Page {page} of {last}</span>
    {page > 1 && <Link className="underline" href={href(root, query, pageKey, page - 1)}>Previous {name} page</Link>}
    {page < last && <Link className="underline" href={href(root, query, pageKey, page + 1)}>Next {name} page</Link>}
    <a className="underline" href={href(root, query)}>Reload {name}</a>
  </nav>;
}
export function OfflinePanel({ event, organizationId, evidence, root, query, coverageReady }: {
  event: EventPolicy; organizationId: string; evidence: Evidence | null; root: string; query: Query; coverageReady: boolean;
}) {
  const scope = { organizationId, eventId: event.id };
  if (!event.offline_enabled) return <Card>
    <CardHeader><CardTitle>Offline attendance policy</CardTitle></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p>Online-only. Offline attendance is not enabled.</p>
      {event.state === "DRAFT" && <OfflineForm key={event.id + ":enable"} {...scope} kind="enable" />}
    </CardContent>
  </Card>;
  if (!evidence) return <Card>
    <CardHeader><CardTitle>Offline reconciliation</CardTitle></CardHeader>
    <CardContent className="space-y-2 text-sm">
      <p>Offline-enabled. Upload cutoff: <Time value={event.offline_upload_cutoff} />.</p>
      <p role="alert">Authoritative offline evidence is unavailable or changed during loading. Reconciliation and finalization are blocked. <a className="underline" href={href(root, query)}>Reload evidence</a></p>
    </CardContent>
  </Card>;
  const { summary: s, preparations, claims, preparationPage, claimPage } = evidence;
  const formScope = { ...scope, preparationPage, claimPage };
  const reviewing = event.state === "SYNCING" && s.sealed_at !== null;
  return <Card>
    <CardHeader><CardTitle>Offline reconciliation</CardTitle></CardHeader>
    <CardContent className="space-y-5 text-sm">
      <p>Offline-enabled (irreversible). Synthetic prototype only. Known preparations are not devices or proof that every capture was submitted.</p>
      <p>Upload cutoff: <Time value={s.upload_cutoff} />. Upload sealing uses Backend server time.</p>
      <p className="break-words">Sealed: <Time value={s.sealed_at} /> · Manager: {s.sealed_by ?? "Not recorded"}</p>
      <p className="break-words">Reconciliation confirmed: <Time value={s.confirmed_at} /> · Manager: {s.confirmed_by ?? "Not recorded"}</p>
      <p>Known preparations: {s.preparation_count}; completed declarations: {s.completed_count}; recorded losses: {s.loss_count}; unaccounted: {s.unaccounted_count}.</p>
      <p>Submitted claims: {s.claim_count}; reviewed: {s.reviewed_count}; unreviewed: {s.unreviewed_count}.</p>
      {s.can_seal && <OfflineForm key={event.id + ":seal"} {...formScope} kind="seal" />}
      {event.state === "SYNCING" && s.sealed_at === null && !s.can_seal && <p role="status">Upload sealing is not available until the Backend confirms the cutoff has passed.</p>}
      <section className="space-y-3" aria-label="Known offline preparations">
        <h3 className="font-semibold">Known preparations</h3>
        {preparations.length === 0 && <p>No known preparations on this page.</p>}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {preparations.map(row => <li key={row.preparation_id} className="space-y-2 py-3 break-words">
            <p className="break-all font-mono">Preparation {row.preparation_id}</p>
            <p className="break-all">Original Staff: {row.staff_user_id} · Assignment: {row.assignment_id}</p>
            <p>Issued: <Time value={row.issued_at} /> · Expires: <Time value={row.expires_at} /> · Assignment revoked: <Time value={row.revoked_at} /></p>
            <p>Actual uploaded claims: {row.uploaded_count} · Declared count: {row.declared_count ?? "Not declared"} · Disposition: {row.disposition ?? "Unaccounted"}</p>
            {row.disposition !== null && <><p>Accounted: <Time value={row.accounted_at} /> · Actor: {row.accounted_by}</p>
              {row.reason !== null && <p className="whitespace-pre-wrap">Loss reason: {row.reason}</p>}</>}
            {reviewing && row.disposition === null && <OfflineForm key={event.id + ":" + row.preparation_id} {...formScope} kind="loss" targetId={row.preparation_id} />}
          </li>)}
        </ul>
        <Pages root={root} query={query} page={preparationPage} total={s.preparation_count} name="preparations" pageKey="preparations_page" />
      </section>
      <section className="space-y-3" aria-label="Offline claims">
        <h3 className="font-semibold">Individual offline claims</h3>
        <p>Eligibility is not proof of attendance or capture time. Only individually approved eligible claims can produce canonical receipts.</p>
        {claims.length === 0 && <p>No submitted claims on this page.</p>}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {claims.map(row => <li key={row.capture_id} className="space-y-2 py-3 break-words">
            <p className="break-all font-mono">Capture {row.capture_id}</p>
            <p className="break-all">Preparation: {row.preparation_id} · Original Staff: {row.staff_user_id}</p>
            <p className="break-all">Student ID: {row.student_id} · Checkpoint: {row.checkpoint_id}</p>
            <p>Claimed time (untrusted): <Time value={row.claimed_at} /> · Original server upload: <Time value={row.received_at} /></p>
            <p>Manager review eligibility: {row.review_eligible ? "Eligible for consideration" : "Ineligible for approval"} · Decision: {row.decision ?? "Unreviewed"}</p>
            {row.decision !== null && <>
              <p className="whitespace-pre-wrap">Review reason: {row.reason}</p>
              <p>Reviewed: <Time value={row.reviewed_at} /> · Reviewer: {row.reviewed_by}</p>
              <p className="break-all">Canonical receipt: {row.receipt_id ?? "None"} · Outcome: {row.receipt_outcome ?? "None"}</p>
            </>}
            {reviewing && row.decision === null && <OfflineForm key={event.id + ":" + row.capture_id} {...formScope} kind="review" targetId={row.capture_id} eligible={row.review_eligible} />}
          </li>)}
        </ul>
        <Pages root={root} query={query} page={claimPage} total={s.claim_count} name="claims" pageKey="claims_page" />
      </section>
      {s.can_confirm && <OfflineForm key={event.id + ":confirm"} {...formScope} kind="confirm" />}
      {event.state === "SYNCING" && <section className="space-y-2">
        <h3 className="font-semibold">Finalize prototype attendance</h3>
        {s.can_finalize && coverageReady ? <OfflineForm key={event.id + ":offline-finalize"} {...formScope} kind="finalize" />
          : <p role="status">Finalization requires authoritative reconciliation readiness and current provisional coverage. Reload evidence before continuing.</p>}
      </section>}
      {event.state === "FINALIZED" && <p>Finalized reconciliation history is read-only.</p>}
      <p className="text-xs">Pages are read separately, not one atomic snapshot. Reload to obtain current Backend evidence.</p>
    </CardContent>
  </Card>;
}
