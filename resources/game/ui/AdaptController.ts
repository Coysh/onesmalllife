import type { EventBus } from '../bootstrap/events';

/**
 * The Creature-stage "shape your creature" prompt (DOM). After the diet choice,
 * the scene offers a handful of adaptations and this renders them as cards; the
 * pick goes back as `intent:choose-adaptation`. The scene holds the sim until
 * one is chosen, the same way the diet prompt does.
 */
export class AdaptController {
    constructor(root: HTMLElement, bus: EventBus) {
        const overlay = root.querySelector<HTMLElement>('[data-overlay="adapt"]');
        const list = root.querySelector<HTMLElement>('[data-adapt="options"]');

        bus.on('creature:choose-adaptation', ({ options }) => {
            if (!overlay || !list) return;

            list.replaceChildren(...options.map((opt) => {
                const btn = document.createElement('button');
                btn.dataset.adaptId = opt.id;
                btn.className =
                    'text-left rounded-lg border border-ink-border p-5 hover:border-brand transition duration-fast';

                const name = document.createElement('p');
                name.className = 'font-display font-bold text-h3 text-content mb-1';
                name.textContent = opt.name;

                const desc = document.createElement('p');
                desc.className = 'text-small text-content-2';
                desc.textContent = opt.description;

                btn.append(name, desc);
                btn.addEventListener('click', () => {
                    overlay.hidden = true;
                    bus.emit('intent:choose-adaptation', { traitId: opt.id });
                }, { once: true });
                return btn;
            }));

            overlay.hidden = false;
        });
    }
}
