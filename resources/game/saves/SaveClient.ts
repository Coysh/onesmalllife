import type { EventBus, SaveSnapshot } from '../bootstrap/events';

/**
 * Posts campaign state to the server at safe points. The server owns
 * persistence and re-validates everything (brief §22); this only assembles the
 * payload from the loaded base state plus the latest in-world snapshot.
 */
export class SaveClient {
    private inFlight = false;
    private pending = false;
    private lastSaveMs = performance.now();

    constructor(
        private url: string,
        private csrfToken: string,
        private baseState: Record<string, unknown>,
        private bus: EventBus,
    ) {
        bus.on('save:snapshot', (snap) => this.save(snap));
    }

    private buildPayload(snap: SaveSnapshot): Record<string, unknown> {
        const progress = {
            ...(this.baseState.progress as object),
            currentStage: snap.stage,
            completed: snap.completed,
        };
        const traits = {
            ...(this.baseState.traits as object),
            active: snap.traits,
        };
        const state = {
            ...this.baseState,
            progress,
            traits,
            resources: snap.resources,
        };

        // Seconds played since the last save — the server accumulates this.
        const now = performance.now();
        const sessionSeconds = Math.max(0, Math.round((now - this.lastSaveMs) / 1000));
        this.lastSaveMs = now;

        return { state, session_seconds: sessionSeconds };
    }

    private async save(snap: SaveSnapshot): Promise<void> {
        // Coalesce: if a save is in flight, remember to run once more after.
        if (this.inFlight) {
            this.pending = true;
            return;
        }
        this.inFlight = true;
        this.bus.emit('save:status', 'saving');

        try {
            const res = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': this.csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify(this.buildPayload(snap)),
            });
            this.bus.emit('save:status', res.ok ? 'saved' : 'error');
        } catch {
            this.bus.emit('save:status', 'error');
        } finally {
            this.inFlight = false;
            if (this.pending) {
                this.pending = false;
                this.save(snap);
            }
        }
    }
}
