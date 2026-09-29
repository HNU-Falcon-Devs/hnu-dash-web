'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EventWithDetails, Profile } from '@/lib/definitions';
import {
  getAssignedScannersForEvent,
  getEligibleOfficersForOrg,
} from '@/supabase/data/events';
import { toggleScannerDutyAction } from '@/supabase/actions/event-actions';

export interface ScannerAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventWithDetails | null;
  onAssignmentChange?: () => void;
}

export function ScannerAssignmentModal({
  isOpen,
  onClose,
  event,
  onAssignmentChange,
}: ScannerAssignmentModalProps) {
  const eligibleOfficers: Profile[] = event
    ? getEligibleOfficersForOrg(event.organization.code)
    : [];

  const [assignedScannerIds, setAssignedScannerIds] = useState<string[]>(() =>
    event ? getAssignedScannersForEvent(event.id) : []
  );

  if (!event || !isOpen) return null;

  const handleToggle = (userId: string, isCurrentlyAssigned: boolean) => {
    const result = toggleScannerDutyAction(event.id, userId, !isCurrentlyAssigned);
    if (result.success) {
      setAssignedScannerIds(result.assignedScanners);
      if (onAssignmentChange) onAssignmentChange();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Officer Scanner Delegation"
      description={`Assign and authorize officers to operate attendance scanners for: ${event.title}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Policy Notice Callout */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-center gap-2 font-semibold">
            <svg
              className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <span>Strict Scanner Delegation Policy (event_assigned_scanners)</span>
          </div>
          <p className="mt-1 leading-relaxed">
            Per system security rules, being an organization officer does not automatically grant scanning permissions. Only officers explicitly toggled to &quot;Delegated Scanner&quot; below can log attendance for this event.
          </p>
        </div>

        {/* Officers List */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
          {eligibleOfficers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No eligible officers registered for {event.organization.name}.
            </div>
          ) : (
            eligibleOfficers.map((officer) => {
              const isAssigned = assignedScannerIds.includes(officer.id);
              return (
                <div
                  key={officer.id}
                  className="flex items-center justify-between p-4 gap-3 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 dark:bg-slate-800 dark:text-slate-200">
                      {officer.first_name[0]}
                      {officer.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {officer.first_name} {officer.last_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {officer.student_id} • {officer.course} (Year {officer.year_level})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isAssigned ? (
                      <Badge variant="success" dot>
                        Delegated Scanner
                      </Badge>
                    ) : (
                      <Badge variant="default">
                        Not Assigned
                      </Badge>
                    )}

                    <Button
                      size="sm"
                      variant={isAssigned ? 'danger' : 'primary'}
                      onClick={() => handleToggle(officer.id, isAssigned)}
                    >
                      {isAssigned ? 'Revoke Duty' : 'Assign Scanner'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {assignedScannerIds.length} active scanner officer(s) assigned
          </span>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
