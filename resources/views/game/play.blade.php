<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name') }} — Cell</title>
    @vite(['resources/css/app.css', 'resources/game/bootstrap/main.ts'])
</head>
<body class="overflow-hidden">
    {{-- game-root carries campaign config for the TS boot to read. --}}
    <div id="game-root"
         data-seed="{{ $seed }}"
         data-species="{{ $species }}"
         data-save-url="{{ $saveUrl }}"
         class="fixed inset-0 bg-ink-base select-none">

        {{-- Loaded campaign state for the TS boot (server is the source of truth). --}}
        <script id="campaign-state" type="application/json">@json($state)</script>

        {{-- Phaser mounts its canvas here (the world). --}}
        <div id="game-canvas" class="absolute inset-0"></div>

        {{-- Loading screen — covers the canvas until the game boots. --}}
        <div id="game-loading" class="absolute inset-0 z-tooltip flex flex-col items-center justify-center gap-4 bg-ink-base">
            <x-ui.brand-mark class="w-20 h-20 osl-float" />
            <p class="font-mono text-label uppercase tracking-[0.06em] text-content-3">Entering the tank…</p>
        </div>

        {{-- DOM HUD overlay (the interface shell). Zones stay put stage to stage. --}}
        <div id="game-hud" class="pointer-events-none absolute inset-0 text-content">

            {{-- Top-left: species + stage --}}
            <div class="absolute left-4 top-4">
                <x-ui.panel glass class="px-4 py-3 pointer-events-auto">
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4" data-hud="stage">Stage 1 · Cell</p>
                    <p class="font-display font-bold text-h3 leading-none" data-hud="species">{{ $species }}</p>
                </x-ui.panel>
            </div>

            {{-- Top-centre: resources (colour + shape + label + mono value) --}}
            <div class="absolute left-1/2 top-4 -translate-x-1/2" data-mode="direct">
                <x-ui.panel glass class="flex items-center gap-5 px-5 py-3">
                    {{-- Energy: amber diamond --}}
                    <div class="flex items-center gap-2">
                        <span class="h-3 w-3 rotate-45 rounded-[2px]" style="background: var(--osl-res-energy)" aria-hidden="true"></span>
                        <div>
                            <p class="font-mono text-label uppercase text-content-4 leading-none" data-hud="energy-label">Energy</p>
                            <p class="font-mono text-num leading-none"><span data-hud="energy-value">80</span></p>
                        </div>
                        <div class="ml-1 h-1.5 w-16 overflow-hidden rounded-pill bg-ink-2">
                            <div class="h-full rounded-pill" style="width:80%; background: var(--osl-res-energy)" data-hud="energy-bar"></div>
                        </div>
                    </div>
                    {{-- Integrity: coral circle --}}
                    <div class="flex items-center gap-2">
                        <span class="h-3 w-3 rounded-full" style="background: var(--osl-res-health)" aria-hidden="true"></span>
                        <div>
                            <p class="font-mono text-label uppercase text-content-4 leading-none" data-hud="integrity-label">Integrity</p>
                            <p class="font-mono text-num leading-none"><span data-hud="integrity-value">100</span></p>
                        </div>
                        <div class="ml-1 h-1.5 w-16 overflow-hidden rounded-pill bg-ink-2">
                            <div class="h-full rounded-pill" style="width:100%; background: var(--osl-res-health)" data-hud="integrity-bar"></div>
                        </div>
                    </div>
                    {{-- Evolution: mint spark --}}
                    <div class="flex items-center gap-2">
                        <span class="h-3 w-3 rotate-45" style="background: var(--osl-res-evolution); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" aria-hidden="true"></span>
                        <div>
                            <p class="font-mono text-label uppercase text-content-4 leading-none" data-hud="evolution-label">Evolution</p>
                            <p class="font-mono text-num leading-none"><span data-hud="evolution-value">0</span></p>
                        </div>
                    </div>
                </x-ui.panel>
            </div>

            {{-- Top-right: save status + system controls --}}
            <div class="absolute right-4 top-4 flex items-center gap-2 pointer-events-auto">
                <span role="status" aria-live="polite"
                      class="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--osl-border-glow)] bg-[color:var(--osl-surface-glass)] backdrop-blur-md px-3 py-2 font-mono text-label uppercase tracking-[0.06em] text-content-3">
                    <x-ui.icon name="save" class="w-3.5 h-3.5" />
                    <span data-hud="save-status">Saved</span>
                </span>
                <button data-action="pause" aria-pressed="false"
                        class="min-h-[44px] rounded-md border border-[color:var(--osl-border-glow)] bg-[color:var(--osl-surface-glass)] backdrop-blur-md px-4 font-semibold text-small hover:border-brand transition duration-fast">
                    Pause
                </button>
            </div>

            {{-- Right edge: threat cue (colour + "!" + directional word) --}}
            <div data-hud="threat" hidden role="alert"
                 style="background: rgba(38,17,12,.82); border:1px solid var(--osl-accent)"
                 class="absolute right-4 top-24 max-w-[16rem] rounded-md px-4 py-2 font-semibold text-small text-[color:var(--osl-accent)]"></div>

            {{-- Bottom-left: objective (direct-control stages) --}}
            <div class="absolute left-4 bottom-4 w-72" data-mode="direct">
                <x-ui.panel glass class="px-4 py-3">
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">Objective</p>
                    <p class="text-small text-content" data-hud="objective-label">Absorb nutrients to divide (0/8)</p>
                    <div class="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-ink-2">
                        <div class="h-full rounded-pill bg-brand" style="width:0%" data-hud="objective-bar"></div>
                    </div>
                </x-ui.panel>
            </div>

            {{-- Bottom-centre: speed (+ map zoom on strategic stages) --}}
            <div class="absolute left-1/2 bottom-4 -translate-x-1/2 pointer-events-auto flex items-center gap-2">
                <x-ui.panel glass class="flex items-center gap-1 p-1">
                    @foreach (['1' => '1×', '2' => '2×', '4' => '4×'] as $mult => $label)
                        <button data-speed="{{ $mult }}" aria-pressed="{{ $mult === '1' ? 'true' : 'false' }}"
                                class="min-h-[36px] min-w-[44px] rounded-sm px-3 font-mono text-small aria-pressed:bg-brand aria-pressed:text-[color:var(--osl-text-on-brand)] hover:bg-ink-surface2 transition duration-fast">
                            {{ $label }}
                        </button>
                    @endforeach
                </x-ui.panel>
                <x-ui.panel glass class="flex items-center gap-1 p-1" data-mode="management">
                    <button data-zoom="-1" aria-label="Zoom out"
                            class="min-h-[36px] min-w-[44px] rounded-sm px-3 font-mono text-small hover:bg-ink-surface2 transition duration-fast">−</button>
                    <button data-zoom="1" aria-label="Zoom in"
                            class="min-h-[36px] min-w-[44px] rounded-sm px-3 font-mono text-small hover:bg-ink-surface2 transition duration-fast">+</button>
                </x-ui.panel>
                @if (app()->environment('local'))
                    {{-- Playtest toolbar (local env only): hyper speed, resources, instant win. --}}
                    <x-ui.panel glass class="flex items-center gap-1 p-1" data-devtools
                                style="border-color: var(--osl-secondary)">
                        <button data-dev="speed" title="Run at 16× speed"
                                class="min-h-[36px] rounded-sm px-2.5 font-mono text-label uppercase text-content-3 hover:bg-ink-surface2 transition duration-fast">16×</button>
                        <button data-dev="grant" title="Grant +100 of each resource"
                                class="min-h-[36px] rounded-sm px-2.5 font-mono text-label uppercase text-content-3 hover:bg-ink-surface2 transition duration-fast">+res</button>
                        <button data-dev="complete" title="Complete the current objective"
                                class="min-h-[36px] rounded-sm px-2.5 font-mono text-label uppercase text-content-3 hover:bg-ink-surface2 transition duration-fast">win</button>
                        <button data-dev="die" title="Fail the current stage (direct-control)"
                                class="min-h-[36px] rounded-sm px-2.5 font-mono text-label uppercase text-content-3 hover:bg-ink-surface2 transition duration-fast">die</button>
                    </x-ui.panel>
                @endif
            </div>

            {{-- Bottom-right: traits / evolution (direct-control stages) --}}
            <div class="absolute right-4 bottom-4 pointer-events-auto" data-mode="direct">
                <button data-action="open-traits"
                        class="flex items-center gap-2 min-h-[44px] rounded-md border border-[color:var(--osl-border-glow)] bg-[color:var(--osl-surface-glass)] backdrop-blur-md px-4 font-semibold text-small hover:border-brand transition duration-fast">
                    Traits
                    <span class="flex items-center gap-1 font-mono text-label">
                        <span class="h-2.5 w-2.5" style="background: var(--osl-res-evolution); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" aria-hidden="true"></span>
                        <span data-traits="badge">0</span>
                    </span>
                </button>
            </div>

            {{-- Evolution drawer --}}
            <div data-overlay="traits" hidden
                 class="pointer-events-auto absolute inset-y-0 right-0 w-full sm:w-96 flex flex-col"
                 style="background: var(--osl-surface); border-left: 1px solid var(--osl-border)">
                <div class="flex items-center justify-between px-5 py-4 border-b border-ink-border">
                    <div>
                        <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4">Evolution</p>
                        <h2 class="font-display font-bold text-h3 text-content">Adapt your cell</h2>
                    </div>
                    <button data-action="close-traits" aria-label="Close"
                            class="min-h-[40px] min-w-[40px] rounded-sm border border-ink-border text-content-2 hover:border-brand">✕</button>
                </div>
                <div data-traits="list" class="flex-1 overflow-y-auto p-4 space-y-3"></div>
            </div>

            {{-- Management panel (strategic stages: Tribe → Space) --}}
            <div data-mode="management" hidden
                 class="pointer-events-auto absolute inset-y-0 right-0 w-full sm:w-[26rem] flex flex-col"
                 style="background: var(--osl-surface-glass); backdrop-filter: blur(8px); border-left: 1px solid var(--osl-border)">
                <div class="px-5 py-4 border-b border-ink-border">
                    <h2 class="font-display font-bold text-h3 text-content" data-management="title">Strategic stage</h2>
                    <p class="text-small text-content-3" data-management="subtitle"></p>
                    <div class="mt-3">
                        <p class="text-small text-content" data-management="objective-label">Objective</p>
                        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-ink-2">
                            <div class="h-full rounded-pill bg-brand" style="width:0%" data-management="objective-bar"></div>
                        </div>
                        <p class="text-small text-brand-hi mt-2" data-management="status-line" hidden></p>
                    </div>
                </div>
                <div class="px-5 py-3 border-b border-ink-border space-y-1" data-management="resources"></div>
                <div class="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                    <p class="text-small text-content-3 mb-3">Select a site, your settlement or a rival on the map to act there.</p>

                    {{-- Rival powers: one status card per discovered rival --}}
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">Rival powers</p>
                    <div data-management="faction-list" class="space-y-3 mb-3"></div>

                    {{-- Council: abstract decisions with no place on the map --}}
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">Council</p>
                    <div data-management="actions" class="space-y-2"></div>
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mt-4 mb-1">History</p>
                    <div data-management="log" class="space-y-1"></div>
                </div>
            </div>

            {{-- Contextual action bar: shown only while a map object is
                 selected (visibility is driven by SelectionBarController, not
                 the stage mode, so it stays hidden on direct-control stages). --}}
            <div data-selection="bar" hidden
                 class="pointer-events-auto absolute left-4 right-4 sm:right-[27rem] bottom-20">
                <x-ui.panel glass class="flex items-center gap-3 p-3">
                    <div class="shrink-0 max-w-[38%]">
                        <p class="font-display font-bold text-content leading-tight" data-selection="label">Selected</p>
                        <p class="text-small text-content-3 leading-tight truncate" data-selection="sublabel" hidden></p>
                    </div>
                    <div class="flex-1 flex items-center gap-2 overflow-x-auto" data-selection="actions"></div>
                    <button data-selection="close" aria-label="Close selection"
                            class="shrink-0 min-h-[40px] min-w-[40px] rounded-sm border border-ink-border text-content-2 hover:border-brand">✕</button>
                </x-ui.panel>
            </div>

            {{-- Event decision modal (strategic stages) --}}
            <div data-overlay="event" hidden
                 class="pointer-events-auto absolute inset-0 flex items-center justify-center p-4"
                 style="background: rgba(6,20,24,.72)">
                <x-ui.panel class="w-full max-w-md p-6">
                    <div class="text-h1 leading-none mb-2" data-event="icon" aria-hidden="true">❖</div>
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">An event</p>
                    <h2 class="font-display font-bold text-h2 text-content mb-2" data-event="title"></h2>
                    <p class="text-small text-content-2 mb-5" data-event="description"></p>
                    <div class="flex flex-col gap-3" data-event="choices"></div>
                </x-ui.panel>
            </div>

            {{-- First-time stage onboarding (strategic stages) --}}
            <div data-overlay="onboarding" hidden
                 class="pointer-events-auto absolute inset-x-0 bottom-24 flex justify-center px-4">
                <x-ui.panel class="w-full max-w-md p-5">
                    <div class="flex items-center justify-between mb-1">
                        <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4">A word of guidance</p>
                        <span class="font-mono text-label text-content-4" data-onboarding="step">1 / 3</span>
                    </div>
                    <h3 class="font-display font-bold text-h3 text-content mb-1" data-onboarding="title"></h3>
                    <p class="text-small text-content-2 mb-4" data-onboarding="text"></p>
                    <div class="flex items-center justify-between gap-3">
                        <button data-onboarding="skip" class="text-small text-content-3 hover:text-content min-h-[40px]">Skip</button>
                        <button data-onboarding="next"
                                class="min-h-[40px] rounded-md bg-brand px-5 font-semibold text-small text-[color:var(--osl-text-on-brand)] hover:bg-brand-hi transition duration-fast">Next</button>
                    </div>
                </x-ui.panel>
            </div>

            {{-- Pause overlay --}}
            <div data-overlay="pause" hidden
                 class="pointer-events-auto absolute inset-0 flex items-center justify-center"
                 style="background: rgba(6,20,24,.62)">
                <x-ui.panel class="w-80 p-6 text-center">
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">Paused</p>
                    <p class="font-display font-bold text-h2 mb-5">{{ $species }}</p>
                    <div class="flex flex-col gap-3">
                        <x-ui.button data-action="resume" variant="primary" size="lg">Resume</x-ui.button>

                        {{-- Manual save slots --}}
                        <div class="rounded-md border border-ink-border bg-ink-2 p-3 text-left">
                            <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-2">Saved games · autosave is always on</p>
                            <div class="space-y-2">
                                @for ($i = 1; $i <= 3; $i++)
                                    <div class="flex items-center justify-between gap-2">
                                        <span class="text-small text-content-2 truncate">
                                            Slot {{ $i }}
                                            @isset($slots[$i]) — {{ $slots[$i]->label }} @else <span class="text-content-4">— empty</span> @endisset
                                        </span>
                                        <span class="flex gap-1 flex-none">
                                            <form method="POST" action="{{ route('play.slot.save', [$campaign, $i]) }}">
                                                @csrf
                                                <button class="min-h-[32px] px-3 rounded-sm text-small border border-ink-border hover:border-brand">Save</button>
                                            </form>
                                            @isset($slots[$i])
                                                <form method="POST" action="{{ route('play.slot.restore', [$campaign, $i]) }}">
                                                    @csrf
                                                    <button class="min-h-[32px] px-3 rounded-sm text-small bg-brand text-[color:var(--osl-text-on-brand)]">Load</button>
                                                </form>
                                            @endisset
                                        </span>
                                    </div>
                                @endfor
                            </div>
                        </div>

                        <x-ui.button href="{{ route('settings') }}" variant="secondary" size="lg">Settings</x-ui.button>
                        <x-ui.button href="{{ route('campaigns.history', $campaign) }}" variant="secondary" size="lg">Species history</x-ui.button>
                        <x-ui.button href="{{ url('/dashboard') }}" variant="ghost" size="lg">Save &amp; quit</x-ui.button>
                    </div>
                </x-ui.panel>
            </div>

            {{-- Diet choice (Creature stage start) --}}
            <div data-overlay="diet" hidden
                 class="pointer-events-auto absolute inset-0 flex items-center justify-center p-4"
                 style="background: radial-gradient(70% 70% at 50% 40%, rgba(79,212,196,.10), transparent), rgba(6,20,24,.86)">
                <x-ui.panel class="w-full max-w-2xl p-7">
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1 text-center">Your creature comes ashore</p>
                    <h2 class="font-display font-bold text-h2 text-content mb-2 text-center">How will you feed?</h2>
                    <p class="text-small text-content-3 mb-6 text-center">This shapes how you play the stage. Choose your way.</p>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <button data-diet="herbivore"
                                class="text-left rounded-lg border border-ink-border p-5 hover:border-brand transition duration-fast">
                            <p class="font-display font-bold text-h3 text-content mb-1">Herbivore</p>
                            <p class="text-small text-content-2">Graze the plant nests across the land. Steady, safer feeding — keep moving between nests and stay clear of predators.</p>
                        </button>
                        <button data-diet="carnivore"
                                class="text-left rounded-lg border border-ink-border p-5 hover:border-brand transition duration-fast">
                            <p class="font-display font-bold text-h3 text-content mb-1">Carnivore</p>
                            <p class="text-small text-content-2">Hunt the grazing creatures for rich meals. Faster, riskier — you must chase down prey, and plants barely sustain you.</p>
                        </button>
                    </div>
                </x-ui.panel>
            </div>

            {{-- Death moment (direct-control stages): shown after the cell ruptures --}}
            <div data-overlay="death" hidden
                 class="pointer-events-auto absolute inset-0 flex items-center justify-center"
                 style="background: radial-gradient(70% 70% at 50% 45%, rgba(38,17,12,.5), transparent), rgba(4,10,14,.82)">
                <x-ui.panel class="w-96 p-7 text-center" style="border-color: var(--osl-accent)">
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">A small life ends</p>
                    <h2 class="font-display font-bold text-h2 text-content mb-3" data-death="title">The lineage falters</h2>
                    <p class="text-small text-content-2 mb-5" data-death="summary"></p>
                    <div class="flex flex-col gap-3">
                        <button data-action="retry"
                                class="min-h-[48px] rounded-md bg-brand px-5 font-semibold text-content-on-brand text-[color:var(--osl-text-on-brand)] hover:bg-brand-hi transition duration-fast">Try again</button>
                        <x-ui.button href="{{ url('/dashboard') }}" variant="ghost" size="md" class="w-full">Back to lineages</x-ui.button>
                        <p class="text-tooltip text-content-4">Your progress is saved. Leave to switch between lineages or review this one's history.</p>
                    </div>
                    <p class="mt-4 font-mono text-label uppercase text-content-4">Every life begins again</p>
                </x-ui.panel>
            </div>

            {{-- Stage intro title card — fades out shortly after boot --}}
            @php($introStage = $state['progress']['currentStage'] ?? 'cell')
            @php($intro = [
                'cell' => ['Stage 1 · Cell', 'One small life adrift in a vast warm sea. Eat, grow, survive.'],
                'creature' => ['Stage 2 · Creature', 'Your lineage walks. A wide wild land of nests, herds and hunters.'],
                'tribe' => ['Stage 3 · Tribe', 'The first fire is lit. Scout the dark, and grow a culture.'],
                'civilisation' => ['Stage 4 · Civilisation', 'Camps become cities. Build, trade, and cross the ages.'],
                'planetary' => ['Stage 5 · Planetary', 'One world, many powers — and a biosphere holding its breath.'],
                'space' => ['Stage 6 · Space', 'Your homeworld turns below. Build the means to leave, then launch your first probe to break orbit and reach the stars.'],
            ][$introStage] ?? ['A new stage', ''])
            <div data-overlay="stage-intro"
                 data-intro-key="{{ $campaign->id }}-{{ $introStage }}"
                 class="pointer-events-auto absolute inset-0 z-tooltip flex flex-col items-center justify-center gap-3 text-center px-8"
                 style="background: radial-gradient(60% 60% at 50% 45%, rgba(79,212,196,.12), transparent), rgba(6,20,24,.88)">
                <p class="font-mono text-label uppercase tracking-[0.06em] text-brand-hi">{{ $species }}</p>
                <h2 class="font-display font-bold text-display text-content">{{ $intro[0] }}</h2>
                <p class="text-content-2 max-w-md">{{ $intro[1] }}</p>
                <p class="mt-2 font-mono text-label uppercase text-content-4">Click to begin</p>
            </div>

            {{-- Stage-complete overlay: narration cinematic, then the summary panel --}}
            <div data-overlay="stage-complete" hidden
                 class="pointer-events-auto absolute inset-0 flex items-center justify-center"
                 style="background: radial-gradient(60% 60% at 50% 40%, rgba(79,212,196,.14), transparent), rgba(6,20,24,.9)">
                <p data-transition="narration" hidden
                   class="absolute inset-x-0 top-[38%] px-8 text-center font-display font-bold text-h2 text-content"
                   style="text-shadow: 0 2px 24px rgba(6,20,24,.8)"></p>
                <x-ui.panel class="w-96 p-7 text-center" data-transition="panel">
                    <x-ui.brand-mark class="mx-auto w-16 h-16 mb-3" />
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">Stage complete</p>
                    <h2 class="font-display font-bold text-h2 mb-3">A new threshold</h2>
                    <p class="text-small text-content-2 mb-5" data-overlay="summary"></p>
                    <div class="flex flex-col gap-3">
                        <form method="POST" action="{{ route('play.advance', $campaign) }}">
                            @csrf
                            <x-ui.button variant="primary" size="lg" class="w-full">Continue the lineage</x-ui.button>
                        </form>
                        <x-ui.button href="{{ url('/dashboard') }}" variant="ghost" size="md" class="w-full">Back to lineages</x-ui.button>
                        <p class="text-tooltip text-content-4">This stage is saved. Leave now and you can pick the lineage up here later, or start another.</p>
                    </div>
                    <p class="mt-4 font-mono text-label uppercase text-content-4">It began with one small life</p>
                </x-ui.panel>
            </div>
        </div>
    </div>
</body>
</html>
