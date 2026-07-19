import type { EventBus } from '../bootstrap/events';

/**
 * Playtesting toolbar (DOM). The buttons are rendered by Blade ONLY in the
 * local environment; this controller just forwards clicks onto the bus:
 * hyper speed, grant resources, complete the current objective. Combined with
 * the dev-only ?stage= jump, a full run can be tested in a couple of minutes.
 */
export class DevToolsController {
    constructor(root: HTMLElement, bus: EventBus) {
        const bar = root.querySelector<HTMLElement>('[data-devtools]');
        if (!bar) return;

        bar.querySelector('[data-dev="speed"]')?.addEventListener('click', () => {
            bus.emit('intent:set-speed', { multiplier: 16 });
        });
        bar.querySelector('[data-dev="grant"]')?.addEventListener('click', () => {
            bus.emit('intent:dev-grant', undefined);
        });
        bar.querySelector('[data-dev="complete"]')?.addEventListener('click', () => {
            bus.emit('intent:dev-complete', undefined);
        });
        bar.querySelector('[data-dev="die"]')?.addEventListener('click', () => {
            bus.emit('intent:dev-die', undefined);
        });
    }
}
