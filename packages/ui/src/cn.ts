/**
 * Join class names, dropping anything falsy.
 *
 * Deliberately not clsx + tailwind-merge: nothing here overrides a conflicting
 * utility, so the extra dependency would buy nothing but install weight.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
