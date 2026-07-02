import { describe, it, expect } from "vitest";
import { orderByNeedsAttention, type CockpitHealth } from "./needs-attention";

type Row = { id: string; health: CockpitHealth; value: number };

const rows: Row[] = [
  { id: "g1", health: "green", value: 100 },
  { id: "y1", health: "yellow", value: 50 },
  { id: "r1", health: "red", value: 10 },
  { id: "r2", health: "red", value: 80 },
  { id: "y2", health: "yellow", value: 20 },
];

const byHealth = (r: Row) => r.health;
const desc = (a: Row, b: Row) => b.value - a.value;
const asc = (a: Row, b: Row) => a.value - b.value;

describe("orderByNeedsAttention", () => {
  it("drops green items", () => {
    const result = orderByNeedsAttention(rows, byHealth, desc);
    expect(result.map((r) => r.id)).not.toContain("g1");
  });

  it("floats red above yellow, then applies a descending tiebreak", () => {
    // reds first (r2=80 before r1=10), then yellows (y1=50 before y2=20).
    expect(orderByNeedsAttention(rows, byHealth, desc).map((r) => r.id)).toEqual(["r2", "r1", "y1", "y2"]);
  });

  it("respects an ascending tiebreak within each severity band", () => {
    // reds first (r1=10 before r2=80), then yellows (y2=20 before y1=50).
    expect(orderByNeedsAttention(rows, byHealth, asc).map((r) => r.id)).toEqual(["r1", "r2", "y2", "y1"]);
  });

  it("does not mutate the input array", () => {
    const input = [...rows];
    const before = input.map((r) => r.id);
    orderByNeedsAttention(input, byHealth, desc);
    expect(input.map((r) => r.id)).toEqual(before);
  });

  it("returns empty when everything is green", () => {
    expect(orderByNeedsAttention([{ id: "a", health: "green", value: 1 }], byHealth, desc)).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(orderByNeedsAttention<Row>([], byHealth, desc)).toEqual([]);
  });
});
