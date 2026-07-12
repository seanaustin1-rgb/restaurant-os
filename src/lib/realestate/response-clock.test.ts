import { describe, it, expect } from "vitest";
import {
  computeResponseSeconds,
  deriveResponseBand,
  deriveEscalation,
  shouldRemind,
  stampFirstTouch,
} from "./response-clock";

const RECEIVED = new Date("2026-07-06T12:00:00.000Z");
const at = (min: number, sec = 0) => new Date(RECEIVED.getTime() + (min * 60 + sec) * 1000);

describe("computeResponseSeconds", () => {
  it("returns whole seconds elapsed", () => {
    expect(computeResponseSeconds(RECEIVED, at(1, 30))).toBe(90);
  });
  it("clamps negative (clock skew) to 0", () => {
    expect(computeResponseSeconds(RECEIVED, at(-1))).toBe(0);
  });
});

describe("deriveResponseBand", () => {
  it("green under 15 min", () => {
    expect(deriveResponseBand(0)).toBe("green");
    expect(deriveResponseBand(14 * 60)).toBe("green");
  });
  it("yellow from 15 up to 30 min", () => {
    expect(deriveResponseBand(15 * 60)).toBe("yellow");
    expect(deriveResponseBand(29 * 60)).toBe("yellow");
  });
  it("red at/after 30 min", () => {
    expect(deriveResponseBand(30 * 60)).toBe("red");
    expect(deriveResponseBand(60 * 60)).toBe("red");
  });
});

describe("deriveEscalation", () => {
  it("PRIMARY under 15 min (including the 5-min reminder window)", () => {
    expect(deriveEscalation(0)).toBe("PRIMARY");
    expect(deriveEscalation(5 * 60)).toBe("PRIMARY");
    expect(deriveEscalation(14 * 60)).toBe("PRIMARY");
  });
  it("BACKUP from 15 up to 30 min", () => {
    expect(deriveEscalation(15 * 60)).toBe("BACKUP");
    expect(deriveEscalation(29 * 60)).toBe("BACKUP");
  });
  it("BROKER at/after 30 min", () => {
    expect(deriveEscalation(30 * 60)).toBe("BROKER");
    expect(deriveEscalation(120 * 60)).toBe("BROKER");
  });
});

describe("shouldRemind", () => {
  it("fires only in the 5–15 min PRIMARY window", () => {
    expect(shouldRemind(4 * 60)).toBe(false);
    expect(shouldRemind(5 * 60)).toBe(true);
    expect(shouldRemind(14 * 60)).toBe(true);
    expect(shouldRemind(15 * 60)).toBe(false);
  });
});

describe("stampFirstTouch", () => {
  it("returns all three fields atomically (response = attempt − received)", () => {
    expect(stampFirstTouch(RECEIVED, at(2), "CALL")).toEqual({
      firstTouchAt: at(2),
      firstTouchChannel: "CALL",
      responseSeconds: 120,
    });
  });
  it("a voicemail attempt still stamps a touch", () => {
    const stamp = stampFirstTouch(RECEIVED, at(0, 43), "CALL");
    expect(stamp.responseSeconds).toBe(43);
    expect(stamp.firstTouchChannel).toBe("CALL");
  });
});
