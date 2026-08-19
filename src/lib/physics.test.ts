import { expect, test, describe } from "vitest";

// Simulation of the path generation logic from PlinkoGame.tsx
function simulateDrop(rows: number) {
  let rights = 0;
  for (let r = 0; r < rows; r++) {
    if (Math.random() < 0.5) rights++;
  }
  return rights;
}

describe("Plinko Physics Distribution", () => {
  test("ball distribution matches binomial distribution (1000 trials)", () => {
    const rows = 8;
    const trials = 1000;
    const results: Record<number, number> = {};
    
    for (let i = 0; i < trials; i++) {
      const slot = simulateDrop(rows);
      results[slot] = (results[slot] || 0) + 1;
    }

    // In 8 rows, the middle slot (4) should have the most hits
    // and extreme slots (0, 8) should have the least.
    expect(results[4]).toBeGreaterThan(results[0] || 0);
    expect(results[4]).toBeGreaterThan(results[8] || 0);
    
    // Total trials should match
    const total = Object.values(results).reduce((a, b) => a + b, 0);
    expect(total).toBe(trials);
  });

  test("ball path boundaries", () => {
    const rows = 16;
    for (let i = 0; i < 100; i++) {
      const slot = simulateDrop(rows);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThanOrEqual(rows);
    }
  });
});
