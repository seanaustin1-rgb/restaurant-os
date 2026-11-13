// Centralized availability check for Spirit Vault pours.
//
// Toast and admin inventory systems use various labels beyond "Out of stock":
// Sold out, Unavailable, Hidden, 86'd, Inactive, etc. Rather than maintaining
// a denylist of every possible label, we allowlist the known-available states.
// A pour is available if availability is null (not tracked) or "In stock".

const AVAILABLE_LABELS = new Set(["in stock"]);

export function pourIsAvailable(availability: string | null | undefined): boolean {
  if (availability == null) return true;
  return AVAILABLE_LABELS.has(availability.toLowerCase().trim());
}
