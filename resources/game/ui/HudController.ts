import type { EventBus, HudState, SaveStatus } from '../bootstrap/events';

/**
 * Binds the DOM HUD (Blade markup in game/play.blade.php) to the EventBus.
 * All HUD text lives in the DOM for crispness and accessibility (brief §8);
 * this controller only reads bus events and writes to elements by data-hud key.
 */
export class HudController {
    private root: HTMLElement;

    constructor(root: HTMLElement, private bus: EventBus) {
        this.root = root;
        bus.on('hud:update', (s) => this.render(s));
        // stage:complete is handled by TransitionController (cinematic + panel).
        bus.on('save:status', (status) => this.renderSaveStatus(status));
        bus.on('stage:failed', (p) => this.showDeath(p));
        this.wireControls();
    }

    private el(key: string): HTMLElement | null {
        return this.root.querySelector<HTMLElement>(`[data-hud="${key}"]`);
    }

    private setText(key: string, value: string): void {
        const node = this.el(key);
        if (node) node.textContent = value;
    }

    private setBar(key: string, ratio: number): void {
        const node = this.el(key);
        if (node) node.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    }

    private render(s: Partial<HudState>): void {
        if (s.species !== undefined) this.setText('species', s.species);
        if (s.stage !== undefined) this.setText('stage', s.stage);
        if (s.energyLabel !== undefined) this.setText('energy-label', s.energyLabel);
        if (s.integrityLabel !== undefined) this.setText('integrity-label', s.integrityLabel);
        if (s.evolutionLabel !== undefined) this.setText('evolution-label', s.evolutionLabel);
        if (s.energy !== undefined) {
            this.setText('energy-value', String(s.energy));
            this.setBar('energy-bar', s.energy / 100);
        }
        if (s.integrity !== undefined) {
            this.setText('integrity-value', String(s.integrity));
            this.setBar('integrity-bar', s.integrity / 100);
        }
        if (s.evolution !== undefined) this.setText('evolution-value', String(s.evolution));
        if (s.objectiveLabel !== undefined) this.setText('objective-label', s.objectiveLabel);
        if (s.objectiveProgress !== undefined) this.setBar('objective-bar', s.objectiveProgress);
        if (s.threat !== undefined) this.renderThreat(s.threat);
    }

    private renderSaveStatus(status: SaveStatus): void {
        const node = this.el('save-status');
        if (!node) return;
        const label = status === 'saving' ? 'Saving…' : status === 'error' ? 'Save failed' : 'Saved';
        node.textContent = label;
        node.style.color = status === 'error' ? 'var(--osl-accent)' : 'var(--osl-text-3)';
    }

    private showDeath(p: { title: string; summary: string }): void {
        const overlay = this.root.querySelector<HTMLElement>('[data-overlay="death"]');
        const title = this.root.querySelector<HTMLElement>('[data-death="title"]');
        const summary = this.root.querySelector<HTMLElement>('[data-death="summary"]');
        if (title) title.textContent = p.title;
        if (summary) summary.textContent = p.summary;
        if (overlay) overlay.hidden = false;
    }

    private renderThreat(threat: string | null): void {
        const node = this.el('threat');
        if (!node) return;
        if (threat) {
            node.textContent = threat;
            node.hidden = false;
        } else {
            node.hidden = true;
        }
    }

    private wireControls(): void {
        const pauseBtn = this.root.querySelector<HTMLButtonElement>('[data-action="pause"]');
        const overlay = this.root.querySelector<HTMLElement>('[data-overlay="pause"]');
        let paused = false;
        const setPaused = (next: boolean) => {
            paused = next;
            this.bus.emit(paused ? 'intent:pause' : 'intent:resume', undefined);
            if (overlay) overlay.hidden = !paused;
            if (pauseBtn) pauseBtn.setAttribute('aria-pressed', String(paused));
        };
        pauseBtn?.addEventListener('click', () => setPaused(!paused));
        this.root.querySelector('[data-action="resume"]')?.addEventListener('click', () => setPaused(false));

        this.root.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
            const overlay = this.root.querySelector<HTMLElement>('[data-overlay="death"]');
            if (overlay) overlay.hidden = true;
            this.bus.emit('intent:retry', undefined);
        });

        this.root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.bus.emit('intent:zoom', { delta: Number(btn.dataset.zoom) });
            });
        });

        this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const multiplier = Number(btn.dataset.speed);
                this.bus.emit('intent:set-speed', { multiplier });
                this.root.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
                btn.setAttribute('aria-pressed', 'true');
            });
        });
    }

}
