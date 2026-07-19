import type { EventBus, OnboardingView } from '../bootstrap/events';

/**
 * First-time stage explanations (DOM). When a strategic stage starts, the
 * scene emits its onboarding steps; this shows them one at a time as
 * dismissible coach cards. Seen-state is remembered client-side per stage so
 * returning players aren't re-taught.
 */
export class OnboardingController {
    private overlay: HTMLElement | null;
    private titleEl: HTMLElement | null;
    private textEl: HTMLElement | null;
    private nextBtn: HTMLElement | null;
    private stepEl: HTMLElement | null;
    private steps: OnboardingView['steps'] = [];
    private index = 0;
    private storageKey = '';

    constructor(root: HTMLElement, bus: EventBus) {
        this.overlay = root.querySelector('[data-overlay="onboarding"]');
        this.titleEl = root.querySelector('[data-onboarding="title"]');
        this.textEl = root.querySelector('[data-onboarding="text"]');
        this.stepEl = root.querySelector('[data-onboarding="step"]');
        this.nextBtn = root.querySelector('[data-onboarding="next"]');

        this.nextBtn?.addEventListener('click', () => this.advance());
        root.querySelector('[data-onboarding="skip"]')?.addEventListener('click', () => this.finish());

        bus.on('onboarding:show', (view) => this.show(view));
    }

    private seen(): boolean {
        try {
            return localStorage.getItem(this.storageKey) === '1';
        } catch {
            return true; // storage unavailable → never nag repeatedly
        }
    }

    private show(view: OnboardingView): void {
        this.storageKey = `osl-onboarded-${view.stageId}`;
        if (!this.overlay || view.steps.length === 0 || this.seen()) return;
        this.steps = view.steps;
        this.index = 0;
        this.render();
        this.overlay.hidden = false;
    }

    private render(): void {
        const step = this.steps[this.index];
        if (!step) return;
        if (this.titleEl) this.titleEl.textContent = step.title;
        if (this.textEl) this.textEl.textContent = step.text;
        if (this.stepEl) this.stepEl.textContent = `${this.index + 1} / ${this.steps.length}`;
        if (this.nextBtn) this.nextBtn.textContent = this.index === this.steps.length - 1 ? 'Begin' : 'Next';
    }

    private advance(): void {
        this.index += 1;
        if (this.index >= this.steps.length) {
            this.finish();
            return;
        }
        this.render();
    }

    private finish(): void {
        if (this.overlay) this.overlay.hidden = true;
        try {
            localStorage.setItem(this.storageKey, '1');
        } catch {
            /* private mode */
        }
    }
}
