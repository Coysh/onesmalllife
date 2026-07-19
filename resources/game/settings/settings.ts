/**
 * Player settings, persisted to localStorage and applied on every page so the
 * choices hold across the whole app (brief §26). Display/Access settings apply
 * here; audio volumes are read by the audio system via the 'osl:settings' event.
 */

export interface Settings {
    reduceMotion: boolean;
    colourBlind: boolean;
    highContrast: boolean;
    textSize: 'small' | 'normal' | 'large';
    uiScale: number; // 90..130 (%)
    master: number; // 0..100
    music: number;
    effects: number;
    muted: boolean;
}

const KEY = 'osl:settings';

export const DEFAULT_SETTINGS: Settings = {
    reduceMotion: false,
    colourBlind: true, // on by default (accessibility-first, per the handoff)
    highContrast: false,
    textSize: 'normal',
    uiScale: 100,
    master: 80,
    music: 55,
    effects: 80,
    muted: false,
};

export function loadSettings(): Settings {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(s: Settings): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
        /* storage unavailable — settings apply for this session only */
    }
}

export function applySettings(s: Settings): void {
    const html = document.documentElement;
    html.classList.toggle('osl-reduce-motion', s.reduceMotion);
    html.classList.toggle('osl-cb', s.colourBlind);
    html.classList.toggle('osl-contrast', s.highContrast);

    const textFactor = s.textSize === 'small' ? 0.95 : s.textSize === 'large' ? 1.12 : 1;
    // `zoom` scales layout cleanly across browsers and combines UI scale + text size.
    (document.body.style as CSSStyleDeclaration & { zoom?: string }).zoom = String((s.uiScale / 100) * textFactor);

    window.dispatchEvent(new CustomEvent<Settings>('osl:settings', { detail: s }));
}

/** Wire any settings form on the page (inputs tagged with data-setting). */
function wireForm(state: Settings): void {
    const form = document.querySelector<HTMLElement>('[data-settings-form]');
    if (!form) return;

    const commit = () => {
        saveSettings(state);
        applySettings(state);
    };

    form.querySelectorAll<HTMLInputElement>('input[data-setting]').forEach((input) => {
        const key = input.dataset.setting as keyof Settings;
        if (input.type === 'checkbox') {
            input.checked = Boolean(state[key]);
            input.addEventListener('change', () => {
                (state[key] as boolean) = input.checked;
                commit();
            });
        } else if (input.type === 'range' || input.type === 'number') {
            input.value = String(state[key]);
            input.addEventListener('input', () => {
                (state[key] as number) = Number(input.value);
                commit();
            });
        }
    });

    // Segmented controls (buttons) tagged with data-setting/data-value.
    form.querySelectorAll<HTMLButtonElement>('button[data-setting]').forEach((btn) => {
        const key = btn.dataset.setting as keyof Settings;
        const value = btn.dataset.value!;
        const sync = () => {
            form.querySelectorAll<HTMLButtonElement>(`button[data-setting="${key}"]`).forEach((b) =>
                b.setAttribute('aria-pressed', String(b.dataset.value === String(state[key]))),
            );
        };
        btn.addEventListener('click', () => {
            (state[key] as string) = value;
            commit();
            sync();
        });
        sync();
    });

    // Simple tab switching.
    form.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            form.querySelectorAll<HTMLElement>('[data-tab-panel]').forEach((p) => {
                p.hidden = p.dataset.tabPanel !== target;
            });
            form.querySelectorAll<HTMLElement>('[data-tab]').forEach((t) =>
                t.setAttribute('aria-pressed', String(t.dataset.tab === target)),
            );
        });
    });
}

export function initSettings(): void {
    const state = loadSettings();
    applySettings(state);
    wireForm(state);
}
