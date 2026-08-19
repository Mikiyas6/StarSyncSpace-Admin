import { describe, it, expect } from "vitest";
import { formatMenuPrice } from "./helpers";

describe("formatMenuPrice", () => {
  it("formats a menu price with its currency code", () => {
    expect(formatMenuPrice(12000)).toBe("12,000 RWF");
    expect(formatMenuPrice(3500, "RWF")).toBe("3,500 RWF");
  });

  it("handles other currencies", () => {
    expect(formatMenuPrice(9.5, "usd")).toBe("9.5 USD");
    expect(formatMenuPrice(120, "EUR")).toBe("120 EUR");
  });

  it("survives missing or malformed values", () => {
    expect(formatMenuPrice(null)).toBe("0 RWF");
    expect(formatMenuPrice("abc")).toBe("0 RWF");
  });
});