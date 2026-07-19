import type { EventBus } from '../bootstrap/events';
import { loadSettings, type Settings } from '../settings/settings';

/**
 * Synthesised sound effects and ambient music via the Web Audio API — no audio
 * files, so nothing unlicensed ships. Volumes come from the player's settings
 * (master × effects for SFX, master × music for the bed, respecting mute).
 *
 * Each stage gets its own evolving ambient bed (a soft, detuned oscillator
 * chord with slow filter/LFO movement); beds cross-fade when the stage changes.
 * The context starts on the first user gesture (browsers block autoplay).
 */
interface Preset {
    freqs: number[];
    type: OscillatorType;
    dur: number;
    gain: number;
    slide?: number; // end-frequency multiplier
    detune?: number; // cents of second-voice detune for a fatter tone
}

const PRESETS: Record<string, Preset> = {
    // Feeding — a bright, quick upward blip.
    absorb: { freqs: [523, 784], type: 'triangle', dur: 0.12, gain: 0.5, slide: 1.25, detune: 6 },
    // A richer feed — a shimmering major triad arpeggio.
    'absorb-rich': { freqs: [523, 659, 988, 1319], type: 'triangle', dur: 0.2, gain: 0.55, detune: 5 },
    // Damage — a gritty descending thud.
    hit: { freqs: [160, 90], type: 'sawtooth', dur: 0.16, gain: 0.5, slide: 0.5 },
    // Tier-up / growth — a rising, resolving chord that feels like levelling up.
    evolve: { freqs: [392, 523, 659, 784], type: 'triangle', dur: 0.42, gain: 0.5, slide: 1.5, detune: 7 },
    // Stage clear — a fuller ascending fanfare.
    complete: { freqs: [523, 659, 784, 1046, 1319], type: 'triangle', dur: 0.55, gain: 0.5, detune: 6 },
    // Distinct descending death sting (played on stage:failed).
    death: { freqs: [330, 262, 196, 131], type: 'sawtooth', dur: 0.6, gain: 0.42, slide: 0.9 },
    // UI tick — a soft, short click.
    click: { freqs: [720], type: 'sine', dur: 0.05, gain: 0.3 },
    // Narrative event — a gentle two-note chime.
    event: { freqs: [587, 880], type: 'sine', dur: 0.26, gain: 0.45, slide: 1.02 },
    // Kin joins — a warm rising pair.
    kin: { freqs: [659, 988], type: 'triangle', dur: 0.18, gain: 0.4, slide: 1.12, detune: 5 },
    // Save confirmed — a tiny high blip.
    save: { freqs: [1046], type: 'sine', dur: 0.05, gain: 0.16 },
};

type StageKey = 'cell' | 'creature' | 'tribe' | 'civilisation' | 'planetary' | 'space';

/** A voice within an ambient bed. */
interface BedVoice {
    freq: number;
    detune: number; // cents
    type: OscillatorType;
    gain: number; // relative mix (0..1)
}

interface BedSpec {
    voices: BedVoice[];
    filter: number; // base low-pass cutoff (Hz)
    lfoRate: number; // filter-sweep speed (Hz)
    lfoDepth: number; // filter-sweep depth (Hz)
    wobble: number; // per-voice pitch-LFO depth (cents)
    /**
     * Sparse melodic notes drifting over the pad. A sustained chord alone reads
     * as repetitive however slowly it moves, because nothing ever changes;
     * these give the bed a foreground that never repeats the same way twice.
     */
    motif: number[]; // candidate frequencies (Hz)
    motifGap: [number, number]; // min/max seconds between notes
}

