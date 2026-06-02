// Display formatters for dashboard metrics.

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const int0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function money(n: number): string {
  return usd0.format(n);
}

export function money2(n: number): string {
  return usd2.format(n);
}

export function count(n: number): string {
  return int0.format(n);
}

export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}
