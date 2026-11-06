"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { createOrganization, type CreateOrganizationState } from "./actions";

const initialState: CreateOrganizationState = { status: "idle", message: "" };

export function OrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4" aria-label="Create organization">
      <div>
        <label htmlFor="organization-name" className="mb-1.5 block text-sm font-medium">Name</label>
        <input id="organization-name" name="name" type="text" required minLength={2} maxLength={160}
          aria-invalid={Boolean(state.fieldErrors?.name)} aria-describedby={state.fieldErrors?.name ? "organization-name-error" : undefined}
          placeholder="e.g. College of Engineering and Computer Studies"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
        {state.fieldErrors?.name && <p id="organization-name-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">{state.fieldErrors.name}</p>}
      </div>
      <div>
        <label htmlFor="organization-slug" className="mb-1.5 block text-sm font-medium">Slug</label>
        <input id="organization-slug" name="slug" type="text" required minLength={2} maxLength={64}
          pattern="[a-z0-9-]{2,64}" title="2–64 lowercase letters, numbers, or hyphens"
          aria-invalid={Boolean(state.fieldErrors?.slug)} aria-describedby={state.fieldErrors?.slug ? "organization-slug-error" : "organization-slug-help"}
          placeholder="e.g. coecs" autoCapitalize="none" spellCheck={false}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
        <p id="organization-slug-help" className="mt-1 text-xs text-slate-500 dark:text-slate-400">Unique identifier: lowercase letters, numbers, and hyphens only.</p>
        {state.fieldErrors?.slug && <p id="organization-slug-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">{state.fieldErrors.slug}</p>}
      </div>
      {state.message && <p role={state.status === "success" ? "status" : "alert"} aria-live="polite"
        className={state.status === "success" ? "rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"}>
        {state.message}
      </p>}
      <Button type="submit" isLoading={pending} disabled={pending}>Create organization</Button>
    </form>
  );
}
