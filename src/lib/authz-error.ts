/**
 * Detects a forbidden/unauthorized error thrown by server functions
 * (e.g. assertAdmin → "Forbidden: admin role required" / "Forbidden: authentication required").
 * Safe to call on any value — returns false for non-Error inputs.
 */
export function isForbiddenError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("forbidden") ||
    lower.includes("admin role required") ||
    lower.includes("unauthorized")
  );
}
