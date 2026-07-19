import type { EventBus } from '../bootstrap/events';

/**
 * The Creature-stage diet prompt (DOM). When the stage starts without a saved
 * choice, the scene emits `creature:choose-diet` and this shows the overlay;
 * the player's pick goes back as `intent:choose-diet` and the overlay closes.
 * The scene holds the sim until a choice is made.
 */
export class DietController {
    constructor(root: HTMLElement, bus: EventBus) {
        const overlay = root.querySelector<HTMLElement>('[data-overlay="diet"]');

        bus.on('creature:choose-diet', () => {
            if (overlay) overlay.hidden = false;
        });

        overlay?.querySelectorAll<HTMLButtonElement>('[data-diet]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const diet = btn.dataset.diet === 'carnivore' ? 'carnivore' : 'herbivore';
                overlay.hidden = true;
                bus.emit('intent:choose-diet', { diet });
            });
        });
    }
}
