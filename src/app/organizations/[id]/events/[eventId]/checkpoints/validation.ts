import { manilaLocalToOffset } from "../../validation";

export type EventWindow = { starts_at: string; ends_at: string };

export type CheckpointInput = {
  label: string;
  direction: "IN" | "OUT";
  opens_at: string;
  closes_at: string;
  sort_order: number;
};

/** Validate UX input against the event's authoritative, RLS-visible schedule. */
export function validateCheckpoint(form: FormData, event: EventWindow):
  | { input: CheckpointInput; message?: never }
  | { input?: never; message: string } {
  const rawLabel = form.get("label");
  const label = typeof rawLabel === "string" ? rawLabel.trim() : "";
  if (label.length < 2 || label.length > 80) {
    return { message: "Checkpoint label must be between 2 and 80 characters." };
  }

  const direction = form.get("direction");
  if (direction !== "IN" && direction !== "OUT") {
    return { message: "Choose either IN or OUT as the checkpoint direction." };
  }

  const sortRaw = form.get("sort_order");
  if (typeof sortRaw !== "string" || !/^-?\d{1,10}$/.test(sortRaw)) {
    return { message: "Sort order must be a whole number." };
  }
  const sortOrder = Number(sortRaw);
  if (!Number.isInteger(sortOrder) || sortOrder < -2147483648 || sortOrder > 2147483647) {
    return { message: "Sort order must fit a 32-bit signed integer." };
  }

  const opensAt = manilaLocalToOffset(form.get("opens_at"));
  const closesAt = manilaLocalToOffset(form.get("closes_at"));
  if (!opensAt || !closesAt) {
    return { message: "Enter valid opening and closing times in Philippine time." };
  }
  const start = Date.parse(event.starts_at);
  const end = Date.parse(event.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { message: "Could not verify the parent event schedule." };
  }
  if (Date.parse(opensAt) >= Date.parse(closesAt)) {
    return { message: "Closing time must be later than opening time." };
  }
  if (Date.parse(opensAt) < start || Date.parse(closesAt) > end) {
    return { message: "The checkpoint window must stay within the event schedule." };
  }

  return { input: {
    label,
    direction,
    opens_at: opensAt,
    closes_at: closesAt,
    sort_order: sortOrder,
  } };
}
