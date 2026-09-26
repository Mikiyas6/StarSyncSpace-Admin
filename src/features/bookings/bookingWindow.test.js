import { describe, expect, it } from "vitest";
import {
  endAfterLength,
  initialWindow,
  moveWindowStart,
  setWindowEnd,
  windowMinutes,
} from "./bookingWindow";

const window0 = (start, end) => ({ start, end });

describe("initialWindow", () => {
  it("starts at the next quarter hour and runs for the default length", () => {
    const { start, end } = initialWindow(60, new Date(2026, 8, 26, 14, 7));
    expect(start).toBe("2026-09-26T14:15");
    expect(end).toBe("2026-09-26T15:15");
  });

  it("takes both times from one reading of the clock", () => {
    // Two separate new Date() calls could straddle a quarter-hour and open
    // the form with a booking 15 minutes longer than asked for.
    const { start, end } = initialWindow(30, new Date(2026, 8, 26, 14, 59, 59));
    expect(start).toBe("2026-09-26T15:00");
    expect(end).toBe("2026-09-26T15:30");
  });
});

describe("windowMinutes", () => {
  it("is the distance between the two boxes", () => {
    expect(
      windowMinutes(window0("2026-09-26T14:00", "2026-09-26T17:30")),
    ).toBe(210);
  });

  it("reads an interval no dropdown of 15-minute steps could offer", () => {
    expect(windowMinutes(window0("2026-09-26T14:20", "2026-09-26T15:05"))).toBe(
      45,
    );
    expect(windowMinutes(window0("2026-09-26T14:00", "2026-09-26T14:07"))).toBe(
      7,
    );
  });

  it("crosses midnight, because each box carries its own date", () => {
    expect(
      windowMinutes(window0("2026-09-26T22:00", "2026-09-27T02:00")),
    ).toBe(240);
  });

  it("is 0 — not negative, not NaN — when there is no length yet", () => {
    expect(windowMinutes(window0("2026-09-26T14:00", ""))).toBe(0);
    expect(windowMinutes(window0("", "2026-09-26T14:00"))).toBe(0);
    expect(windowMinutes(window0("2026-09-26T17:00", "2026-09-26T14:00"))).toBe(
      0,
    );
    expect(windowMinutes(window0("2026-09-26T14:00", "2026-09-26T14:00"))).toBe(
      0,
    );
    expect(windowMinutes(undefined)).toBe(0);
  });
});

describe("moveWindowStart", () => {
  it("moves the booking instead of resizing it", () => {
    const moved = moveWindowStart(
      window0("2026-09-26T14:00", "2026-09-26T16:00"),
      "2026-09-26T15:00",
    );
    expect(moved).toEqual({
      start: "2026-09-26T15:00",
      end: "2026-09-26T17:00",
    });
    expect(windowMinutes(moved)).toBe(120);
  });

  it("carries an odd length along unchanged", () => {
    expect(
      windowMinutes(
        moveWindowStart(
          window0("2026-09-26T14:00", "2026-09-26T14:50"),
          "2026-09-26T19:35",
        ),
      ),
    ).toBe(50);
  });

  it("carries the end over midnight when the start moves late", () => {
    expect(
      moveWindowStart(
        window0("2026-09-26T14:00", "2026-09-26T17:00"),
        "2026-09-26T23:00",
      ).end,
    ).toBe("2026-09-27T02:00");
  });

  it("leaves the end alone when there is no length to preserve", () => {
    // Nothing to move, and inventing an end here would put a guess in a
    // box the admin is about to type in.
    expect(
      moveWindowStart(window0("2026-09-26T14:00", ""), "2026-09-26T15:00"),
    ).toEqual({ start: "2026-09-26T15:00", end: "" });

    expect(
      moveWindowStart(
        window0("2026-09-26T17:00", "2026-09-26T14:00"),
        "2026-09-26T18:00",
      ).end,
    ).toBe("2026-09-26T14:00");
  });

  it("accepts a half-typed start without throwing it away", () => {
    expect(
      moveWindowStart(window0("2026-09-26T14:00", "2026-09-26T16:00"), ""),
    ).toEqual({ start: "", end: "2026-09-26T16:00" });
  });
});

describe("setWindowEnd", () => {
  it("writes the end and nothing else", () => {
    expect(
      setWindowEnd(
        window0("2026-09-26T14:00", "2026-09-26T16:00"),
        "2026-09-26T18:45",
      ),
    ).toEqual({ start: "2026-09-26T14:00", end: "2026-09-26T18:45" });
  });
});

describe("endAfterLength", () => {
  it("is a shortcut for typing an end time — it moves only the end", () => {
    expect(
      endAfterLength(window0("2026-09-26T14:00", "2026-09-26T15:00"), 240),
    ).toEqual({ start: "2026-09-26T14:00", end: "2026-09-26T18:00" });
  });

  it("rolls a full day onto the next date", () => {
    expect(
      endAfterLength(window0("2026-09-26T14:00", "2026-09-26T15:00"), 24 * 60)
        .end,
    ).toBe("2026-09-27T14:00");
  });

  it("does nothing without a start to count from", () => {
    const empty = window0("", "");
    expect(endAfterLength(empty, 60)).toBe(empty);
  });
});
