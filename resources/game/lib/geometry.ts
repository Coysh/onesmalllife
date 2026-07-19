/**
 * Distance helpers for hot per-frame loops.
 *
 * When we only need a threshold test — "is B within radius r of A?" — comparing
 * squared distances (dx*dx + dy*dy vs r*r) gives the exact same boolean as
 * Phaser.Math.Distance.Between(...) <= r but skips the per-call Math.sqrt. Use
 * this only where the actual distance VALUE isn't needed (no direction/compass/
 * label maths); those callers must keep the real distance.
 */
export function withinRange(x1: number, y1: number, x2: number, y2: number, r: number): boolean {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy <= r * r;
}
