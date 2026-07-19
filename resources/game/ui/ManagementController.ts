import type { EventBus, ManagementUpdate, ManagementActionView, FactionView } from '../bootstrap/events';

/**
 * Renders the strategic-stage management panel (DOM) — now a status dashboard.
 * Shows resources with rates, the objective, a status card per DISCOVERED
 * rival (strength/relationship, no action buttons), a hint about rivals still
 * hidden in the fog, the Council (abstract decisions with no map home), and a
 * short activity log. Located actions and diplomacy live on the contextual
 * bottom bar (SelectionBarController); the Council buttons here still send
 * 'intent:management-action'. All text/UI lives in the DOM (brief §8).
 */
export class ManagementController {
    private root: HTMLElement;
    private lastActionsSig = '';
    private lastFactionSig = '';

    constructor(root: HTMLElement, bus: EventBus) {
        this.root = root;
        bus.on('management:update', (u) => this.render(u));

        // Delegate Council action-button clicks.
        const panel = root.querySelector<HTMLElement>('[data-management="actions"]');
        panel?.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action-id]');
            if (!btn || btn.disabled) return;
            // Anchored decisions are listed here for discoverability, but they
            // are taken on the map — clicking travels there and selects it.
            if (btn.dataset.locate) {
                bus.emit('intent:locate', { anchor: btn.dataset.locate });
            } else {
                bus.emit('intent:management-action', { actionId: btn.dataset.actionId! });
            }
        });
    }

    private el(key: string): HTMLElement | null {
        return this.root.querySelector<HTMLElement>(`[data-management="${key}"]`);
    }

    private render(u: ManagementUpdate): void {
        const title = this.el('title');
        if (title) title.textContent = u.title;
        const subtitle = this.el('subtitle');
        if (subtitle) subtitle.textContent = u.subtitle;

        const objLabel = this.el('objective-label');
        if (objLabel) objLabel.textContent = u.objectiveLabel;
        const objBar = this.el('objective-bar');
        if (objBar) objBar.style.width = `${Math.round(u.objectiveProgress * 100)}%`;
        const status = this.el('status-line');
        if (status) {
            status.textContent = u.statusLine ?? '';
            status.hidden = !u.statusLine;
        }

        const resources = this.el('resources');
        if (resources) {
            resources.replaceChildren(...u.resources.map((r) => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between text-small';
                const label = document.createElement('span');
                label.className = 'text-content-2';
                label.textContent = r.label;
                const val = document.createElement('span');
                val.className = 'font-mono text-content';
                const rate = r.perTick ? ` (${r.perTick > 0 ? '+' : ''}${r.perTick}/s)` : '';
                val.textContent = `${r.value}${rate}`;
                row.append(label, val);
                return row;
            }));
        }

        // Only rebuild action buttons when they actually change — otherwise the
        // constant re-render destroys buttons mid-hover/click.
        const actions = this.el('actions');
        const actionsSig = u.actions.map((a) => `${a.id}:${a.affordable ? 1 : 0}:${a.taken ? 1 : 0}`).join('|');
        if (actions && actionsSig !== this.lastActionsSig) {
            this.lastActionsSig = actionsSig;
            actions.replaceChildren(...u.actions.map((a) => this.actionCard(a)));
        }

        // Rival factions: a status card per discovered rival + a hidden hint.
        const facList = this.el('faction-list');
        const facSig = u.factions
            .map((f) => `${f.id}:${f.stance}:${Math.round(f.strength)}:${Math.round(f.raceProgress * 20)}`)
            .join('|') + `#${u.hiddenRivals}`;
        if (facList && facSig !== this.lastFactionSig) {
            this.lastFactionSig = facSig;
            const cards = u.factions.map((f) => this.factionCard(f));
            if (u.hiddenRivals > 0) {
                const hint = document.createElement('p');
                hint.className = 'text-small text-content-3 italic';
                hint.textContent = u.hiddenRivals === 1
                    ? 'One unknown power stirs beyond your borders — send scouts.'
                    : `${u.hiddenRivals} unknown powers stir beyond your borders — send scouts.`;
                cards.push(hint);
            }
            facList.replaceChildren(...cards);
        }

        const log = this.el('log');
        if (log) {
            log.replaceChildren(...u.log.map((line) => {
                const p = document.createElement('p');
                p.className = 'text-small text-content-3';
                p.textContent = `· ${line}`;
                return p;
            }));
        }
    }

    private stanceColor(stance: string): string {
        switch (stance) {
            case 'hostile': return 'var(--osl-accent)';
            case 'wary': return 'var(--osl-secondary)';
            case 'friendly':
            case 'allied': return 'var(--osl-success)';
            default: return 'var(--osl-text-3)';
        }
    }

    private factionCard(f: FactionView): HTMLElement {
        const card = document.createElement('div');
        card.dataset.factionId = f.id;
        card.className = 'rounded-md border border-ink-border p-3 space-y-2';

        const head = document.createElement('div');
        head.className = 'flex items-center justify-between gap-2';
        const name = document.createElement('p');
        name.className = 'font-display font-bold text-content';
        name.textContent = f.name;
        const stance = document.createElement('span');
        stance.className = 'font-mono text-label uppercase tracking-[0.06em]';
        stance.textContent = `${f.stance} · ${f.archetype}`;
        stance.style.color = this.stanceColor(f.stance);
        head.append(name, stance);
        card.append(head);

        card.append(this.meter('Strength', f.strength / 100, 'var(--osl-accent)'));
        card.append(this.meter('Their progress', f.raceProgress, 'var(--osl-secondary)'));

        const rel = document.createElement('p');
        rel.className = 'text-small text-content-3';
        rel.textContent = `Relations ${f.relationship > 0 ? '+' : ''}${f.relationship}${f.defense > 0 ? ` · guard ${f.defense}` : ''} — select on map to act`;
        card.append(rel);

        return card;
    }

    private meter(label: string, ratio: number, color: string): HTMLElement {
        const wrap = document.createElement('div');
        const lab = document.createElement('p');
        lab.className = 'font-mono text-label uppercase tracking-[0.06em] text-content-4';
        lab.textContent = label;
        const track = document.createElement('div');
        track.className = 'h-1.5 rounded-pill bg-ink-border overflow-hidden';
        const bar = document.createElement('div');
        bar.className = 'h-full rounded-pill';
        bar.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
        bar.style.background = color;
        track.append(bar);
        wrap.append(lab, track);
        return wrap;
    }

    private actionCard(a: ManagementActionView): HTMLElement {
        const card = document.createElement('button');
        card.dataset.actionId = a.id;
        card.className =
            'block w-full text-left rounded-md border border-ink-border bg-ink-2 p-3 transition duration-fast ' +
            'hover:border-brand disabled:opacity-disabled disabled:pointer-events-none';
        // A located action stays clickable even when unaffordable — going to
        // look at it is always allowed; only acting needs the resources.
        card.disabled = a.taken || (!a.affordable && !a.locate);
        if (a.locate) card.dataset.locate = a.locate;

        const top = document.createElement('div');
        top.className = 'flex items-center justify-between gap-2';
        const name = document.createElement('span');
        name.className = 'font-semibold text-small text-content';
        name.textContent = a.label;
        const cost = document.createElement('span');
        cost.className = 'font-mono text-label uppercase text-content-4';
        cost.textContent = a.taken ? 'Done' : a.costLabel;
        top.append(name, cost);

        const desc = document.createElement('p');
        desc.className = 'text-small text-content-3 mt-1';
        desc.textContent = a.description;

        card.append(top, desc);

        if (a.locationLabel) {
            const where = document.createElement('p');
            where.className = 'font-mono text-label uppercase tracking-[0.06em] text-content-4 mt-1';
            where.textContent = a.taken ? a.locationLabel : `${a.locationLabel} — go there`;
            card.append(where);
        }
        return card;
    }
}
