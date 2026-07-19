import { describe, it, expect } from 'vitest';
import {
    emptyPlan, place, autoPlace, canPlace, isOccupied, inCityBounds,
    roadPath, cellToWorld, worldToCell, spiral, CITY_CELL, CITY_RADIUS,
} from './cityPlan';

describe('cityPlan', () => {
    it('reserves the capital cell and enforces bounds', () => {
        const plan = emptyPlan();
        expect(isOccupied(plan, 0, 0)).toBe(true);
        expect(canPlace(plan, 0, 0)).toBe(false);
        expect(canPlace(plan, 2, 1)).toBe(true);
        expect(inCityBounds(CITY_RADIUS + 1, 0)).toBe(false);
        expect(canPlace(plan, CITY_RADIUS + 1, 0)).toBe(false);
    });

    it('places buildings once per cell', () => {
        let plan = place(emptyPlan(), 'farms', 2, 0);
        expect(plan.placements).toHaveLength(1);
        plan = place(plan, 'markets', 2, 0); // occupied → refused
        expect(plan.placements).toHaveLength(1);
        plan = place(plan, 'markets', -1, 1);
        expect(plan.placements).toHaveLength(2);
    });

    it('auto-placement is deterministic and never overlaps', () => {
        let a = emptyPlan();
        let b = emptyPlan();
        for (const id of ['farms', 'markets', 'writing', 'academy', 'granary']) {
            a = autoPlace(a, id);
            b = autoPlace(b, id);
        }
        expect(a).toEqual(b);
        const keys = a.placements.map((p) => `${p.gx},${p.gy}`);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('roads run an L-path back to the capital', () => {
        const path = roadPath({ actionId: 'farms', gx: 3, gy: -2 });
        expect(path[0]).toEqual([3, -2]);
        expect(path[path.length - 1]).toEqual([0, 0]);
        // Each step moves exactly one cell in one axis.
        for (let i = 1; i < path.length; i++) {
            const dx = Math.abs(path[i][0] - path[i - 1][0]);
            const dy = Math.abs(path[i][1] - path[i - 1][1]);
            expect(dx + dy).toBe(1);
        }
    });

    it('converts between world and grid space around the capital', () => {
        const { x, y } = cellToWorld(1000, 500, 2, -1);
        expect(x).toBe(1000 + 2 * CITY_CELL);
        expect(y).toBe(500 - CITY_CELL);
        expect(worldToCell(1000, 500, x + 8, y - 8)).toEqual({ gx: 2, gy: -1 });
    });

    it('the spiral covers every ring inside the city bounds', () => {
        const cells = spiral();
        expect(cells.some(([gx, gy]) => Math.max(Math.abs(gx), Math.abs(gy)) === 1)).toBe(true);
        expect(cells.every(([gx, gy]) => inCityBounds(gx, gy))).toBe(true);
    });
});
