import { describe, it, expect } from "vitest";
import { normalizeMenuItemInput } from "./apiMenu";

describe("normalizeMenuItemInput", () => {
  it("trims strings and converts numeric fields to numbers", () => {
    const out = normalizeMenuItemInput({
      name: "  Grilled tilapia & chips  ",
      section_id: "7",
      price: "12000.50",
      currency: "rwf",
      preparation_time_minutes: "20",
      calories: "540",
      ingredients: [" Tilapia ", "Chips", ""],
      allergens: [],
      dietary_tags: ["gluten-free"],
      is_available: true,
      is_featured: false,
      sort_order: "2",
    });

    expect(out.name).toBe("Grilled tilapia & chips");
    expect(out.section_id).toBe(7);
    expect(out.price).toBe(12000.5);
    expect(out.currency).toBe("rwf");
    expect(out.preparation_time_minutes).toBe(20);
    expect(out.calories).toBe(540);
    expect(out.ingredients).toEqual(["Tilapia", "Chips"]);
    expect(out.dietary_tags).toEqual(["gluten-free"]);
    expect(out.is_available).toBe(true);
    expect(out.is_featured).toBe(false);
    expect(out.sort_order).toBe(2);
  });

  it("defaults currency and flags when missing", () => {
    const out = normalizeMenuItemInput({
      name: "Water",
      section_id: 3,
      price: 1000,
      ingredients: [],
      allergens: [],
      dietary_tags: [],
    });
    expect(out.currency).toBe("RWF");
    expect(out.is_available).toBe(true);
    expect(out.is_featured).toBe(false);
    expect(out.sort_order).toBe(0);
  });

  it("keeps empty optional numerics as null, not NaN", () => {
    const out = normalizeMenuItemInput({
      name: "Soup",
      section_id: 4,
      price: 6000,
      preparation_time_minutes: "",
      calories: null,
      ingredients: [],
      allergens: [],
      dietary_tags: [],
    });
    expect(out.preparation_time_minutes).toBeNull();
    expect(out.calories).toBeNull();
  });

  it("blank description becomes null", () => {
    const out = normalizeMenuItemInput({
      name: "Bread",
      section_id: 1,
      price: 500,
      description: "   ",
      ingredients: [],
      allergens: [],
      dietary_tags: [],
    });
    expect(out.description).toBeNull();
  });
});