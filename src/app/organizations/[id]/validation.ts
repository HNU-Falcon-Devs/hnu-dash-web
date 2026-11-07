/** Canonical UUID text only; authorization is always enforced by the Backend. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isMembershipRole(value: unknown): value is "leader" | "staff" {
  return value === "leader" || value === "staff";
}
