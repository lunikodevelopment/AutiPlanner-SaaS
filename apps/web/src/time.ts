/**
 * Timestamps the planner sends to the server.
 *
 * iCalendar DATE-TIME has no fractional seconds, and the domain model enforces
 * that, so `Date.prototype.toISOString()` is not directly usable: it produces
 * `2026-09-30T07:45:12.345Z`, which the profile rejects. Truncating here keeps
 * the client honest rather than relying on the server to forgive it.
 */
export function nowSeconds(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
