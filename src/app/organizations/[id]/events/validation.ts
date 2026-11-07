import { isUuid } from "../validation";

export { isUuid };

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const manilaDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A datetime-local input has no timezone. Interpret it as Philippine time, never browser/server local time. */
export function manilaLocalToOffset(value: unknown): string | null {
  if (typeof value !== "string" || !manilaDateTimePattern.test(value)) return null;
  const timestamp = Date.parse(`${value}:00+08:00`);
  if (!Number.isFinite(timestamp)) return null;
  const roundTrip = new Date(timestamp + MANILA_OFFSET_MS).toISOString().slice(0, 16);
  return roundTrip === value ? `${value}:00+08:00` : null;
}

export function asManilaInput(iso: string): string {
  return new Date(Date.parse(iso) + MANILA_OFFSET_MS).toISOString().slice(0, 16);
}

export function formatManila(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

export type DraftEventInput = {
  title: string;
  startsAt: string;
  endsAt: string;
  yearLevels: number[];
};

export function validateDraftEvent(formData: FormData):
  | { input: DraftEventInput; message?: never }
  | { input?: never; message: string } {
  const titleRaw = formData.get("title");
  const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
  if (title.length < 2 || title.length > 160) {
    return { message: "Event title must be between 2 and 160 characters." };
  }

  const startsAt = manilaLocalToOffset(formData.get("starts_at"));
  const endsAt = manilaLocalToOffset(formData.get("ends_at"));
  if (!startsAt || !endsAt) return { message: "Enter valid start and end times in Philippine time." };
  if (Date.parse(startsAt) >= Date.parse(endsAt)) {
    return { message: "The end time must be after the start time." };
  }

  const rawLevels = formData.getAll("year_levels");
  if (rawLevels.length < 1 || rawLevels.length > 6 ||
      rawLevels.some(level => typeof level !== "string" || !/^[1-6]$/.test(level)) ||
      new Set(rawLevels).size !== rawLevels.length) {
    return { message: "Choose one or more distinct target year levels from 1 to 6." };
  }

  const yearLevels = rawLevels.map(level => Number(level)).sort((a, b) => a - b);
  return { input: { title, startsAt, endsAt, yearLevels } };
}
