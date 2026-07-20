<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name') }} — New lineage</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen antialiased">
    @php($catalog = \App\Domain\Species\PartCatalog::catalog())
    @php($palettes = \App\Domain\Species\PartCatalog::palettes())
    @php($slotLabels = [
        'body' => 'Body',
        'membrane' => 'Membrane',
        'feeding' => 'Feeding',
        'movement' => 'Movement',
        'sensory' => 'Senses',
        'defense' => 'Defense',
        'pattern' => 'Pattern',
    ])
    @php($defaults = ['body' => 'oval', 'membrane' => 'smooth', 'feeding' => 'filter', 'movement' => 'cilia', 'sensory' => 'eyespot', 'defense' => 'none', 'pattern' => 'speckle'])

    <main class="relative min-h-screen flex flex-col items-center px-4 py-8"
          style="background: radial-gradient(120% 80% at 50% -10%, rgba(79,212,196,.10), transparent 60%), var(--osl-bg);">

        <div class="flex flex-col items-center gap-3 mb-5">
            <x-ui.brand-mark class="w-12 h-12 osl-float" />
            <x-ui.wordmark size="h3" />
        </div>

        <x-ui.panel class="w-full max-w-4xl p-6 sm:p-7">
            <div class="mb-5">
                @if ($challengeSeed)
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-brand-hi mb-1">{{ $challengeSeed->label() }} challenge</p>
                    <h1 class="text-h2 font-display font-bold text-content">Shape your cell for the challenge</h1>
                    <p class="text-small text-content-3 mt-1">Everyone in this challenge starts from the same seed — your choices from here are what set your lineage apart.</p>
                @else
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">It begins with one small life</p>
                    <h1 class="text-h2 font-display font-bold text-content">Shape your first cell</h1>
                    <p class="text-small text-content-3 mt-1">Every part changes how your cell plays — build a swift darter, an armoured grazer, or a venomous hunter.</p>
                @endif
            </div>

            <form method="POST" action="{{ route('campaigns.store') }}" id="builder" class="grid gap-6 md:grid-cols-[280px_1fr]">
                @csrf
                @if ($challengeSeed)
                    <input type="hidden" name="challenge_seed_id" value="{{ $challengeSeed->id }}">
                @endif

                {{-- Left: live preview + stat readout (stays visible while scrolling) --}}
                <div class="space-y-4 sticky top-4 self-start z-10">
                    <div class="flex justify-center rounded-lg border border-ink-border bg-[color:var(--osl-bg)] p-4">
                        <svg id="preview" viewBox="0 0 100 100" class="w-44 h-44" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <ellipse id="pv-shadow" cx="50" cy="66" rx="36" ry="10" fill="#000" opacity="0.22" />
                            <ellipse id="pv-defense" cx="50" cy="50" rx="40" ry="36" fill="#8fe9d6" opacity="0" />
                            <g id="pv-movement"></g>
                            <ellipse id="pv-body" cx="50" cy="50" rx="34" ry="30" fill="#4fd4c4" />
                            <g id="pv-pattern"></g>
                            <circle id="pv-nucleus" cx="46" cy="48" r="13" fill="#8fe9d6" opacity="0.5" />
                            <circle id="pv-nucleus-core" cx="46" cy="48" r="6" fill="#ffffff" opacity="0.5" />
                            <ellipse id="pv-membrane" cx="50" cy="50" rx="34" ry="30" fill="none" stroke="#2b9c8b" stroke-width="2.5" opacity="0.9" />
                            <ellipse id="pv-membrane2" cx="50" cy="50" rx="29" ry="25" fill="none" stroke="#8fe9d6" stroke-width="1.5" opacity="0" />
                            <g id="pv-defense-parts"></g>
                            <g id="pv-feeding"></g>
                            <g id="pv-sensory"></g>
                            <circle id="pv-highlight" cx="38" cy="38" r="7" fill="#ffffff" opacity="0.16" />
                        </svg>
                    </div>

                    <div class="space-y-2" id="stats" aria-live="polite">
                        @foreach ([
                            'speed' => ['Speed', 'How quickly your cell moves through the world.'],
                            'attack' => ['Attack', 'How much damage you deal when colliding with prey or threats.'],
                            'defense' => ['Defense', 'Reduces damage taken from hostile cells and hazards.'],
                            'sense' => ['Sense', 'How far away food and danger can be detected or shown.'],
                            'food-gained' => ['Food gained', 'How much energy one ordinary nutrient restores.'],
                            'movement-cost' => ['Movement cost', 'How much energy is consumed each second while moving.'],
                        ] as $key => [$label, $help])
                            <div>
                                <div class="flex justify-between text-small text-content-2">
                                    <span class="inline-flex items-center gap-1">{{ $label }}
                                        <button type="button" class="relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink-border text-[10px] focus-visible:ring-2 focus-visible:ring-[color:var(--osl-focus-ring)]" aria-describedby="stat-help-{{ $key }}" data-stat-help="{{ $key }}">i</button>
                                        <span id="stat-help-{{ $key }}" role="tooltip" hidden class="absolute z-20 mt-24 w-52 rounded-md border border-ink-border bg-ink-surface p-2 text-left text-tooltip normal-case tracking-normal text-content shadow-lg">{{ $help }}</span>
                                    </span>
                                    <span class="font-mono" data-stat-value="{{ $key }}">–</span>
                                </div>
                                <div class="h-1.5 rounded-pill bg-ink-border overflow-hidden">
                                    <div class="h-full rounded-pill bg-brand transition-all duration-fast" data-stat-bar="{{ $key }}" style="width: 50%"></div>
                                </div>
                            </div>
                        @endforeach
                    </div>

                    <div>
                        <x-input-label for="name" :value="__('Lineage name (optional)')" />
                        <x-text-input id="name" name="name" :value="old('name')" maxlength="60" placeholder="Leave blank for a generated name" />
                    </div>
                </div>

                {{-- Right: part slots --}}
                <div class="space-y-5">
                    {{-- Palette --}}
                    <div>
                        <span class="block font-mono text-label uppercase tracking-[0.06em] text-brand-hi mb-2">Palette</span>
                        <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Palette">
                            @foreach ($palettes as $i => $swatch)
                                <label class="cursor-pointer" title="{{ $swatch['name'] }}">
                                    <input type="radio" name="palette" value="{{ $i }}" class="sr-only peer" @checked($i === 1)>
                                    <span class="block h-9 w-9 rounded-full border-2 border-transparent peer-checked:border-[color:var(--osl-text)] peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--osl-focus-ring)]" style="background: {{ $swatch['albedo'] }}"></span>
                                </label>
                            @endforeach
                        </div>
                    </div>

                    @foreach ($slotLabels as $slot => $label)
                        <div>
                            <span class="block font-mono text-label uppercase tracking-[0.06em] text-brand-hi mb-2">{{ $label }}</span>
                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="{{ $label }}">
                                @foreach (\App\Domain\Species\PartCatalog::options($slot) as $part)
                                    <label class="cursor-pointer">
                                        <input type="radio" name="{{ $slot }}" value="{{ $part['id'] }}" class="sr-only peer" @checked($part['id'] === $defaults[$slot])>
                                        <span class="block h-full rounded-md border border-ink-border px-2.5 py-2 text-small text-content-2 peer-checked:bg-brand peer-checked:text-[color:var(--osl-text-on-brand)] peer-checked:border-transparent peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--osl-focus-ring)]">
                                            <span class="block font-semibold">{{ $part['label'] }}</span>
                                            <span class="block opacity-80 leading-tight mt-0.5">{{ $part['blurb'] }}</span>
                                        </span>
                                    </label>
                                @endforeach
                            </div>
                        </div>
                    @endforeach

                    <div class="flex items-center justify-between gap-3 pt-2">
                        <a href="{{ route('dashboard') }}" class="text-small text-content-3 hover:text-content">Back</a>
                        <x-primary-button>{{ __('Begin your journey') }}</x-primary-button>
                    </div>
                </div>
            </form>
        </x-ui.panel>
    </main>

    {{-- Shared part catalogue (same file PHP validates against). --}}
    <script id="part-catalog" type="application/json">@json(['slots' => $catalog['slots'], 'palettes' => $palettes])</script>

    {{-- Live preview + stat wiring (mirrors PortraitComposer geometry). --}}
    <script>
        (function () {
            const catalog = JSON.parse(document.getElementById('part-catalog').textContent);
            const form = document.getElementById('builder');
            const svgNS = 'http://www.w3.org/2000/svg';
            const el = (id) => document.getElementById(id);

            form.querySelectorAll('[data-stat-help]').forEach((button) => {
                const help = document.getElementById('stat-help-' + button.dataset.statHelp);
                if (!help) return;
                const show = () => { help.hidden = false; };
                const hide = () => { if (button.dataset.open !== 'true') help.hidden = true; };
                button.addEventListener('mouseenter', show);
                button.addEventListener('mouseleave', hide);
                button.addEventListener('focus', show);
                button.addEventListener('blur', hide);
                button.addEventListener('click', () => {
                    button.dataset.open = button.dataset.open === 'true' ? 'false' : 'true';
                    help.hidden = button.dataset.open !== 'true';
                });
            });

            function chosen(slot) {
                const input = form.querySelector('input[name="' + slot + '"]:checked');
                return input ? input.value : null;
            }
            function part(slot, id) {
                return (catalog.slots[slot] || []).find((p) => p.id === id) || null;
            }
            function sumEffects() {
                const sum = { speed: 0, attack: 0, defense: 0, senseRadius: 0, energyPerMote: 0, energyDrain: 0, integrityRegen: 0 };
                for (const slot of Object.keys(catalog.slots)) {
                    const p = part(slot, chosen(slot));
                    if (!p) continue;
                    for (const [k, v] of Object.entries(p.effects || {})) sum[k] += v;
                }
                return sum;
            }

            // Base numbers mirror config.ts CELL so the bars are honest.
            const BASE = { speed: 260, attack: 10, defense: 0, sense: 620, energyPerMote: 9, drain: 2.6 };
            function updateStats(sum) {
                const stats = {
                    speed: { value: Math.round(BASE.speed * (1 + sum.speed)), pct: 50 + sum.speed * 160 },
                    attack: { value: BASE.attack + sum.attack, pct: (BASE.attack + sum.attack) * 4 },
                    defense: { value: BASE.defense + sum.defense, pct: (BASE.defense + sum.defense) * 8 },
                    sense: { value: BASE.sense + sum.senseRadius, pct: (BASE.sense + sum.senseRadius) / 11 },
                    'food-gained': { value: (BASE.energyPerMote + sum.energyPerMote) + ' energy per mote', pct: 50 + sum.energyPerMote * 8 },
                    'movement-cost': { value: (BASE.drain + sum.energyDrain).toFixed(1) + ' energy per second', pct: 50 - sum.energyDrain * 14 },
                };
                for (const [key, s] of Object.entries(stats)) {
                    form.querySelector('[data-stat-value="' + key + '"]').textContent = s.value;
                    form.querySelector('[data-stat-bar="' + key + '"]').style.width = Math.max(4, Math.min(100, s.pct)) + '%';
                }
            }

            function clearGroup(node) { while (node.firstChild) node.removeChild(node.firstChild); }
            function make(tag, attrs) {
                const n = document.createElementNS(svgNS, tag);
                for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
                return n;
            }

            function updatePreview() {
                const pal = catalog.palettes[Number(chosen('palette') ?? 1)] || catalog.palettes[1];
                const body = part('body', chosen('body')) || { rx: 34, ry: 30 };
                const rx = body.rx, ry = body.ry;

                el('pv-body').setAttribute('rx', rx); el('pv-body').setAttribute('ry', ry);
                el('pv-body').setAttribute('fill', pal.albedo);
                el('pv-shadow').setAttribute('cy', 50 + ry * 0.55);
                el('pv-shadow').setAttribute('rx', rx * 1.05); el('pv-shadow').setAttribute('ry', ry * 0.32);
                el('pv-membrane').setAttribute('rx', rx); el('pv-membrane').setAttribute('ry', ry);
                el('pv-membrane').setAttribute('stroke', pal.detail);
                el('pv-nucleus').setAttribute('r', rx * 0.4); el('pv-nucleus').setAttribute('fill', pal.accent);
                el('pv-nucleus-core').setAttribute('r', rx * 0.18);
                el('pv-highlight').setAttribute('cx', 50 - rx * 0.35); el('pv-highlight').setAttribute('cy', 50 - ry * 0.4);
                el('pv-highlight').setAttribute('r', rx * 0.22);

                const membrane = chosen('membrane');
                el('pv-membrane').setAttribute('stroke-width', membrane === 'double' || membrane === 'ridged' ? 3.5 : 2.5);
                el('pv-membrane2').setAttribute('rx', rx - 5); el('pv-membrane2').setAttribute('ry', ry - 5);
                el('pv-membrane2').setAttribute('stroke', pal.accent);
                el('pv-membrane2').setAttribute('opacity', membrane === 'double' ? 0.6 : 0);

                // Defense (outer). Mucus keeps the soft sheen; each other id draws distinct.
                const defense = chosen('defense');
                el('pv-defense').setAttribute('rx', rx + 6); el('pv-defense').setAttribute('ry', ry + 6);
                el('pv-defense').setAttribute('fill', pal.accent);
                el('pv-defense').setAttribute('opacity', defense === 'mucus' ? 0.16 : 0);
                el('pv-body').setAttribute('opacity', defense === 'camouflage' ? 0.7 : 1);
                const df = el('pv-defense-parts'); clearGroup(df);
                if (defense === 'toxin_sac') {
                    df.appendChild(make('circle', { cx: 50 - rx * 0.2, cy: 50 + ry * 0.7, r: 6, fill: '#7dc95e' }));
                    df.appendChild(make('circle', { cx: 50 - rx * 0.2, cy: 50 + ry * 0.7, r: 6, fill: 'none', stroke: '#4f8a3a', 'stroke-width': 1.2 }));
                } else if (defense === 'spike_ring') {
                    for (let i = 0; i < 12; i++) {
                        const a = (i / 12) * Math.PI * 2;
                        const px = 50 + Math.cos(a - 0.12) * rx, py = 50 + Math.sin(a - 0.12) * ry;
                        const qx = 50 + Math.cos(a + 0.12) * rx, qy = 50 + Math.sin(a + 0.12) * ry;
                        const tx = 50 + Math.cos(a) * (rx + 7), ty = 50 + Math.sin(a) * (ry + 7);
                        df.appendChild(make('path', { d: 'M' + px + ' ' + py + ' L ' + tx + ' ' + ty + ' L ' + qx + ' ' + qy + ' Z', fill: pal.detail, opacity: 0.85 }));
                    }
                } else if (defense === 'thick_wall') {
                    df.appendChild(make('ellipse', { cx: 50, cy: 50, rx: rx + 3, ry: ry + 3, fill: 'none', stroke: pal.detail, 'stroke-width': 4.5, opacity: 0.9 }));
                } else if (defense === 'spines') {
                    for (let i = 0; i < 5; i++) {
                        const a = (i / 5) * Math.PI * 2 + 0.3;
                        df.appendChild(make('line', { x1: 50 + Math.cos(a) * rx, y1: 50 + Math.sin(a) * ry, x2: 50 + Math.cos(a) * (rx + 14), y2: 50 + Math.sin(a) * (ry + 14), stroke: pal.detail, 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
                    }
                } else if (defense === 'camouflage') {
                    for (const [dx, dy] of [[-rx * 0.4, -ry * 0.3], [rx * 0.3, ry * 0.4], [rx * 0.5, -ry * 0.35], [-rx * 0.3, ry * 0.5]]) {
                        df.appendChild(make('circle', { cx: 50 + dx, cy: 50 + dy, r: 4, fill: pal.detail, opacity: 0.3 }));
                    }
                }

                // Movement (trailing edge, left).
                const mv = el('pv-movement'); clearGroup(mv);
                const movement = chosen('movement');
                if (movement === 'flagellum' || movement === 'twin_flagella') {
                    const offsets = movement === 'twin_flagella' ? [-5, 5] : [0];
                    for (const oy of offsets) {
                        mv.appendChild(make('path', {
                            d: 'M' + (50 - rx) + ' ' + (50 + oy) + ' q -14 -6 -22 4 q 8 4 20 2 z',
                            fill: pal.detail, opacity: 0.9,
                        }));
                    }
                } else if (movement === 'fin') {
                    mv.appendChild(make('path', {
                        d: 'M' + (50 - rx * 0.2) + ' ' + (50 - ry * 0.9) + ' L ' + (50 - rx - 12) + ' 50 L ' + (50 - rx * 0.2) + ' ' + (50 + ry * 0.9) + ' Z',
                        fill: pal.accent, opacity: 0.55,
                    }));
                } else if (movement === 'jet') {
                    mv.appendChild(make('path', {
                        d: 'M' + (50 - rx + 2) + ' 44 L ' + (50 - rx + 2) + ' 56 L ' + (50 - rx - 10) + ' 50 Z',
                        fill: pal.detail, opacity: 0.9,
                    }));
                    mv.appendChild(make('circle', { cx: 50 - rx - 15, cy: 50, r: 3, fill: pal.accent, opacity: 0.5 }));
                } else if (movement === 'pseudopods') {
                    for (const oy of [-14, 0, 14]) {
                        mv.appendChild(make('ellipse', { cx: 50 - rx - 4, cy: 50 + oy, rx: 7, ry: 4, fill: pal.albedo, opacity: 0.9 }));
                    }
                } else {
                    for (let i = -2; i <= 2; i++) {
                        mv.appendChild(make('line', {
                            x1: 50 - rx, y1: 50 + i * 6, x2: 50 - rx - 9, y2: 50 + i * 6 + 2,
                            stroke: pal.accent, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.75,
                        }));
                    }
                }

                // Pattern overlay.
                const pt = el('pv-pattern'); clearGroup(pt);
                const pattern = chosen('pattern');
                if (pattern === 'stripe') {
                    for (const oy of [-ry * 0.4, 0, ry * 0.4]) {
                        pt.appendChild(make('line', { x1: 50 - rx * 0.55, y1: 50 + oy - 2, x2: 50 + rx * 0.55, y2: 50 + oy + 2, stroke: pal.accent, 'stroke-width': 2.4, opacity: 0.3 }));
                    }
                } else if (pattern === 'ring') {
                    pt.appendChild(make('ellipse', { cx: 50, cy: 50, rx: rx * 0.55, ry: ry * 0.55, fill: 'none', stroke: pal.accent, 'stroke-width': 2.4, opacity: 0.3 }));
                } else if (pattern === 'radial') {
                    for (let i = 0; i < 6; i++) {
                        const a = (i / 6) * Math.PI * 2;
                        pt.appendChild(make('line', {
                            x1: 50 + Math.cos(a) * rx * 0.25, y1: 50 + Math.sin(a) * ry * 0.25,
                            x2: 50 + Math.cos(a) * rx * 0.8, y2: 50 + Math.sin(a) * ry * 0.8,
                            stroke: pal.accent, 'stroke-width': 2, opacity: 0.3,
                        }));
                    }
                } else if (pattern && pattern !== 'plain') {
                    for (const [dx, dy] of [[-8, -6], [8, -10], [10, 8], [-10, 10], [0, 0]]) {
                        pt.appendChild(make('circle', { cx: 50 + dx, cy: 50 + dy, r: 2.6, fill: pal.accent, opacity: 0.3 }));
                    }
                }

                // Feeding (leading edge, right).
                const fd = el('pv-feeding'); clearGroup(fd);
                const feeding = chosen('feeding');
                const fx = 50 + rx * 0.82;
                if (feeding === 'gullet') {
                    fd.appendChild(make('circle', { cx: fx, cy: 50, r: 6, fill: '#06201d' }));
                } else if (feeding === 'pseudopod') {
                    fd.appendChild(make('ellipse', { cx: fx + 3, cy: 44, rx: 6, ry: 4, fill: pal.albedo }));
                    fd.appendChild(make('ellipse', { cx: fx + 3, cy: 56, rx: 6, ry: 4, fill: pal.albedo }));
                } else if (feeding === 'groove') {
                    fd.appendChild(make('line', { x1: fx - 5, y1: 45, x2: fx + 4, y2: 50, stroke: pal.detail, 'stroke-width': 2, 'stroke-linecap': 'round' }));
                    fd.appendChild(make('line', { x1: fx - 5, y1: 55, x2: fx + 4, y2: 50, stroke: pal.detail, 'stroke-width': 2, 'stroke-linecap': 'round' }));
                } else if (feeding === 'proboscis') {
                    fd.appendChild(make('line', { x1: fx - 2, y1: 50, x2: fx + 12, y2: 50, stroke: pal.detail, 'stroke-width': 2, 'stroke-linecap': 'round' }));
                    fd.appendChild(make('circle', { cx: fx + 12, cy: 50, r: 1.5, fill: pal.detail }));
                } else if (feeding === 'pore') {
                    for (const oy of [-4, 0, 4]) fd.appendChild(make('circle', { cx: fx, cy: 50 + oy, r: 1.6, fill: pal.detail }));
                } else if (feeding === 'filter') {
                    for (const oy of [-4, 0, 4]) fd.appendChild(make('line', { x1: fx, y1: 50 + oy - 2.5, x2: fx, y2: 50 + oy + 2.5, stroke: pal.detail, 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
                } else {
                    fd.appendChild(make('circle', { cx: fx, cy: 50, r: 4.5, fill: pal.detail }));
                    fd.appendChild(make('circle', { cx: fx + 3, cy: 50, r: 2, fill: '#06201d' }));
                }

                // Sensory (front-upper).
                const sn = el('pv-sensory'); clearGroup(sn);
                const sensory = chosen('sensory');
                const snx = 50 + rx * 0.35, sny = 50 - ry * 0.45;
                if (sensory === 'photosensor') {
                    sn.appendChild(make('rect', { x: snx - 4, y: sny - 1.6, width: 8, height: 3.2, rx: 1, fill: '#f2795f' }));
                } else if (sensory === 'chemobristle') {
                    for (const dx of [-3, 0, 3]) sn.appendChild(make('line', { x1: snx + dx, y1: sny, x2: snx + dx * 1.6, y2: sny - 8, stroke: pal.accent, 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
                } else if (sensory === 'stalk_eye') {
                    sn.appendChild(make('line', { x1: snx, y1: sny, x2: 50 + rx * 0.55, y2: 50 - ry * 0.95, stroke: pal.detail, 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
                    sn.appendChild(make('circle', { cx: 50 + rx * 0.55, cy: 50 - ry * 0.98, r: 3.5, fill: '#f2795f' }));
                } else if (sensory === 'pit') {
                    sn.appendChild(make('circle', { cx: snx, cy: sny, r: 4, fill: 'none', stroke: pal.detail, 'stroke-width': 2 }));
                    sn.appendChild(make('circle', { cx: snx, cy: sny, r: 1.6, fill: '#06201d' }));
                } else if (sensory === 'antenna') {
                    sn.appendChild(make('line', { x1: snx, y1: sny, x2: snx + 5, y2: sny - 14, stroke: pal.accent, 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
                    sn.appendChild(make('line', { x1: snx + 3, y1: sny, x2: snx + 11, y2: sny - 11, stroke: pal.accent, 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
                } else {
                    sn.appendChild(make('circle', { cx: snx, cy: sny, r: 3.2, fill: '#f2795f' }));
                }

                updateStats(sumEffects());
            }

            form.addEventListener('change', updatePreview);
            updatePreview();
        })();
    </script>
</body>
</html>
