const UNAVAILABLE_AVAILABILITY_PATTERNS = [
  /\bout\s+of\s+stock\b/,
  /\bsold\s+out\b/,
  /\bunavailable\b/,
  /\bnot\s+available\b/,
  /\binactive\b/,
  /\bdiscontinued\b/,
  /\bdisabled\b/,
  /\bhidden\b/,
  /\b86(?:'d|ed)?\b/,
];

export function isFlightPourUnavailable(availability: string | null | undefined): boolean {
  const value = availability?.trim().toLowerCase();
  if (!value) return false;
  return UNAVAILABLE_AVAILABILITY_PATTERNS.some((pattern) => pattern.test(value));
}

export function pourIsAvailable(availability: string | null | undefined): boolean {
  return !isFlightPourUnavailable(availability);
}
