import Phaser from 'phaser';

/**
 * Crisp canvas on high-DPI displays, without moving the logical coordinate
 * system.
 *
 * The problem: the game boots at a fixed DESIGN_WIDTH×DESIGN_HEIGHT drawing
 * buffer under `Scale.FIT`. FIT only ever changes the canvas *CSS* size to fit
 * the parent — it never touches the canvas backing store (drawing buffer). So
 * on a Retina display (or any window larger than the design size) the browser
 * upscales a 1280×720 buffer to the physical pixels, which reads as soft/blurry.
 *
 * The fix increases the *backing store* resolution only. Phaser 4's WebGL
 * renderer removed the old `resolution` config, and its pipeline couples the
 * rasterisation resolution to the camera size (game size) through a single
 * drawing context whose `width`/`height` drive BOTH the projection matrix and
 * the GL viewport. We keep the game size — and therefore every camera, world
 * and HUD coordinate — at the design 1280×720, and exploit the one seam where
 * projection and viewport can diverge:
 *
 *   - `baseDrawingContext.width/height`  → projection matrix + scissor maths.
 *     Kept at the DESIGN size so a 1280-wide camera still fills clip space.
 *   - `baseDrawingContext.state.viewport` → the actual `gl.viewport`, applied
 *     from context state every frame. Set to the full physical buffer so the
 *     design-space render is rasterised at 1 texel per physical pixel.
 *   - scissor test is disabled on the base context: the camera would otherwise
 *     set a 1280×720 scissor box that clips the larger buffer. Every scene here
 *     uses a single full-screen camera (the minimap is drawn in-camera, not as
 *     a second camera), so nothing depends on the base-context scissor.
 *
 * A runtime frame-rate guard lowers the render scale toward 1× on the heaviest
 * worlds if the frame rate dips, and restores it (up to the cap) when the frame
 * rate recovers — snappy first, crisp when it's free.
 */

/** Internal shape of the base drawing context we need to reach past the public API. */
interface BaseContextInternals {
    width: number;
    height: number;
    setScissorEnable(enable: boolean): void;
    state: { viewport: number[] };
}

export interface DisplayResolutionOptions {
    /** The unchanging logical width (DESIGN_WIDTH). */
    designWidth: number;
    /** The unchanging logical height (DESIGN_HEIGHT). */
    designHeight: number;
}

/**
 * Resolution for in-canvas Phaser Text so labels rasterise crisply on Retina
 * (Text renders to its own texture; without this it's sampled up and soft).
 * Matches the render cap (min devicePixelRatio, 2).
 */
export function textResolution(): number {
    return Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
}

/** Frame-rate guard tuning. */
const GUARD = {
    /** Wait this long after boot before sampling (warmup). */
    warmupMs: 2500,
    /** Sample the frame rate on this interval. */
    sampleMs: 1000,
    /** Below this sustained fps, step the render scale down. */
    fpsDown: 50,
    /** Above this sustained fps, step the render scale back up. */
    fpsUp: 58,
    /** Consecutive bad samples required before stepping down. */
    downSamples: 3,
    /** Consecutive good samples required before stepping up. */
    upSamples: 6,
} as const;

/**
 * Render-scale ladder from 1× up to the cap. On a non-Retina display
 * (devicePixelRatio 1) the cap is 1, so the ladder is [1] and the guard is a
 * no-op — the backing store simply matches the CSS size at 1×.
 */
function buildScaleLevels(cap: number): number[] {
    if (cap <= 1) return [1];
    // 1 → 1.5 → cap (2 on Retina). De-duplicated + sorted ascending.
    const levels = Array.from(new Set([1, 1.5, cap])).filter((v) => v <= cap + 1e-6);
    levels.sort((a, b) => a - b);
    return levels;
}

