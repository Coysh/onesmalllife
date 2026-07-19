import type { EventBus, TraitEntry, TraitsUpdate } from '../bootstrap/events';

/**
 * The evolution drawer (DOM). Lists Cell-stage traits with their category, cost,
 * benefits/costs and current state, and lets the player spend banked evolution
 * points. All text lives in the DOM (brief §8); state comes from 'traits:update'
 * and choices go back as 'intent:acquire-trait'. Colour is always paired with a
 * state word (brief §14/§26 — never colour alone).
 */
export class TraitDrawerController {
    private list: HTMLElement | null;
    private badge: HTMLElement | null;
    private panel: HTMLElement | null;

    private categoryColor: Record<string, string> = {
        biological: 'var(--osl-trait-bio)',
        behavioural: 'var(--osl-trait-behaviour)',
        cultural: 'var(--osl-trait-cultural)',
        technological: 'var(--osl-trait-tech)',
    };

    private stateLabel: Record<string, string> = {
        available: 'Available',
        selected: 'Equipped',
        upgradable: 'Upgrade',
        new: 'New',
        locked: 'Locked',
        blocked: 'Blocked',
        inherited: 'Inherited',
    };

    constructor(root: HTMLElement, private bus: EventBus) {
        this.list = root.querySelector('[data-traits="list"]');
        this.badge = root.querySelector('[data-traits="badge"]');
        this.panel = root.querySelector('[data-overlay="traits"]');

        root.querySelector('[data-action="open-traits"]')?.addEventListener('click', () => this.toggle(true));
        root.querySelector('[data-action="close-traits"]')?.addEventListener('click', () => this.toggle(false));

        bus.on('traits:update', (u) => this.render(u));
    }

    private toggle(open: boolean): void {
        if (this.panel) this.panel.hidden = !open;
    }

    private render(update: TraitsUpdate): void {
        if (this.badge) this.badge.textContent = String(update.evolution);
        if (!this.list) return;
        this.list.replaceChildren(...update.entries.map((e) => this.card(e)));
    }

    private card(e: TraitEntry): HTMLElement {
        const card = document.createElement('div');
        card.className = 'rounded-md border border-ink-border bg-ink-2 p-4';
        card.style.borderTopColor = this.categoryColor[e.category] ?? 'var(--osl-border)';
        card.style.borderTopWidth = '3px';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between gap-2 mb-1';

        const name = document.createElement('p');
        name.className = 'font-display font-bold text-content';
        name.textContent = e.name;

        const right = document.createElement('span');
        right.className = 'flex items-center gap-2 flex-none';
        // rarity pips
        const rarityCount = { common: 1, uncommon: 2, rare: 3, legendary: 4 }[e.rarity] ?? 1;
        const pips = document.createElement('span');
        pips.className = 'flex gap-0.5';
        pips.setAttribute('title', `${e.rarity} trait`);
        for (let i = 0; i < 4; i++) {
            const pip = document.createElement('span');
            pip.className = 'inline-block h-1.5 w-1.5 rounded-full';
            pip.style.background = i < rarityCount ? this.categoryColor[e.category] ?? 'var(--osl-brand)' : 'var(--osl-border)';
            pips.append(pip);
        }
        const stateTag = document.createElement('span');
        stateTag.className = 'font-mono text-label uppercase tracking-[0.06em] text-content-3';
        stateTag.textContent = this.stateLabel[e.state] ?? e.state;
        right.append(pips, stateTag);
        header.append(name, right);

        const desc = document.createElement('p');
        desc.className = 'text-small text-content-2 mb-2';
        desc.textContent = e.description;

        const chips = document.createElement('p');
        chips.className = 'text-small text-content-3 mb-3';
        const benefit = e.benefits.length ? `+ ${e.benefits.join(', ')}` : '';
        const cost = e.costs.length ? `  · − ${e.costs.join(', ')}` : '';
        chips.textContent = benefit + cost;

        const action = document.createElement('button');
        action.className =
            'w-full min-h-[40px] rounded-sm font-semibold text-small transition duration-fast disabled:opacity-disabled disabled:pointer-events-none';

        if (e.state === 'selected' || e.state === 'inherited') {
            action.textContent = e.state === 'inherited' ? '∞ Permanent' : '✓ Equipped';
            action.className += ' bg-transparent border border-ink-border text-content-3';
            action.disabled = true;
        } else if (e.state === 'locked') {
            action.textContent = '🔒 Locked';
            action.className += ' bg-transparent border border-ink-border text-content-4';
            action.disabled = true;
        } else if (e.state === 'blocked') {
            action.textContent = '✕ Blocked';
            action.className += ' bg-[color:var(--osl-bg-2)] text-[color:var(--osl-accent)]';
            action.disabled = true;
        } else {
            action.textContent = `Evolve · ${e.cost} pts`;
            action.className += ' bg-brand text-[color:var(--osl-text-on-brand)] hover:bg-brand-hi';
            action.disabled = !e.affordable;
            action.addEventListener('click', () => this.bus.emit('intent:acquire-trait', { traitId: e.id }));
        }

        card.append(header, desc, chips);

        if (e.leadsTo.length > 0) {
            const leads = document.createElement('p');
            leads.className = 'text-small text-[color:var(--osl-info)] mb-3 pl-2 border-l-2 border-[color:var(--osl-info)]';
            leads.textContent = `Leads to → ${e.leadsTo.join(', ')}`;
            card.append(leads);
        }

        card.append(action);
        return card;
    }
}
