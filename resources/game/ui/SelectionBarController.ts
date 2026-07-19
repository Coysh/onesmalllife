import type { EventBus, SelectionView, ManagementActionView } from '../bootstrap/events';

/**
 * The contextual bottom action bar (DOM). When the player selects a map object
 * (a site, the settlement, a rival), the scene emits `management:select` with
 * that object's actions; this fills the bar. Clicking an action sends
 * `intent:management-action` — carrying the rival id for diplomacy so it
 * targets the selected power. The bar hides on `management:deselect`.
 *
 * The bar is re-emitted every sim tick to keep affordability live, so it
 * signature-checks and only rebuilds buttons when something actually changed
 * (otherwise a rebuild mid-click would swallow the press).
 */
export class SelectionBarController {
    private bar: HTMLElement | null;
    private labelEl: HTMLElement | null;
    private sublabelEl: HTMLElement | null;
    private actionsEl: HTMLElement | null;
    private current: SelectionView | null = null;
    private lastSig = '';

    constructor(root: HTMLElement, bus: EventBus) {
        this.bar = root.querySelector('[data-selection="bar"]');
        this.labelEl = root.querySelector('[data-selection="label"]');
        this.sublabelEl = root.querySelector('[data-selection="sublabel"]');
        this.actionsEl = root.querySelector('[data-selection="actions"]');

        if (this.bar) this.bar.hidden = true; // selection-driven, never mode-driven
        bus.on('management:select', (s) => this.show(s));
        bus.on('management:deselect', () => this.hide());

        root.querySelector('[data-selection="close"]')?.addEventListener('click', () => {
            // Tell the scene to clear its selection (it echoes management:deselect
            // back to hide the bar); hide locally too for instant feedback.
            bus.emit('intent:deselect', undefined);
            this.hide();
        });

        this.actionsEl?.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action-id]');
            if (!btn || btn.disabled || !this.current) return;
            bus.emit('intent:management-action', {
                actionId: btn.dataset.actionId!,
                rivalId: this.current.kind === 'rival' ? this.current.id : undefined,
            });
        });
    }

    private show(sel: SelectionView): void {
        this.current = sel;
        if (this.bar) this.bar.hidden = false;
        if (this.labelEl) this.labelEl.textContent = sel.label;
        if (this.sublabelEl) {
            this.sublabelEl.textContent = sel.sublabel ?? '';
            this.sublabelEl.hidden = !sel.sublabel;
        }

        const sig = `${sel.kind}:${sel.id}|` + sel.actions.map((a) => `${a.id}:${a.affordable ? 1 : 0}:${a.taken ? 1 : 0}`).join('|');
        if (sig === this.lastSig) return; // no visible change — leave buttons intact
        this.lastSig = sig;

        if (!this.actionsEl) return;
        if (sel.actions.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-small text-content-3 italic px-1';
            empty.textContent = 'Nothing to do here yet.';
            this.actionsEl.replaceChildren(empty);
            return;
        }
        this.actionsEl.replaceChildren(...sel.actions.map((a) => this.actionButton(a)));
    }

    private hide(): void {
        this.current = null;
        this.lastSig = '';
        if (this.bar) this.bar.hidden = true;
    }

    private actionButton(a: ManagementActionView): HTMLElement {
        const btn = document.createElement('button');
        btn.dataset.actionId = a.id;
        btn.className =
            'shrink-0 min-h-[52px] rounded-md border border-ink-border bg-ink-2 px-3 py-2 text-left ' +
            'transition duration-fast hover:border-brand disabled:opacity-disabled disabled:pointer-events-none';
        btn.disabled = a.taken || !a.affordable;

        const name = document.createElement('span');
        name.className = 'block font-semibold text-small text-content whitespace-nowrap';
        name.textContent = a.label;
        const cost = document.createElement('span');
        cost.className = 'block font-mono text-label uppercase text-content-4 whitespace-nowrap';
        cost.textContent = a.taken ? 'Done' : a.costLabel;
        btn.append(name, cost);
        btn.title = a.description;
        return btn;
    }
}
