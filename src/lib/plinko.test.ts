import { expect, test } from "vitest";
import { getMultipliers, Risk } from "./plinko";

test("getMultipliers returns correct length for all risk levels and rows", () => {
  const risks: Risk[] = ["low", "normal", "high"];
  const rows = [8, 9, 10, 11, 12, 13, 14, 15, 16];

  for (const risk of risks) {
    for (const rowCount of rows) {
      const multipliers = getMultipliers(risk, rowCount);
      // Multiplier count is always rows + 1
      expect(multipliers).toHaveLength(rowCount + 1);
    }
  }
});

test("multipliers are symmetric", () => {
  const risks: Risk[] = ["low", "normal", "high"];
  const rows = [8, 12, 16];

  for (const risk of risks) {
    for (const rowCount of rows) {
      const multipliers = getMultipliers(risk, rowCount);
      const reversed = [...multipliers].reverse();
      expect(multipliers).toEqual(reversed);
    }
  }
});
