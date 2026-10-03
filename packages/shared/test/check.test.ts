import { describe, expect, it } from "vitest";
import { reconcileBag, toggleBagChecked, toggleItemChecked, type TripBag } from "../src/check.js";

function bag(): TripBag {
  return {
    id: "bag",
    name: "洗漱袋",
    sortOrder: 0,
    checked: false,
    items: [
      { id: "a", name: "牙刷", description: "电动", sortOrder: 0, checked: false },
      { id: "b", name: "牙膏", description: "", sortOrder: 1, checked: false },
    ],
  };
}

describe("联动勾选", () => {
  it("勾选袋子时，下面的物品全部勾上", () => {
    const next = toggleBagChecked(bag(), true);
    expect(next.checked).toBe(true);
    expect(next.items.every((item) => item.checked)).toBe(true);
  });

  it("取消袋子时，下面的物品全部取消", () => {
    const checked = toggleBagChecked(bag(), true);
    const next = toggleBagChecked(checked, false);
    expect(next.checked).toBe(false);
    expect(next.items.every((item) => !item.checked)).toBe(true);
  });

  it("物品全部勾上后，袋子自动勾上", () => {
    let next = toggleItemChecked(bag(), "a", true);
    expect(next.checked).toBe(false);
    next = toggleItemChecked(next, "b", true);
    expect(next.checked).toBe(true);
  });

  it("任一物品取消后，袋子也取消", () => {
    const checked = toggleBagChecked(bag(), true);
    const next = toggleItemChecked(checked, "a", false);
    expect(next.checked).toBe(false);
    expect(next.items.find((item) => item.id === "b")?.checked).toBe(true);
  });

  it("空袋子可以单独勾选", () => {
    const empty: TripBag = { id: "empty", name: "空袋", sortOrder: 0, checked: false, items: [] };
    expect(toggleBagChecked(empty, true).checked).toBe(true);
    expect(toggleBagChecked(empty, false).checked).toBe(false);
  });

  it("新增未勾选物品后，袋子不再保持勾选", () => {
    const checked = toggleBagChecked(bag(), true);
    const next = reconcileBag({
      ...checked,
      items: [...checked.items, { id: "c", name: "牙线", description: "", sortOrder: 2, checked: false }],
    });
    expect(next.checked).toBe(false);
  });
});
