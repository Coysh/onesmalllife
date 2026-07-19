import type { EventBus, StageCompletePayload } from '../bootstrap/events';
import { prefersReducedMotion } from '../lib/motion';

/**
 * Stage transitions (DOM). Two jobs:
 * 1. When a stage begins, an intro title card (Blade-rendered) fades out
 *    after a beat so the player arrives with context.
 * 2. When a stage completes, a short cinematic plays before the summary
 *    panel: narration lines fade through, one per beat, telling the jump in
 *    scale — then the existing continue/advance panel appears.
 * Reduced motion skips straight to the panel.
 */

const NARRATION: Record<string, string[]> = {
    cell: [
        'Generations divide in the warm dark.',
        'Cells bind. Cells specialise.',
        'Something new stirs toward the light.',
    ],
    creature: [
        'Seasons turn to generations.',
        'The pack learns fire, and word, and name.',
        'A tribe gathers at the first hearth.',
    ],
    tribe: [
        'Songs harden into law.',
        'Camps grow walls; walls grow streets.',
        'A civilisation raises its first stone.',
    ],
    civilisation: [
        'Borders blur beneath flight and wire.',
        'A thousand cities breathe as one.',
        'For the first time, the world is seen whole.',
    ],
    planetary: [
        'The sky was never a ceiling.',
        'Engines light against the dark.',
        'One small life reaches for the stars.',
    ],
    space: [
        'The lineage outlives its cradle.',
        'Every star a possible home.',
    ],
};

const BEAT_MS = 1900;

export class TransitionController {
    private overlay: HTMLElement | null;
    private narrationEl: HTMLElement | null;
    private panelEl: HTMLElement | null;
    private summaryEl: HTMLElement | null;

    constructor(private root: HTMLElement, bus: EventBus) {
        this.overlay = root.querySelector('[data-overlay="stage-complete"]');
        this.narrationEl = root.querySelector('[data-transition="narration"]');
        this.panelEl = root.querySelector('[data-transition="panel"]');
        this.summaryEl = root.querySelector('[data-overlay="summary"]');

        bus.on('stage:complete', (p) => this.play(p));
        this.runIntro();
    }

    /**
     * The stage title card fades out shortly after boot (click to skip). It is
     * server-rendered on every page load, so without a seen-marker it replays
     * each time the player reloads or returns mid-stage — remember it per
     * campaign+stage the same way onboarding does.
     */
    private runIntro(): void {
        const intro = this.root.querySelector<HTMLElement>('[data-overlay="stage-intro"]');
        if (!intro || intro.hidden) return;

        const key = intro.dataset.introKey ? `osl-intro-${intro.dataset.introKey}` : '';
        const seen = (): boolean => {
            if (!key) return false;
            try {
                return localStorage.getItem(key) === '1';
            } catch {
                return false;
            }
        };
        if (seen()) {
            intro.hidden = true;
            return;
        }

        const dismiss = () => {
            intro.style.transition = 'opacity 700ms ease';
            intro.style.opacity = '0';
            window.setTimeout(() => (intro.hidden = true), 750);
            if (key) {
                try {
                    localStorage.setItem(key, '1');
                } catch {
                    /* private mode */
                }
            }
        };
        intro.addEventListener('click', dismiss, { once: true });
        window.setTimeout(dismiss, prefersReducedMotion() ? 1200 : 3200);
    }

    private play(payload: StageCompletePayload): void {
        if (this.summaryEl) this.summaryEl.textContent = payload.summary;
        if (!this.overlay) return;
        this.overlay.hidden = false;

        const lines = NARRATION[payload.stage] ?? [];
        if (!this.narrationEl || !this.panelEl || lines.length === 0 || prefersReducedMotion()) {
            this.showPanel();
            return;
        }

        this.panelEl.style.opacity = '0';
        this.panelEl.style.pointerEvents = 'none';
        this.narrationEl.hidden = false;

        lines.forEach((line, i) => {
            window.setTimeout(() => this.showLine(line), i * BEAT_MS);
        });
        window.setTimeout(() => {
            if (this.narrationEl) this.narrationEl.hidden = true;
            this.showPanel();
        }, lines.length * BEAT_MS + 600);
    }

    private showLine(text: string): void {
        if (!this.narrationEl) return;
        this.narrationEl.textContent = text;
        this.narrationEl.style.transition = 'none';
        this.narrationEl.style.opacity = '0';
        // Force a reflow so the fade restarts per line.
        void this.narrationEl.offsetWidth;
        this.narrationEl.style.transition = 'opacity 600ms ease';
        this.narrationEl.style.opacity = '1';
    }

    private showPanel(): void {
        if (!this.panelEl) return;
        this.panelEl.style.transition = 'opacity 600ms ease';
        this.panelEl.style.opacity = '1';
        this.panelEl.style.pointerEvents = '';
    }
}
