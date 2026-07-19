/**
 * Civilisation city grid: pure placement/occupancy/road logic for CityScene.
 * The city is a coarse grid of cells around the capital; placed decisions
 * become buildings on it, connected by L-shaped roads back to the hearth.
 * Pure so layout rules are testable without Phaser.
 */

export const CITY_CELL = 40; // px per grid cell
export const CITY_RADIUS = 6; // grid cells from the centre the city may reach

export interface Placement {
    actionId: string;
    gx: number; // grid coords, 0,0 = capital
    gy: number;
}

export interface CityPlan {
    placements: Placement[];
}

export function emptyPlan(): CityPlan {
    return { placements: [] };
}

export function isOccupied(plan: CityPlan, gx: number, gy: number): boolean {
    return (gx === 0 && gy === 0) || plan.placements.some((p) => p.gx === gx && p.gy === gy);
}

export function inCityBounds(gx: number, gy: number): boolean {
    return Math.hypot(gx, gy) <= CITY_RADIUS;
}

export function canPlace(plan: CityPlan, gx: number, gy: number): boolean {
    return inCityBounds(gx, gy) && !isOccupied(plan, gx, gy);
}

export function place(plan: CityPlan, actionId: string, gx: number, gy: number): CityPlan {
    if (!canPlace(plan, gx, gy)) return plan;
    return { placements: [...plan.placements, { actionId, gx, gy }] };
}

/**
 * Deterministic auto-placement for restored campaigns (building positions are
 * not stored in the save; the same taken-actions list always re-lays the same
 * city): a spiral outward from the capital.
 */
export function autoPlace(plan: CityPlan, actionId: string): CityPlan {
    for (const [gx, gy] of spiral()) {
        if (canPlace(plan, gx, gy)) return place(plan, actionId, gx, gy);
    }
    return plan;
}

/** Grid offsets spiralling outward ring by ring, deterministic order. */
export function spiral(): [number, number][] {
    const out: [number, number][] = [];
    for (let ring = 1; ring <= CITY_RADIUS; ring++) {
        for (let gx = -ring; gx <= ring; gx++) {
            for (let gy = -ring; gy <= ring; gy++) {
                if (Math.max(Math.abs(gx), Math.abs(gy)) !== ring) continue;
                if (inCityBounds(gx, gy)) out.push([gx, gy]);
            }
        }
    }
    return out;
}

/** World-space centre of a grid cell relative to the capital at (cx, cy). */
export function cellToWorld(cx: number, cy: number, gx: number, gy: number): { x: number; y: number } {
    return { x: cx + gx * CITY_CELL, y: cy + gy * CITY_CELL };
}

export function worldToCell(cx: number, cy: number, wx: number, wy: number): { gx: number; gy: number } {
    return { gx: Math.round((wx - cx) / CITY_CELL), gy: Math.round((wy - cy) / CITY_CELL) };
}

/**
 * An L-shaped road from a building back to the capital: horizontal leg first,
 * then vertical. Returns the grid waypoints (inclusive of both ends).
 */
export function roadPath(p: Placement): [number, number][] {
    const path: [number, number][] = [];
    const stepX = p.gx > 0 ? -1 : 1;
    for (let gx = p.gx; gx !== 0; gx += stepX) path.push([gx, p.gy]);
    const stepY = p.gy > 0 ? -1 : 1;
    for (let gy = p.gy; gy !== 0; gy += stepY) path.push([0, gy]);
    path.push([0, 0]);
    return path;
}