// Per-stage moods. Kept intentionally soft and consonant.
const BEDS: Record<StageKey, BedSpec> = {
    // Warm, primordial, low — a single low drone with a fifth above.
    cell: {
        voices: [
            { freq: 65.41, detune: 0, type: 'sine', gain: 1.0 }, // C2
            { freq: 98.0, detune: 4, type: 'sine', gain: 0.6 }, // G2
            { freq: 130.81, detune: -5, type: 'triangle', gain: 0.35 }, // C3
        ],
        filter: 430,
        lfoRate: 0.05,
        lfoDepth: 120,
        wobble: 4,
        motif: [261.63, 311.13, 392.0, 466.16, 523.25],
        motifGap: [7, 15],
    },
    // Organic, hopeful — a bright major triad, gently moving.
    creature: {
        voices: [
            { freq: 98.0, detune: 0, type: 'sine', gain: 0.9 }, // G2
            { freq: 146.83, detune: 5, type: 'triangle', gain: 0.55 }, // D3
            { freq: 185.0, detune: -6, type: 'triangle', gain: 0.4 }, // F#3
            { freq: 246.94, detune: 4, type: 'sine', gain: 0.3 }, // B3
        ],
        filter: 620,
        lfoRate: 0.08,
        lfoDepth: 200,
        wobble: 6,
        motif: [293.66, 349.23, 440.0, 493.88, 587.33],
        motifGap: [6, 13],
    },
    // Earthy, with rhythmic hints — a suspended, open voicing plus a slow pulse.
    tribe: {
        voices: [
            { freq: 73.42, detune: 0, type: 'triangle', gain: 0.95 }, // D2
            { freq: 110.0, detune: 6, type: 'triangle', gain: 0.55 }, // A2
            { freq: 164.81, detune: -6, type: 'sine', gain: 0.4 }, // E3
            { freq: 220.0, detune: 8, type: 'sine', gain: 0.28 }, // A3
        ],
        filter: 600,
        lfoRate: 0.28, // faster sweep reads as a gentle rhythmic pulse
        lfoDepth: 260,
        wobble: 7,
        motif: [293.66, 329.63, 440.0, 587.33, 659.25],
        motifGap: [6, 12],
    },
    // Fuller, brighter harmony — a rich add-9 chord.
    civilisation: {
        voices: [
            { freq: 87.31, detune: 0, type: 'sine', gain: 0.85 }, // F2
            { freq: 130.81, detune: 5, type: 'triangle', gain: 0.55 }, // C3
            { freq: 174.61, detune: -6, type: 'triangle', gain: 0.45 }, // F3
            { freq: 261.63, detune: 6, type: 'sine', gain: 0.35 }, // C4
            { freq: 329.63, detune: -4, type: 'sine', gain: 0.25 }, // E4
        ],
        filter: 820,
        lfoRate: 0.1,
        lfoDepth: 260,
        wobble: 5,
        motif: [349.23, 392.0, 523.25, 587.33, 698.46],
        motifGap: [5, 11],
    },
    // Wide, airy — high, open voicing with slow shimmer.
    planetary: {
        voices: [
            { freq: 130.81, detune: 0, type: 'sine', gain: 0.7 }, // C3
            { freq: 196.0, detune: 7, type: 'sine', gain: 0.55 }, // G3
            { freq: 293.66, detune: -7, type: 'triangle', gain: 0.4 }, // D4
            { freq: 392.0, detune: 8, type: 'sine', gain: 0.3 }, // G4
        ],
        filter: 980,
        lfoRate: 0.06,
        lfoDepth: 340,
        wobble: 8,
        motif: [392.0, 440.0, 587.33, 659.25, 783.99],
        motifGap: [5, 11],
    },
    // Sparse, vast, shimmering — very high, thin voices with wide, slow movement.
    space: {
        voices: [
            { freq: 55.0, detune: 0, type: 'sine', gain: 0.6 }, // A1 — distant sub
            { freq: 220.0, detune: 9, type: 'sine', gain: 0.45 }, // A3
            { freq: 329.63, detune: -9, type: 'triangle', gain: 0.32 }, // E4
            { freq: 493.88, detune: 10, type: 'sine', gain: 0.24 }, // B4
        ],
        filter: 1180,
        lfoRate: 0.035,
        lfoDepth: 420,
        wobble: 10,
        motif: [440.0, 523.25, 659.25, 880.0, 987.77],
        motifGap: [6, 14],
    },
};

/** Live nodes for one ambient bed, so it can be torn down on cross-fade. */
interface Bed {
    key: StageKey;
    out: GainNode; // this bed's master; cross-faded
    filter: BiquadFilterNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
    oscs: OscillatorNode[];
    wobbles: OscillatorNode[];
    wobbleGains: GainNode[];
    /** Timer for the next drifting melodic note; cleared on teardown. */
    motifTimer: number | null;
}

