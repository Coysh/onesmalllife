import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/* =====================================================================
   One Small Life — Tailwind theme · Direction: TIDEPOOL
   Values mirror resources/css/tokens.css so Blade utilities and CSS vars
   stay in sync. Adapted from the design handoff (project/tailwind.theme.js).
   ===================================================================== */

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/game/**/*.ts',
    ],

    // Type-scale classes are sometimes composed dynamically (e.g. the wordmark's
    // size prop), so they must be generated even when not seen as literals.
    safelist: ['text-display', 'text-h1', 'text-h2', 'text-h3'],

    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: '#4fd4c4', hi: '#8fe9d6', deep: '#2b9c8b', ink: '#0b191d',
                },
                secondary: { DEFAULT: '#f5b955', deep: '#d1963a' },
                accent: { DEFAULT: '#f2795f', deep: '#d15b44' },
                ink: {
                    base: '#061418', 2: '#0a2429',
                    surface: '#0f2b30', surface2: '#12363c',
                    border: '#1c3b42', borderSoft: '#163037',
                },
                content: { DEFAULT: '#eafbf7', 2: '#c6ddd9', 3: '#8fa8a4', 4: '#5f8f8a' },
                status: { success: '#5fd39a', warning: '#f5b955', danger: '#f2795f', info: '#6cc6e6' },
                res: {
                    energy: '#f5b955', health: '#f2795f', evolution: '#8fe9d6',
                    food: '#c8e06a', material: '#b79b7a', research: '#6cc6e6',
                },
                trait: { bio: '#5fd39a', behaviour: '#f5b955', cultural: '#e08cc0', tech: '#6cc6e6' },
                rel: { ally: '#5fd39a', neutral: '#8fa8a4', rival: '#f2795f', kin: '#f5b955' },
                map: { owned: '#4fd4c4', contested: '#f5b955', hostile: '#f2795f', unexplored: '#123037' },
            },
            fontFamily: {
                // Self-hosted @fontsource variable families register as "... Variable".
                display: ['"Bricolage Grotesque Variable"', '"Bricolage Grotesque"', ...defaultTheme.fontFamily.sans],
                body: ['"Hanken Grotesk Variable"', '"Hanken Grotesk"', ...defaultTheme.fontFamily.sans],
                mono: ['"Space Mono"', ...defaultTheme.fontFamily.mono],
                // Default body copy uses the Hanken body face.
                sans: ['"Hanken Grotesk Variable"', '"Hanken Grotesk"', ...defaultTheme.fontFamily.sans],
            },
            fontSize: {
                display: ['46px', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
                h1: ['34px', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
                h2: ['26px', { lineHeight: '1.12', letterSpacing: '-0.01em' }],
                h3: ['20px', { lineHeight: '1.2' }],
                body: ['16px', { lineHeight: '1.6' }],
                small: ['14px', { lineHeight: '1.5' }],
                label: ['12px', { lineHeight: '1.3', letterSpacing: '0.06em' }],
                tooltip: ['12px', { lineHeight: '1.4' }],
                num: ['20px', { lineHeight: '1' }],
            },
            spacing: {
                1: '4px', 2: '8px', 3: '12px', 4: '16px',
                5: '22px', 6: '30px', 7: '44px', 8: '64px',
            },
            borderRadius: {
                xs: '6px', sm: '9px', md: '12px', lg: '16px', xl: '22px', pill: '999px',
            },
            boxShadow: {
                e1: '0 1px 2px rgba(0,0,0,.35)',
                e2: '0 6px 18px rgba(0,0,0,.40)',
                e3: '0 18px 48px rgba(0,0,0,.50)',
                'glow-brand': '0 0 24px rgba(79,212,196,.35)',
                'glow-amber': '0 0 20px rgba(245,185,85,.40)',
            },
            opacity: { disabled: '0.40', muted: '0.64', scrim: '0.72' },
            transitionTimingFunction: {
                osl: 'cubic-bezier(.22,.61,.36,1)',
                'osl-in': 'cubic-bezier(.4,0,1,1)',
                'osl-bounce': 'cubic-bezier(.34,1.56,.64,1)',
            },
            transitionDuration: {
                fast: '120ms', base: '200ms', slow: '300ms', expressive: '600ms',
            },
            zIndex: {
                world: '0', hud: '100', panel: '200', overlay: '300',
                modal: '400', toast: '500', tooltip: '600',
            },
            screens: { tablet: '768px', desktop: '1024px', wide: '1440px' },
        },
    },

    plugins: [forms],
};
