import Phaser from 'phaser';

/**
 * Procedural sprite factory. The game's art stays code-drawn flat/vector, but
 * with big scrolling worlds we can no longer afford a live Graphics object per
 * entity. Each variant is drawn ONCE into a cached texture (keyed by kind +
 * variant + palette) and entities render as cheap Images/Sprites. Animated
 * flourishes (flagella, fire, smoke) stay as small live Graphics layered on
 * top of the cached body.
 */

/** Stable cache key for a tinted variant. */
export function spriteKey(kind: string, variant: string, palette?: number[]): string {
    const pal = palette && palette.length ? `-${palette.map((c) => c.toString(16)).join('_')}` : '';
    return `osl-${kind}-${variant}${pal}`;
}

/**
 * Generate (once) a texture of the given size by running `draw` on a scratch
 * Graphics. The draw callback works in texture-local coordinates with
 * (w/2, h/2) as the natural centre. Returns the texture key.
 */
export function makeTexture(
    scene: Phaser.Scene,
    key: string,
    w: number,
    h: number,
    draw: (g: Phaser.GameObjects.Graphics, w: number, h: number) => void,
): string {
    if (scene.textures.exists(key)) return key;
    const g = scene.add.graphics();
    g.setVisible(false);
    draw(g, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
}
