import type { EventBus, EventView, EventOutcomeView, NoticeView } from '../bootstrap/events';

/**
 * "−10 Food · +5 Culture". Returns '' when nothing changed, so a purely
 * narrative outcome doesn't render an empty line.
 */
function formatEffects(effects: Record<string, number>, labels?: Record<string, string>): string {
    return Object.entries(effects)
        .filter(([, delta]) => delta !== 0)
        .map(([id, delta]) => {
            const name = labels?.[id] ?? id;
            return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${name}`;
        })
        .join(' · ');
}

const BUTTON_CLASS =
    'w-full min-h-[44px] rounded-md bg-brand text-[color:var(--osl-text-on-brand)] ' +
    'font-semibold text-small hover:bg-brand-hi transition duration-fast px-4';

/**
 * The event decision modal (DOM). When a strategic stage raises an event, this
 * shows the situation and its choices; the player's pick goes back as
 * 'intent:event-choice'. The modal then stays open to reveal what the decision
 * actually cost before the stage resumes — the choice is made blind, the
 * consequence is always shown.
 */
export class EventModalController {
    private overlay: HTMLElement | null;
    private iconEl: HTMLElement | null;
    private titleEl: HTMLElement | null;
    private descEl: HTMLElement | null;
    private choicesEl: HTMLElement | null;
    /** True while showing a notice, whose button closes without a choice. */
    private dismissOnly = false;

    constructor(root: HTMLElement, private bus: EventBus) {
        this.overlay = root.querySelector('[data-overlay="event"]');
        this.iconEl = root.querySelector('[data-event="icon"]');
        this.titleEl = root.querySelector('[data-event="title"]');
        this.descEl = root.querySelector('[data-event="description"]');
        this.choicesEl = root.querySelector('[data-event="choices"]');

        bus.on('event:show', (e) => this.show(e));
        bus.on('event:outcome', (o) => this.showOutcome(o));
        bus.on('notice:show', (n) => this.showNotice(n));
    }

    private show(event: EventView): void {
        this.dismissOnly = false;
        if (this.iconEl) {
            this.iconEl.textContent = event.icon ?? '❖';
            this.iconEl.hidden = false;
        }
        if (this.titleEl) this.titleEl.textContent = event.title;
        if (this.descEl) this.descEl.textContent = event.description;

        if (this.choicesEl) {
            this.choicesEl.replaceChildren(...event.choices.map((label, index) => {
                const btn = document.createElement('button');
                btn.className = BUTTON_CLASS;
                btn.textContent = label;
                btn.addEventListener('click', () => this.choose(index), { once: true });
                return btn;
            }));
        }

        if (this.overlay) this.overlay.hidden = false;
    }

    /** Replace the choices with what the decision did, plus a way onward. */
    private showOutcome(outcome: EventOutcomeView): void {
        if (this.descEl) this.descEl.textContent = outcome.note;

        if (this.choicesEl) {
            const nodes: HTMLElement[] = [];

            const deltas = formatEffects(outcome.effects, outcome.resourceLabels);
            if (deltas) {
                const line = document.createElement('p');
                line.className = 'font-mono text-label uppercase tracking-[0.06em] text-brand-hi';
                line.textContent = deltas;
                nodes.push(line);
            }

            const btn = document.createElement('button');
            btn.className = BUTTON_CLASS;
            btn.textContent = 'Continue';
            btn.addEventListener('click', () => this.dismiss(), { once: true });
            nodes.push(btn);

            this.choicesEl.replaceChildren(...nodes);
        }
    }

    /**
     * A world moment with nothing to decide — one button, and dismissing it
     * doesn't resolve an event (there is no pending decision behind it).
     */
    private showNotice(notice: NoticeView): void {
        this.show({
            title: notice.title,
            description: notice.description,
            icon: notice.icon,
            choices: ['Understood'],
        });
        this.dismissOnly = true;
    }

    private choose(index: number): void {
        if (this.dismissOnly) {
            this.dismissOnly = false;
            if (this.overlay) this.overlay.hidden = true;
            return;
        }
        // Stay open: the scene answers with 'event:outcome'.
        this.bus.emit('intent:event-choice', { index });
    }

    private dismiss(): void {
        if (this.overlay) this.overlay.hidden = true;
        this.bus.emit('intent:event-dismiss', undefined);
    }
}