export function installDisplayResolution(game: Phaser.Game, opts: DisplayResolutionOptions): void {
    const { designWidth, designHeight } = opts;

    const cap = Math.min(window.devicePixelRatio || 1, 2);
    const levels = buildScaleLevels(cap);
    let levelIndex = levels.length - 1; // start at the cap: crisp first.
    let renderScale = levels[levelIndex];

    /**
     * The WebGL renderer is created during Phaser's async boot, so it is not
     * available synchronously here. Fetch it on demand and only treat it as
     * usable once it is a WebGL renderer — the Canvas fallback lacks the
     * drawing-context seam we rely on, so we no-op there.
     */
    function webglRenderer(): Phaser.Renderer.WebGL.WebGLRenderer | undefined {
        const r = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined;
        if (r && (r as { type?: number }).type === Phaser.WEBGL) return r;
        return undefined;
    }

    // Gate: the Scale Manager emits RESIZE during boot, before the renderer's
    // base drawing context exists. Ignore everything until start() (READY).
    let started = false;

    /** Resize the backing store + re-point the GL viewport at it. */
    function apply(): void {
        if (!started) return;
        const renderer = webglRenderer();
        if (!renderer || !game.canvas) return;
        const base = renderer.baseDrawingContext as unknown as BaseContextInternals | null;
        if (!base) return;

        const scale = game.scale;
        // The FIT-computed CSS size of the canvas (device-independent px).
        const cssW = scale.displaySize.width;
        const cssH = scale.displaySize.height;
        if (cssW <= 0 || cssH <= 0) return;

        // Backing store = CSS size × renderScale, but never below the design
        // resolution (so small windows keep the original supersampled look and
        // never regress).
        const bufW = Math.max(designWidth, Math.round(cssW * renderScale));
        const bufH = Math.max(designHeight, Math.round(cssH * renderScale));

        const canvas = game.canvas;
        if (canvas.width !== bufW || canvas.height !== bufH) {
            canvas.width = bufW;
            canvas.height = bufH;
        }
        // Preserve the CSS layout size that FIT set (setting canvas.width does
        // not change the style, but re-assert it to be safe).
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        // Projection + scissor maths stay in DESIGN space so the 1280-wide
        // camera fills clip space exactly...
        base.width = designWidth;
        base.height = designHeight;
        // ...while the GL viewport covers the full physical buffer (crispness).
        base.state.viewport = [0, 0, bufW, bufH];
        // The camera sets a DESIGN-space scissor box every frame; on a larger
        // buffer that would clip. Disable it — a single full-screen camera per
        // scene needs no clipping.
        base.setScissorEnable(false);
    }

    /** Re-apply at the current scale (used by the guard when it changes level). */
    function reapply(): void {
        renderScale = levels[levelIndex];
        apply();
    }

    // FIT recomputes the CSS size on window/parent changes without firing a
    // renderer RESIZE, so we recompute the buffer ourselves on every Scale
    // Manager resize. (game.scale exists as soon as the game is constructed.)
    game.scale.on(Phaser.Scale.Events.RESIZE, apply);

    let timer: ReturnType<typeof setInterval> | undefined;

    /** Renderer-dependent wiring, run once the WebGL renderer exists. */
    function start(): void {
        const renderer = webglRenderer();
        if (!renderer) return; // Canvas fallback: leave FIT's default behaviour.

        started = true;
        // Apply immediately, and re-assert if a renderer RESIZE ever rebuilds
        // the base context (e.g. a game-size change) and clobbers our overrides.
        apply();
        renderer.on(Phaser.Renderer.Events.RESIZE, apply);

        // ---- Frame-rate guard --------------------------------------------
        // Only meaningful when there is headroom to trade (cap > 1).
        if (levels.length > 1) {
            const startedAt = performance.now();
            let goodStreak = 0;
            let badStreak = 0;

            timer = setInterval(() => {
                if (performance.now() - startedAt < GUARD.warmupMs) return;
                const fps = game.loop.actualFps;
                if (!Number.isFinite(fps) || fps <= 0) return;

                if (fps < GUARD.fpsDown) {
                    badStreak += 1;
                    goodStreak = 0;
                    if (badStreak >= GUARD.downSamples && levelIndex > 0) {
                        levelIndex -= 1;
                        badStreak = 0;
                        reapply();
                    }
                } else if (fps > GUARD.fpsUp) {
                    goodStreak += 1;
                    badStreak = 0;
                    if (goodStreak >= GUARD.upSamples && levelIndex < levels.length - 1) {
                        levelIndex += 1;
                        goodStreak = 0;
                        reapply();
                    }
                } else {
                    // Neutral band (between fpsDown and fpsUp): let streaks decay
                    // so a single stray sample never trips a change (hysteresis).
                    goodStreak = 0;
                    badStreak = 0;
                }
            }, GUARD.sampleMs);
        }
    }

    // The renderer + Scale Manager's first refresh land on READY. If the game
    // has already booted (installed late), start immediately.
    if (game.isBooted) {
        start();
    } else {
        game.events.once(Phaser.Core.Events.READY, start);
    }

    game.events.once(Phaser.Core.Events.DESTROY, () => {
        if (timer !== undefined) clearInterval(timer);
        game.scale.off(Phaser.Scale.Events.RESIZE, apply);
        const renderer = webglRenderer();
        renderer?.off(Phaser.Renderer.Events.RESIZE, apply);
    });
}
