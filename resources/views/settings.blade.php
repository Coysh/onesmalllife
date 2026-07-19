<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name') }} — Settings</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen antialiased">
    <div class="relative min-h-screen"
         style="background: radial-gradient(120% 70% at 50% -10%, rgba(79,212,196,.10), transparent 60%), var(--osl-bg);">

        <header class="flex items-center justify-between px-6 py-4">
            <a href="{{ url('/') }}" class="flex items-center gap-3" aria-label="One Small Life">
                <x-ui.brand-mark class="w-9 h-9" />
                <x-ui.wordmark size="h3" />
            </a>
            <x-ui.button href="{{ url()->previous() === url()->current() ? route('dashboard') : url()->previous() }}" variant="ghost" size="sm">Done</x-ui.button>
        </header>

        <main class="mx-auto max-w-2xl px-6 py-8" data-settings-form>
            <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">Settings</p>
            <h1 class="font-display font-bold text-h1 text-content mb-6">Tune your experience</h1>

            {{-- Tabs --}}
            <div class="flex flex-wrap gap-2 mb-5">
                @foreach (['display' => 'Display', 'audio' => 'Audio', 'access' => 'Access', 'game' => 'Game'] as $id => $label)
                    <button type="button" data-tab="{{ $id }}" aria-pressed="{{ $id === 'display' ? 'true' : 'false' }}"
                            class="min-h-[40px] px-4 rounded-pill text-small font-semibold border border-ink-border text-content-2 aria-pressed:bg-brand aria-pressed:text-[color:var(--osl-text-on-brand)] aria-pressed:border-transparent transition duration-fast">
                        {{ $label }}
                    </button>
                @endforeach
            </div>

            <x-ui.panel class="p-6 space-y-5">
                {{-- Display --}}
                <div data-tab-panel="display" class="space-y-5">
                    <div>
                        <label class="block font-semibold text-content mb-1">UI scale</label>
                        <p class="text-small text-content-3 mb-2">Make the whole interface larger or smaller.</p>
                        <input type="range" min="90" max="130" step="5" data-setting="uiScale" class="w-full accent-[color:var(--osl-brand)]">
                    </div>
                    <div>
                        <label class="block font-semibold text-content mb-2">Text size</label>
                        <div class="flex gap-2">
                            @foreach (['small' => 'Small', 'normal' => 'Normal', 'large' => 'Large'] as $v => $l)
                                <button type="button" data-setting="textSize" data-value="{{ $v }}"
                                        class="min-h-[40px] px-4 rounded-md text-small font-semibold border border-ink-border text-content-2 aria-pressed:bg-brand aria-pressed:text-[color:var(--osl-text-on-brand)] aria-pressed:border-transparent transition duration-fast">{{ $l }}</button>
                            @endforeach
                        </div>
                    </div>
                </div>

                {{-- Audio --}}
                <div data-tab-panel="audio" class="space-y-5" hidden>
                    @foreach (['master' => 'Master volume', 'music' => 'Music', 'effects' => 'Effects'] as $key => $label)
                        <div>
                            <label class="block font-semibold text-content mb-2">{{ $label }}</label>
                            <input type="range" min="0" max="100" step="5" data-setting="{{ $key }}" class="w-full accent-[color:var(--osl-brand)]">
                        </div>
                    @endforeach
                    <x-ui.settings-toggle setting="muted" label="Mute all audio" />
                </div>

                {{-- Access --}}
                <div data-tab-panel="access" class="space-y-4" hidden>
                    <x-ui.settings-toggle setting="reduceMotion" label="Reduce motion" hint="Hold animations still; keep information through text and shape." />
                    <x-ui.settings-toggle setting="colourBlind" label="Colour-blind cues" hint="Pair every colour with a shape and label (recommended)." />
                    <x-ui.settings-toggle setting="highContrast" label="High contrast text" hint="Lift body text to the brightest tone." />
                </div>

                {{-- Game --}}
                <div data-tab-panel="game" class="space-y-3" hidden>
                    <p class="text-small text-content-2">Your campaign autosaves at safe points — when you pause, complete a stage, and periodically as you play.</p>
                    <p class="text-small text-content-3">Speed can be changed in-game with the 1× / 2× / 4× control.</p>
                </div>
            </x-ui.panel>

            <p class="mt-4 text-small text-content-4">Settings save automatically to this device.</p>
        </main>
    </div>
</body>
</html>
