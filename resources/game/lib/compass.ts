/**
 * Turn a screen-space vector (y points down) into a compass word. Used for
 * directional threat cues so warnings always contain a direction (brief §26).
 */
const DIRECTIONS = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];

export function compass(dx: number, dy: number): string {
    // Negate dy so "up" on screen reads as north.
    const deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
    const index = ((Math.round(deg / 45) % 8) + 8) % 8;
    return DIRECTIONS[index];
}
