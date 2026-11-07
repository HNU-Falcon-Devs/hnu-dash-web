"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  assignMembership,
  updateMembership,
  type MembershipActionState,
} from "./actions";

const initialState: MembershipActionState = { status: "idle", message: "" };
const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export function AssignMembershipForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(assignMembership, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} aria-label="Assign organization member" className="space-y-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <div>
        <label htmlFor="member-user-id" className="mb-1.5 block text-sm font-medium">Existing Auth user UUID</label>
        <input id="member-user-id" name="user_id" type="text" required spellCheck={false} autoComplete="off"
          pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" aria-describedby="member-uuid-help"
          className={fieldClass} />
        <p id="member-uuid-help" className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Development-stage workflow: enter an existing Auth user UUID independently verified by an authorized operator.
          A UUID alone does not prove the account is HNU-verified. There is no email lookup.
        </p>
      </div>
      <div>
        <label htmlFor="assign-role" className="mb-1.5 block text-sm font-medium">Role</label>
        <select id="assign-role" name="role" className={fieldClass} defaultValue="staff">
          <option value="staff">Staff</option>
          <option value="leader">Leader</option>
        </select>
      </div>
      {state.message && <p role={state.status === "success" ? "status" : "alert"} aria-live="polite"
        className={state.status === "success" ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-rose-700 dark:text-rose-400"}>{state.message}</p>}
      <Button type="submit" isLoading={pending}>Assign member</Button>
    </form>
  );
}

export function MembershipEditor({
  organizationId,
  userId,
  role,
  active,
}: {
  organizationId: string;
  userId: string;
  role: "leader" | "staff";
  active: boolean;
}) {
  const [state, action, pending] = useActionState(updateMembership, initialState);
  return (
    <form action={action} aria-label={`Edit membership ${userId}`} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="user_id" value={userId} />
      <div className="min-w-28 flex-1">
        <label htmlFor={`role-${userId}`} className="mb-1 block text-xs font-medium">Role</label>
        <select id={`role-${userId}`} name="role" defaultValue={role} className={fieldClass}>
          <option value="staff">Staff</option>
          <option value="leader">Leader</option>
        </select>
      </div>
      <div className="min-w-28 flex-1">
        <label htmlFor={`active-${userId}`} className="mb-1 block text-xs font-medium">Status</label>
        <select id={`active-${userId}`} name="active" defaultValue={String(active)} className={fieldClass}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <Button type="submit" size="sm" isLoading={pending}>Save changes</Button>
      {state.message && <p role={state.status === "success" ? "status" : "alert"} aria-live="polite"
        className={state.status === "success" ? "w-full text-xs text-emerald-700 dark:text-emerald-300" : "w-full text-xs text-rose-700 dark:text-rose-400"}>{state.message}</p>}
    </form>
  );
}
