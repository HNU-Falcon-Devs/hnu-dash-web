'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { createEventAction } from '@/supabase/actions/event-actions';
import type { EventWithDetails } from '@/lib/definitions';
import { ACADEMIC_YEAR_LEVELS, DEFAULT_FINE_OFFICER, DEFAULT_FINE_STUDENT } from '@/lib/constants';

export interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  organizationCode: string;
  userId: string;
  onEventCreated: (event: EventWithDetails) => void;
}

export function EventFormModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  organizationCode,
  userId,
  onEventCreated,
}: EventFormModalProps) {
  // Form State
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  // Default date anchors: Next week 8:00 AM to 5:00 PM
  const [eventStart, setEventStart] = useState('2026-10-20T08:00');
  const [eventEnd, setEventEnd] = useState('2026-10-20T17:00');

  // Attendee Windows
  const [attInStart, setAttInStart] = useState('2026-10-20T07:30');
  const [attInEnd, setAttInEnd] = useState('2026-10-20T08:30');
  const [attOutStart, setAttOutStart] = useState('2026-10-20T16:30');
  const [attOutEnd, setAttOutEnd] = useState('2026-10-20T17:30');

  // Officer Windows (Early call-time & egress)
  const [offInStart, setOffInStart] = useState('2026-10-20T07:00');
  const [offInEnd, setOffInEnd] = useState('2026-10-20T07:30');
  const [offOutStart, setOffOutStart] = useState('2026-10-20T17:30');
  const [offOutEnd, setOffOutEnd] = useState('2026-10-20T18:00');

  // Fines
  const [fineStudent, setFineStudent] = useState(DEFAULT_FINE_STUDENT);
  const [fineOfficer, setFineOfficer] = useState(DEFAULT_FINE_OFFICER);

  // Audience
  const [targetYears, setTargetYears] = useState<number[]>([]);
  const [allYears, setAllYears] = useState(true);

  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleYearToggle = (year: number) => {
    setAllYears(false);
    setTargetYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors([]);

    const result = createEventAction({
      organization_id: organizationId,
      organization_name: organizationName,
      organization_code: organizationCode,
      title,
      description,
      location,
      event_start: new Date(eventStart).toISOString(),
      event_end: new Date(eventEnd).toISOString(),
      attendance_in_start: new Date(attInStart).toISOString(),
      attendance_in_end: new Date(attInEnd).toISOString(),
      attendance_out_start: new Date(attOutStart).toISOString(),
      attendance_out_end: new Date(attOutEnd).toISOString(),
      officer_in_start: new Date(offInStart).toISOString(),
      officer_in_end: new Date(offInEnd).toISOString(),
      officer_out_start: new Date(offOutStart).toISOString(),
      officer_out_end: new Date(offOutEnd).toISOString(),
      fine_per_missed_scan_student: Number(fineStudent),
      fine_per_missed_scan_officer: Number(fineOfficer),
      target_year_levels: allYears || targetYears.length === 0 ? null : targetYears,
      created_by: userId,
    });

    setIsSubmitting(false);

    if (result.success && result.event) {
      onEventCreated(result.event);
      onClose();
    } else if (result.errors) {
      setErrors(result.errors);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Organization Event"
      description={`Create and configure event parameters for ${organizationName}.`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {errors.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 space-y-1">
            <p className="font-semibold">Please fix the following validation issues:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Section 1: General Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#027013] dark:text-emerald-400">
            1. Event Information
          </h4>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. CCS Technology Congress 2026"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#027013] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Venue / Physical Location *
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. HNU Gymnasium"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#027013] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary or agenda"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#027013] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Overall Schedule */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#027013] dark:text-emerald-400">
            2. Event Commencement & Conclusion
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Event Start *
              </label>
              <input
                type="datetime-local"
                required
                value={eventStart}
                onChange={(e) => setEventStart(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Event End *
              </label>
              <input
                type="datetime-local"
                required
                value={eventEnd}
                onChange={(e) => setEventEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Student Time Windows */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#027013] dark:text-emerald-400">
            3. Attendee Check-In Windows
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Time-In Open *
              </label>
              <input
                type="datetime-local"
                required
                value={attInStart}
                onChange={(e) => setAttInStart(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Time-In Cut-off *
              </label>
              <input
                type="datetime-local"
                required
                value={attInEnd}
                onChange={(e) => setAttInEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Time-Out Open *
              </label>
              <input
                type="datetime-local"
                required
                value={attOutStart}
                onChange={(e) => setAttOutStart(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Time-Out Cut-off *
              </label>
              <input
                type="datetime-local"
                required
                value={attOutEnd}
                onChange={(e) => setAttOutEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Officer Call Times */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              4. Officer Call-Times (Early Egress & Staff Windows)
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Officer Call-Time Start *
              </label>
              <input
                type="datetime-local"
                required
                value={offInStart}
                onChange={(e) => setOffInStart(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Officer Call-Time Cut-off *
              </label>
              <input
                type="datetime-local"
                required
                value={offInEnd}
                onChange={(e) => setOffInEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Officer Egress Start *
              </label>
              <input
                type="datetime-local"
                required
                value={offOutStart}
                onChange={(e) => setOffOutStart(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Officer Egress Cut-off *
              </label>
              <input
                type="datetime-local"
                required
                value={offOutEnd}
                onChange={(e) => setOffOutEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Fines & Target Year Levels */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#027013] dark:text-emerald-400">
            5. Penalty Fines & Target Audience
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Student Fine per Missed Scan (₱)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={fineStudent}
                onChange={(e) => setFineStudent(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Officer Fine per Missed Scan (₱)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={fineOfficer}
                onChange={(e) => setFineOfficer(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Eligible Year Levels
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allYears}
                  onChange={(e) => {
                    setAllYears(e.target.checked);
                    if (e.target.checked) setTargetYears([]);
                  }}
                  className="rounded border-slate-300 text-[#027013] focus:ring-[#027013]"
                />
                <span>All Members</span>
              </label>

              {ACADEMIC_YEAR_LEVELS.map((year) => (
                <label
                  key={year}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!allYears && targetYears.includes(year)}
                    onChange={() => handleYearToggle(year)}
                    className="rounded border-slate-300 text-[#027013] focus:ring-[#027013]"
                  />
                  <span>{year}th Year</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Schedule Event
          </Button>
        </div>
      </form>
    </Modal>
  );
}
