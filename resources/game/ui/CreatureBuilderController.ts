import { CREATURE_PARTS, CREATURE_PART_SLOTS, type CreaturePartSlot } from '../data/creature-parts';
import type { CreatureBuildView, EventBus } from '../bootstrap/events';

/** DOM-only bounded Stage 2 build editor. Gameplay remains in CreatureScene. */
export class CreatureBuilderController {
    private overlay: HTMLElement | null;
    private build: CreatureBuildView | null = null;
    private selected: Record<CreaturePartSlot, string> = { locomotion: 'steady-legs', feeding: 'grazing-jaws', adaptation: 'watchful-senses' };

    constructor(private root: HTMLElement, private bus: EventBus) {
        this.overlay = root.querySelector('[data-overlay="creature-builder"]');
        bus.on('creature:build', ({ build }) => this.show(build));
    }

    private show(build: CreatureBuildView): void {
        this.build = build;
        this.selected = { ...build.equipped };
        this.render();
        if (this.overlay) this.overlay.hidden = false;
        const traits = this.root.querySelector<HTMLElement>('[data-overlay="traits"]');
        if (traits) traits.hidden = true;
        const trigger = this.root.querySelector<HTMLButtonElement>('[data-action="open-traits"]');
        if (trigger) trigger.textContent = 'Creature';
        this.bus.emit('intent:pause-change', { source: 'creature-builder', paused: true });
    }

    private render(): void {
        const slots = this.root.querySelector<HTMLElement>('[data-creature="slots"]');
        if (!slots || !this.build) return;
        slots.replaceChildren(...CREATURE_PART_SLOTS.map((slot) => {
            const section = document.createElement('section');
            const heading = document.createElement('h3');
            heading.className = 'font-mono text-label uppercase tracking-[.06em] text-content-4 mb-2';
            heading.textContent = slot;
            section.append(heading);
            const choices = document.createElement('div');
            choices.className = 'grid gap-2 sm:grid-cols-2';
            for (const part of CREATURE_PARTS.filter((candidate) => candidate.slot === slot && this.build!.unlocked.includes(candidate.id))) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `rounded-md border p-3 text-left transition ${this.selected[slot] === part.id ? 'border-brand bg-ink-surface2' : 'border-ink-border hover:border-brand'}`;
                button.innerHTML = `<strong class="block text-small">${part.name}</strong><span class="block mt-1 text-tooltip text-content-3">${part.description}</span>`;
                button.addEventListener('click', () => { this.selected[slot] = part.id; this.render(); });
                choices.append(button);
            }
            section.append(choices);
            return section;
        }));
        const confirm = this.root.querySelector<HTMLButtonElement>('[data-action="confirm-creature-build"]');
        confirm?.replaceWith(confirm.cloneNode(true));
        this.root.querySelector<HTMLButtonElement>('[data-action="confirm-creature-build"]')?.addEventListener('click', () => this.confirm());
    }

    private confirm(): void {
        if (!this.build) return;
        const build: CreatureBuildView = { ...this.build, equipped: { ...this.selected } };
        if (this.overlay) this.overlay.hidden = true;
        this.bus.emit('intent:pause-change', { source: 'creature-builder', paused: false });
        this.bus.emit('intent:creature-build', { build });
    }
}
