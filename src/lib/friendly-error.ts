export function friendlySaveError(e: unknown, what = "item"): string {
  const msg = String((e as { message?: string })?.message ?? "");
  if (/forbidden|unauthorized/i.test(msg)) return `You don't have permission to save this ${what}.`;
  if (/foreign key|violates|constraint/i.test(msg))
    return `We couldn't save this ${what} because your account profile is incomplete. Please refresh and try again, or contact BRQ+ support.`;
  if (/duplicate|unique/i.test(msg)) return `A similar ${what} already exists. Please change the title or slug.`;
  return `We couldn't save this ${what}. Please try again.`;
}