const CROSSFADE = 1.5; // seconds

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private musicBus: GainNode | null = null; // all beds route through here
    private bed: Bed | null = null;
    private stage: StageKey = 'cell';
    private started = false;
    private settings: Settings;

    constructor(bus: EventBus) {
        this.settings = loadSettings();
        bus.on('sfx', ({ name }) => this.play(name));
        bus.on('save:status', (s) => {
            if (s === 'saved') this.play('save');
        });
        bus.on('hud:update', (state) => {
            if (state.stage) this.setStage(state.stage);
        });
        bus.on('stage:failed', () => this.play('death'));
        bus.on('stage:complete', () => this.play('complete'));
        window.addEventListener('osl:settings', (e) => {
            this.settings = (e as CustomEvent<Settings>).detail;
            this.applyVolumes();
        });
    }

    /** Call from a user gesture to unlock audio. */
    unlock(): void {
        this.ensure();
        if (this.ctx?.state === 'suspended') void this.ctx.resume();
        this.startMusic();
    }

    private ensure(): void {
        if (this.ctx) return;
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        try {
            this.ctx = new Ctor();
        } catch {
            this.ctx = null;
            return;
        }
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 1;
        this.musicBus.connect(this.master);
        this.applyVolumes();
    }

    private effectsGain(): number {
        if (this.settings.muted) return 0;
        return (this.settings.master / 100) * (this.settings.effects / 100);
    }

    private applyVolumes(): void {
        if (!this.ctx) return;
        if (this.master) this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master / 100, this.ctx.currentTime, 0.05);
        if (this.musicBus) this.musicBus.gain.setTargetAtTime((this.settings.muted ? 0 : (this.settings.music / 100)) * 0.09, this.ctx.currentTime, 0.3);
    }

    /** Map a HUD stage string ("Stage 3 · Tribe") to a bed key. */
    private stageKeyFor(label: string): StageKey {
        const lower = label.toLowerCase();
        if (lower.includes('cell')) return 'cell';
        if (lower.includes('creature')) return 'creature';
        if (lower.includes('tribe')) return 'tribe';
        if (lower.includes('civilis') || lower.includes('civiliz')) return 'civilisation';
        if (lower.includes('planet')) return 'planetary';
        if (lower.includes('space') || lower.includes('cosmic') || lower.includes('star')) return 'space';
        const m = lower.match(/stage\s*(\d)/);
        if (m) {
            const byNum: Record<string, StageKey> = { '1': 'cell', '2': 'creature', '3': 'tribe', '4': 'civilisation', '5': 'planetary', '6': 'space' };
            return byNum[m[1]] ?? 'cell';
        }
        return 'cell';
    }

    private setStage(label: string): void {
        const key = this.stageKeyFor(label);
        if (key === this.stage) return;
        this.stage = key;
        if (this.started) this.crossfadeTo(key);
    }

    private startMusic(): void {
        if (!this.ctx || !this.musicBus || this.started) return;
        this.started = true;
        this.bed = this.buildBed(this.stage, 0);
        // Fade the first bed in.
        this.bed.out.gain.setTargetAtTime(1, this.ctx.currentTime, CROSSFADE / 2);
    }

    private crossfadeTo(key: StageKey): void {
        if (!this.ctx || !this.musicBus) return;
        const now = this.ctx.currentTime;
        const old = this.bed;
        if (old) {
            old.out.gain.cancelScheduledValues(now);
            old.out.gain.setValueAtTime(old.out.gain.value, now);
            old.out.gain.linearRampToValueAtTime(0, now + CROSSFADE);
            this.teardownBed(old, now + CROSSFADE + 0.1);
        }
        const next = this.buildBed(key, 0);
        next.out.gain.setValueAtTime(0, now);
        next.out.gain.linearRampToValueAtTime(1, now + CROSSFADE);
        this.bed = next;
    }

    private buildBed(key: StageKey, startGain: number): Bed {
        const ctx = this.ctx!;
        const spec = BEDS[key];
        const now = ctx.currentTime;

        const out = ctx.createGain();
        out.gain.value = startGain;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = spec.filter;
        filter.Q.value = 0.7;
        filter.connect(out);
        out.connect(this.musicBus!);

        // Slow filter sweep for gentle movement.
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = spec.lfoRate;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = spec.lfoDepth;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start();

        const oscs: OscillatorNode[] = [];
        const wobbles: OscillatorNode[] = [];
        const wobbleGains: GainNode[] = [];

        spec.voices.forEach((v, i) => {
            const osc = ctx.createOscillator();
            osc.type = v.type;
            osc.frequency.value = v.freq;
            osc.detune.value = v.detune;

            const g = ctx.createGain();
            g.gain.value = v.gain;
            osc.connect(g).connect(filter);
            osc.start();
            oscs.push(osc);

            // Per-voice slow pitch wobble for a living, breathing pad.
            const wob = ctx.createOscillator();
            wob.type = 'sine';
            wob.frequency.value = spec.lfoRate * (0.6 + i * 0.17);
            const wg = ctx.createGain();
            wg.gain.value = spec.wobble;
            wob.connect(wg).connect(osc.detune);
            wob.start(now);
            wobbles.push(wob);
            wobbleGains.push(wg);
        });

        const bed: Bed = { key, out, filter, lfo, lfoGain, oscs, wobbles, wobbleGains, motifTimer: null };
        this.scheduleMotif(bed, spec);
        return bed;
    }

    /**
     * Play one soft bell tone from the stage's scale, then queue the next at a
     * random distance. Notes route through the bed's own gain so they cross-fade
     * and mute with it.
     */
    private scheduleMotif(bed: Bed, spec: BedSpec): void {
        const [minGap, maxGap] = spec.motifGap;
        const delay = (minGap + Math.random() * (maxGap - minGap)) * 1000;
        bed.motifTimer = window.setTimeout(() => {
            const ctx = this.ctx;
            // The bed may have been torn down while this was pending.
            if (!ctx || this.bed !== bed) return;

            const now = ctx.currentTime;
            const freq = spec.motif[Math.floor(Math.random() * spec.motif.length)];
            const dur = 2.6 + Math.random() * 1.8;

            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.detune.value = (Math.random() - 0.5) * 12;

            // Long, gentle swell and decay — never a percussive hit.
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.16, now + dur * 0.35);
            g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

            osc.connect(g).connect(bed.out);
            osc.start(now);
            osc.stop(now + dur + 0.05);

            this.scheduleMotif(bed, spec);
        }, delay);
    }

    private teardownBed(bed: Bed, at: number): void {
        const stopAt = Math.max(at, (this.ctx?.currentTime ?? 0));
        if (bed.motifTimer !== null) {
            window.clearTimeout(bed.motifTimer);
            bed.motifTimer = null;
        }
        try {
            bed.lfo.stop(stopAt);
            bed.oscs.forEach((o) => o.stop(stopAt));
            bed.wobbles.forEach((o) => o.stop(stopAt));
        } catch {
            /* already stopped */
        }
        // Disconnect once the tail has elapsed, so nodes can be GC'd.
        const delayMs = Math.max(0, (stopAt - (this.ctx?.currentTime ?? 0)) * 1000) + 200;
        setTimeout(() => {
            try {
                bed.oscs.forEach((o) => o.disconnect());
                bed.wobbles.forEach((o) => o.disconnect());
                bed.wobbleGains.forEach((g) => g.disconnect());
                bed.lfo.disconnect();
                bed.lfoGain.disconnect();
                bed.filter.disconnect();
                bed.out.disconnect();
            } catch {
                /* noop */
            }
        }, delayMs);
    }

    private play(name: string): void {
        this.ensure();
        if (!this.ctx || !this.master) return;
        const preset = PRESETS[name] ?? PRESETS.click;
        const level = this.effectsGain();
        if (level <= 0) return;

        const now = this.ctx.currentTime;
        preset.freqs.forEach((freq, i) => {
            const t = now + i * (preset.dur * 0.4);
            const g = this.ctx!.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(preset.gain * level, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + preset.dur);
            g.connect(this.master!);

            // Main voice (plus an optional detuned twin for a fuller timbre).
            const voices = preset.detune ? [0, preset.detune] : [0];
            voices.forEach((cents) => {
                const osc = this.ctx!.createOscillator();
                osc.type = preset.type;
                osc.detune.value = cents;
                osc.frequency.setValueAtTime(freq, t);
                if (preset.slide) osc.frequency.exponentialRampToValueAtTime(freq * preset.slide, t + preset.dur);
                osc.connect(g);
                osc.start(t);
                osc.stop(t + preset.dur + 0.02);
            });
        });
    }
}
