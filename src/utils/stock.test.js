import { describe, expect, it } from "vitest";

import {
  ADMIN_REASONS,
  STAFF_REASONS,
  deltaFor,
  isLowStock,
  isSaleReason,
  reasonsFor,
  stockState,
  suggestedRestock,
} from "./stock";

describe("who may record what", () => {
  /* The rule from the brief: staff reduce stock, admins put it in. */
  it("lets staff take stock out but not put it in", () => {
    expect(STAFF_REASONS).toContain("sale");
    expect(STAFF_REASONS).toContain("removal");
    expect(STAFF_REASONS).toContain("waste");
    expect(STAFF_REASONS).not.toContain("restock");
    expect(STAFF_REASONS).not.toContain("correction");
  });

  it("lets admins record everything", () => {
    expect(ADMIN_REASONS).toContain("restock");
    expect(ADMIN_REASONS).toContain("sale");
    expect(ADMIN_REASONS).toContain("correction");
  });

  it("offers the right list for the person asking", () => {
    expect(reasonsFor({ isAdmin: false })).toEqual(STAFF_REASONS);
    expect(reasonsFor({ isAdmin: true })).toEqual(ADMIN_REASONS);
  });
});

describe("sold versus merely gone", () => {
  /* The distinction the feature exists for: four ways for stock to go
     down, exactly one of which is money. */
  it("counts only a sale as revenue", () => {
    expect(isSaleReason("sale")).toBe(true);
    expect(isSaleReason("removal")).toBe(false);
    expect(isSaleReason("waste")).toBe(false);
    expect(isSaleReason("transfer_out")).toBe(false);
    expect(isSaleReason("restock")).toBe(false);
    expect(isSaleReason("correction")).toBe(false);
  });

  it("does not treat an unknown reason as a sale", () => {
    expect(isSaleReason("something-new")).toBe(false);
    expect(isSaleReason(undefined)).toBe(false);
  });
});

describe("deltaFor", () => {
  it("makes outgoing reasons negative and incoming positive", () => {
    expect(deltaFor("sale", 3)).toBe(-3);
    expect(deltaFor("removal", 2)).toBe(-2);
    expect(deltaFor("waste", 1)).toBe(-1);
    expect(deltaFor("transfer_out", 4)).toBe(-4);
    expect(deltaFor("restock", 24)).toBe(24);
    expect(deltaFor("transfer_in", 6)).toBe(6);
  });

  /* The sign must not depend on how the caller happened to type the
     quantity — the database constraint rejects a "sale" of +5, and it
     should never get the chance to. */
  it("ignores the sign the caller typed", () => {
    expect(deltaFor("sale", -3)).toBe(-3);
    expect(deltaFor("restock", -24)).toBe(24);
  });

  it("lets a recount go either way, because a recount can", () => {
    expect(deltaFor("correction", 5, { increase: true })).toBe(5);
    expect(deltaFor("correction", 5, { increase: false })).toBe(-5);
    expect(deltaFor("correction", 5)).toBe(-5);
  });

  it("refuses to move nothing", () => {
    expect(deltaFor("sale", 0)).toBe(0);
    expect(deltaFor("sale", "")).toBe(0);
    expect(deltaFor("sale", "abc")).toBe(0);
    expect(deltaFor("nonsense", 5)).toBe(0);
  });

  it("only deals in whole units", () => {
    expect(deltaFor("sale", 2.7)).toBe(-2);
  });
});

describe("stock levels", () => {
  it("is fine above the target", () => {
    expect(stockState({ quantity: 10, par_level: 6 })).toBe("ok");
    expect(isLowStock({ quantity: 10, par_level: 6 })).toBe(false);
  });

  it("is low at or below the target", () => {
    expect(stockState({ quantity: 6, par_level: 6 })).toBe("low");
    expect(stockState({ quantity: 2, par_level: 6 })).toBe("low");
    expect(isLowStock({ quantity: 2, par_level: 6 })).toBe(true);
  });

  it("is empty at zero", () => {
    expect(stockState({ quantity: 0, par_level: 6 })).toBe("empty");
    expect(isLowStock({ quantity: 0, par_level: 6 })).toBe(true);
  });

  /* Without this, every item ever added sits in the restock list at
     quantity 0 forever and the sidebar badge becomes furniture. */
  it("does not nag about an item with no target set", () => {
    expect(stockState({ quantity: 4, par_level: 0 })).toBe("untracked");
    expect(isLowStock({ quantity: 4, par_level: 0 })).toBe(false);
  });

  it("still flags an item that is both untargeted and gone", () => {
    expect(stockState({ quantity: 0, par_level: 0 })).toBe("empty");
    expect(isLowStock({ quantity: 0, par_level: 0 })).toBe(true);
  });

  it("copes with missing numbers", () => {
    expect(stockState({})).toBe("empty");
    expect(stockState(null)).toBe("empty");
  });
});

describe("suggestedRestock", () => {
  it("offers enough to reach the target", () => {
    expect(suggestedRestock({ quantity: 2, par_level: 6 })).toBe(4);
    expect(suggestedRestock({ quantity: 0, par_level: 24 })).toBe(24);
  });

  it("never offers zero or a negative", () => {
    expect(suggestedRestock({ quantity: 10, par_level: 6 })).toBe(1);
    expect(suggestedRestock({ quantity: 5, par_level: 0 })).toBe(1);
    expect(suggestedRestock({})).toBe(1);
  });
});
