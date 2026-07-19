<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name') }} — {{ $ending['name'] }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen antialiased">
    <main class="relative min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center overflow-hidden"
          style="background:
              radial-gradient(60% 60% at 50% 35%, rgba(79,212,196,.16), transparent 65%),
              radial-gradient(90% 60% at 50% 120%, rgba(245,185,85,.06), transparent 55%),
              var(--osl-bg);">

        {{-- A quiet drift of stars behind the send-off (deterministic per seed). --}}
        @php($rand = crc32($campaign->seed))
        <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
            @for ($i = 0; $i < 64; $i++)
                @php($rand = ($rand * 1103515245 + 12345) & 0x7fffffff)
                @php($sx = ($rand % 1000) / 10)
                @php($rand = ($rand * 1103515245 + 12345) & 0x7fffffff)
                @php($sy = ($rand % 1000) / 10)
                @php($rand = ($rand * 1103515245 + 12345) & 0x7fffffff)
                @php($dur = 2 + ($rand % 40) / 10)
                <span class="osl-star" style="left: {{ $sx }}%; top: {{ $sy }}%; animation-duration: {{ $dur }}s; animation-delay: {{ ($i % 12) / 4 }}s"></span>
            @endfor
        </div>
        <style>
            .osl-star { position: absolute; width: 2px; height: 2px; border-radius: 9999px; background: #cfeaf3; opacity: .45; animation: oslTwinkle ease-in-out infinite; }
            @keyframes oslTwinkle { 0%, 100% { opacity: .2; transform: scale(1); } 50% { opacity: .9; transform: scale(1.7); } }
            @media (prefers-reduced-motion: reduce) { .osl-star { animation: none; opacity: .5; } }
        </style>

        <div class="relative max-w-2xl flex flex-col items-center gap-5">
            <x-ui.species-portrait :seed="$campaign->seed" :traits="$inheritedTraits" :appearance="$campaign->appearance" class="w-28 h-28" />

            <div>
                <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-2">An ending · {{ $campaign->species_name }}</p>
                <h1 class="font-display font-extrabold text-h1 text-content mb-2">{{ $ending['name'] }}</h1>
                <p class="text-body text-content-2">{{ $ending['tagline'] }}</p>
            </div>

            <x-ui.panel class="w-full p-6 text-left">
                <p class="text-small text-content-2 mb-4">{{ $ending['summary'] }}</p>

                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p class="font-mono text-label uppercase text-content-4">Species</p>
                        <p class="text-content">{{ $campaign->species_name }}</p>
                    </div>
                    <div>
                        <p class="font-mono text-label uppercase text-content-4">Stages crossed</p>
                        <p class="text-content">6 · Cell to the stars</p>
                    </div>
                    <div>
                        <p class="font-mono text-label uppercase text-content-4">Inherited adaptations</p>
                        <p class="text-content">{{ count($inheritedTraits) }}</p>
                    </div>
                    <div>
                        <p class="font-mono text-label uppercase text-content-4">Recorded events</p>
                        <p class="text-content">{{ count($history) }}</p>
                    </div>
                </div>

                @if (count($history))
                    <div class="border-t border-ink-border pt-4 mb-4">
                        <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-3">The journey</p>
                        <div class="space-y-3">
                            @foreach (array_slice($history, -6) as $moment)
                                <div class="flex gap-3">
                                    <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" style="background: var(--osl-brand)"></span>
                                    <div>
                                        <p class="text-small text-content font-semibold">{{ $moment['title'] ?? 'A moment' }}</p>
                                        @if (!empty($moment['description']))
                                            <p class="text-small text-content-3">{{ $moment['description'] }}</p>
                                        @endif
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endif

                <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 border-t border-ink-border pt-4">
                    It began with one small life.
                </p>
            </x-ui.panel>

            {{-- Opt-in sharing: mint or revoke a public, unlisted showcase link. --}}
            <div class="w-full">
                @if ($campaign->isShared())
                    <x-ui.panel class="p-4">
                        <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-2">Shared lineage</p>
                        <div class="flex items-center gap-2">
                            <input type="text" readonly value="{{ $campaign->shareUrl() }}" onclick="this.select()"
                                   class="flex-1 min-w-0 rounded-sm bg-ink-2 px-3 py-2 text-small text-content-2 border border-ink-border">
                            <button type="button"
                                    onclick="navigator.clipboard && navigator.clipboard.writeText('{{ $campaign->shareUrl() }}'); this.textContent = 'Copied';"
                                    class="shrink-0 rounded-md border border-ink-border px-4 py-2 text-small text-content hover:border-brand transition duration-fast">Copy</button>
                            <form method="POST" action="{{ route('campaigns.unshare', $campaign) }}" class="shrink-0">
                                @csrf
                                @method('DELETE')
                                <x-ui.button variant="ghost" size="md">Stop</x-ui.button>
                            </form>
                        </div>
                        <p class="text-small text-content-4 mt-2">Anyone with this link can view this lineage. Unlisted — never searchable.</p>
                    </x-ui.panel>
                @else
                    <form method="POST" action="{{ route('campaigns.share', $campaign) }}">
                        @csrf
                        <x-ui.button variant="secondary" size="md" class="w-full">Share this lineage</x-ui.button>
                    </form>
                @endif
            </div>

            {{-- Extended play (brief §21) --}}
            <div class="w-full grid sm:grid-cols-3 gap-3">
                <a href="{{ route('play', $campaign) }}" class="pointer-events-auto">
                    <x-ui.panel class="h-full p-4 text-left hover:border-brand transition duration-fast" style="border-color: var(--osl-brand-deep)">
                        <span class="inline-block h-3 w-3 mb-2 rotate-45" style="background: var(--osl-res-evolution); clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%)"></span>
                        <p class="font-display font-bold text-content">Continue the lineage</p>
                        <p class="text-small text-content-3">Keep playing in free-form — no fail state.</p>
                    </x-ui.panel>
                </a>
                <a href="{{ route('campaigns.create') }}" class="pointer-events-auto">
                    <x-ui.panel class="h-full p-4 text-left hover:border-brand transition duration-fast">
                        <span class="inline-block h-3 w-3 mb-2 rounded-full" style="background: var(--osl-trait-bio)"></span>
                        <p class="font-display font-bold text-content">A fresh lineage</p>
                        <p class="text-small text-content-3">Begin again with a new cell and world.</p>
                    </x-ui.panel>
                </a>
                <a href="{{ route('campaigns.history', $campaign) }}" class="pointer-events-auto">
                    <x-ui.panel class="h-full p-4 text-left hover:border-brand transition duration-fast">
                        <span class="inline-block h-3 w-3 mb-2 rounded-sm" style="background: var(--osl-brand)"></span>
                        <p class="font-display font-bold text-content">View full history</p>
                        <p class="text-small text-content-3">The timeline of everything your lineage did.</p>
                    </x-ui.panel>
                </a>
            </div>
            <x-ui.button href="{{ route('dashboard') }}" variant="ghost" size="md">Back to lineages</x-ui.button>
        </div>
    </main>
</body>
</html>
