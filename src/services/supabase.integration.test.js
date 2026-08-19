/* eslint-disable no-undef */
// Read-only integration test that runs against the real Supabase project.
// Verifies the schema created by setup_menu_table.sql is live and works the
// way the admin app and the customer site expect.
//
// Opt-in: RUN_DB_TESTS=1 npm test
// (Requires network access to the project the app is configured with.)
import { describe, it, expect } from "vitest";
import supabase from "./supabase";

const RUN = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

RUN("menu schema (live Supabase)", () => {
  it("has the four menu tables", async () => {
    for (const table of [
      "menu_categories",
      "menu_sections",
      "menu_items",
      "menu_item_images",
    ]) {
      const { data, error } = await supabase.from(table).select("*").limit(1);
      expect(error, `${table} query failed: ${error?.message}`).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  it("seed data: Food and Drinks categories exist", async () => {
    const { data, error } = await supabase
      .from("menu_categories")
      .select("id, name, sort_order, is_active")
      .order("sort_order");

    expect(error).toBeNull();
    const names = (data ?? []).map((c) => c.name);
    expect(names).toContain("Food");
    expect(names).toContain("Drinks");
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  it("categories have sections, and sections have items", async () => {
    const { data: sections, error: secErr } = await supabase
      .from("menu_sections")
      .select("id, category_id, name, is_active, sort_order");
    expect(secErr).toBeNull();
    expect(sections.length).toBeGreaterThan(0);

    const { data: items, error: itemErr } = await supabase
      .from("menu_items")
      .select("id, section_id, name, price, currency, is_available, is_featured")
      .order("sort_order");
    expect(itemErr).toBeNull();
    expect(items.length).toBeGreaterThan(0);

    const categoryIds = new Set(
      (await supabase.from("menu_categories").select("id")).data.map(
        (c) => c.id
      )
    );
    expect(
      sections.every((s) => categoryIds.has(s.category_id))
    ).toBe(true);

    const sectionIds = new Set(sections.map((s) => s.id));
    expect(items.every((i) => sectionIds.has(i.section_id))).toBe(true);
  });

  it("items pass the database integrity checks", async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("price, preparation_time_minutes, calories");
    expect(error).toBeNull();

    for (const item of data) {
      expect(Number(item.price)).toBeGreaterThanOrEqual(0);
      if (item.preparation_time_minutes != null)
        expect(item.preparation_time_minutes).toBeGreaterThanOrEqual(0);
      if (item.calories != null) expect(item.calories).toBeGreaterThanOrEqual(0);
    }
  });

  it("the customer menu query shape works (categories -> sections -> items)", async () => {
    const { data: categories, error } = await supabase
      .from("menu_categories")
      .select(
        "id, name, sort_order, is_active, menu_sections(id, name, is_active, sort_order, menu_items(id, name, price, currency, is_available, is_featured, menu_item_images(id, url, is_primary)))"
      )
      .order("sort_order");

    expect(error).toBeNull();
    const food = categories.find((c) => c.name === "Food");
    expect(food).toBeTruthy();
    expect(food.menu_sections.length).toBeGreaterThan(0);
    expect(
      food.menu_sections.some((s) => s.menu_items.length > 0)
    ).toBe(true);
  });

  it("storage bucket menu-images exists and is public", async () => {
    const { data, error } = await supabase.storage.getBucket("menu-images");
    if (error) {
      // List available buckets so the message is actionable.
      const { data: buckets } = await supabase.storage.listBuckets();
      throw new Error(
        `menu-images bucket missing. Existing: ${(buckets ?? []).map((b) => b.name).join(", ") || "none"}`
      );
    }
    expect(data.public).toBe(true);
  });
});