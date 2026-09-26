/* Static-render tests, like CreateBookingForm's: this project has no DOM
   test setup, so what can be checked here is the closed control — the
   label it reads back, and the states the form drives it into. The panel
   only exists once someone clicks, so it is verified in the browser. */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import DateTimePicker from "./DateTimePicker";

const render = (props) => renderToStaticMarkup(<DateTimePicker {...props} />);
// The trigger's text, with the calendar icon's markup stripped out. The
// placeholder sits in a <span>, so reading only up to the first tag would
// come back empty for it.
const label = (html) =>
  html
    .match(/<button[^>]*>([\s\S]*)<\/button>/)[1]
    .replace(/<svg[\s\S]*?<\/svg>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();

describe("DateTimePicker", () => {
  it("says the value back in words rather than in a date mask", () => {
    expect(label(render({ value: "2026-09-26T14:05" }))).toBe(
      "Sat 26 Sep, 14:05",
    );
  });

  it("reads a local wall-clock time, with no timezone shift", () => {
    // 00:30 must stay 00:30 and stay on the 26th, not slide to the 25th.
    expect(label(render({ value: "2026-09-26T00:30" }))).toBe(
      "Sat 26 Sep, 00:30",
    );
  });

  it("asks for a value when it has none, instead of showing an empty box", () => {
    expect(label(render({ value: "" }))).toBe("Pick a date and time");
    expect(label(render({ value: "not a date" }))).toBe("Pick a date and time");
  });

  it("starts closed", () => {
    const html = render({ value: "2026-09-26T14:05" });
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });

  it("carries the form's disabled and invalid states onto the trigger", () => {
    expect(render({ value: "2026-09-26T14:05", disabled: true })).toContain(
      "disabled",
    );
    expect(
      render({ value: "2026-09-26T14:05", ariaLabel: "Booking end" }),
    ).toContain('aria-label="Booking end"');
  });
});
