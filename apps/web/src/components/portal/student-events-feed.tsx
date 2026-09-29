'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { EventWithDetails } from '@/lib/definitions';
import { formatCurrencyPHP, formatDateTime, formatTargetYearLevels, formatTimeRange } from '@/utils/formatters';

export interface StudentEventsFeedProps {
  events: EventWithDetails[];
}

export function StudentEventsFeed({ events }: StudentEventsFeedProps) {
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedEventForModal, setSelectedEventForModal] = useState<EventWithDetails | null>(null);

  // Available unique organizations
  const uniqueOrgs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    events.forEach((e) => {
      map.set(e.organization_id, e.organization);
    });
    return Array.from(map.values());
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (selectedOrgFilter === 'all') return events;
    return events.filter((e) => e.organization_id === selectedOrgFilter);
  }, [events, selectedOrgFilter]);

  // Helper to determine active scanning window state relative to now
  const getEventTimeStatus = (event: EventWithDetails) => {
    const now = new Date().getTime();
    const inStart = new Date(event.attendance_in_start).getTime();
    const inEnd = new Date(event.attendance_in_end).getTime();
    const outStart = new Date(event.attendance_out_start).getTime();
    const outEnd = new Date(event.attendance_out_end).getTime();

    if (now >= inStart && now <= inEnd) {
      return { label: 'Check-In Open Now', variant: 'success' as const };
    }
    if (now >= outStart && now <= outEnd) {
      return { label: 'Check-Out Open Now', variant: 'warning' as const };
    }
    if (now < inStart) {
      return { label: 'Upcoming', variant: 'primary' as const };
    }
    if (now > outEnd) {
      return { label: 'Concluded', variant: 'default' as const };
    }
    return { label: 'In Progress', variant: 'default' as const };
  };

  return (
    <Card className="border border-slate-200/80 shadow-xs dark:border-slate-800">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              Upcoming Events & Attendance Windows
            </CardTitle>
            <CardDescription className="text-xs">
              Official schedule for your enrolled organizations. Be aware of early call-times and cut-offs.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Organization Filter */}
            <select
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[#027013] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Organizations ({events.length})</option>
              {uniqueOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.code} — {org.name}
                </option>
              ))}
            </select>

            {/* View Toggle */}
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-2">
        {filteredEvents.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No upcoming events found for the selected filter.
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => {
              const status = getEventTimeStatus(event);
              return (
                <div
                  key={event.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:border-[#027013]/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#027013] text-xs bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60">
                        {event.organization.code}
                      </span>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                        {event.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span className="truncate">{event.location}</span>
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/50 space-y-2 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-[11px] text-slate-400">Date:</span>
                        <span className="font-medium">{formatDateTime(event.event_start).split(',')[0]}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-[11px] text-slate-400">Time-In Window:</span>
                        <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatTimeRange(event.attendance_in_start, event.attendance_in_end)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-[11px] text-slate-400">Time-Out Window:</span>
                        <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatTimeRange(event.attendance_out_start, event.attendance_out_end)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                      Fine: <strong className="text-slate-700 dark:text-slate-300">₱{event.fine_per_missed_scan_student.toFixed(2)}</strong>/scan
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedEventForModal(event)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 uppercase font-semibold text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="p-3">Org</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Venue</th>
                  <th className="p-3">Time-In Window</th>
                  <th className="p-3">Time-Out Window</th>
                  <th className="p-3">Audience</th>
                  <th className="p-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-bold text-[#027013] dark:text-emerald-400">
                      {event.organization.code}
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                      {event.title}
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">
                      {event.location}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                      {formatTimeRange(event.attendance_in_start, event.attendance_in_end)}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                      {formatTimeRange(event.attendance_out_start, event.attendance_out_end)}
                    </td>
                    <td className="p-3">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">
                        {formatTargetYearLevels(event.target_year_levels)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedEventForModal(event)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Event Details Modal */}
      {selectedEventForModal && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedEventForModal(null)}
          title={selectedEventForModal.title}
          description={`Hosted by ${selectedEventForModal.organization.name} (${selectedEventForModal.organization.code})`}
          maxWidth="md"
        >
          <div className="space-y-4 pt-1 text-xs">
            {selectedEventForModal.description && (
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
                {selectedEventForModal.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Location / Venue
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedEventForModal.location}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Target Audience
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatTargetYearLevels(selectedEventForModal.target_year_levels)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-3 space-y-2">
              <span className="font-bold text-emerald-900 dark:text-emerald-300 block uppercase text-[10px]">
                Official Student Check-In Windows
              </span>
              <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-400 block">Time-In Window:</span>
                  <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                    {formatTimeRange(selectedEventForModal.attendance_in_start, selectedEventForModal.attendance_in_end)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Time-Out Window:</span>
                  <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                    {formatTimeRange(selectedEventForModal.attendance_out_start, selectedEventForModal.attendance_out_end)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/40">
              <div>
                <span className="text-slate-500 text-[11px] block">Penalty for Missed Scan:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrencyPHP(selectedEventForModal.fine_per_missed_scan_student)} per scan
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setSelectedEventForModal(null)}>
                Got It
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
