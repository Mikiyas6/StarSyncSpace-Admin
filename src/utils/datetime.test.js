import { describe, expect, it } from "vitest";
import { parseLocalInput, toLocalInputValue } from "./datetime";

describe("toLocalInputValue / parseLocalInput", () => {
  it("round-trips a local wall-clock time without shifting the zone", () => {
    // The bug this guards: toISOString() would hand the box UTC, moving a
    // Kigali booking two hours and giving away the room for free.
    const date = new Date(2026, 8, 26, 14, 5);
    expect(toLocalInputValue(date)).toBe("2026-09-26T14:05");
    expect(parseLocalInput(toLocalInputValue(date)).getTime()).toBe(
      date.getTime(),
    );
  });

  it("pads every part, so the browser accepts the value", () => {
    expect(toLocalInputValue(new Date(2026, 0, 2, 3, 4))).toBe(
      "2026-01-02T03:04",
    );
  });

  it("reads an empty or unparseable box as nothing, not as an invalid date", () => {
    expect(parseLocalInput("")).toBeNull();
    expect(parseLocalInput(undefined)).toBeNull();
    expect(parseLocalInput("not a time")).toBeNull();
  });
});

