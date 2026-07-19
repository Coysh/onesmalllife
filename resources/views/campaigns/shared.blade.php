<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    {{-- Unlisted: reachable only by the token link, and never indexed. --}}
    <meta name="robots" content="noindex, nofollow">
    <title>{{ $campaign->species_name }} — {{ config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen antialiased">
    <main class="relative min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center overflow-hidden"
          style="background:
              radial-gradient(60% 60% at 50% 35%, rgba(79,212,196,.16), transparent 65%),
              radial-gradient(90% 60% at 50% 120%, rgba(245,185,85,.06), transparent 55%),
              var(--osl-bg);">

        <div class="relative max-w-xl w-full flex flex-col items-center gap-5">
            <x-ui.species-portrait :seed="$campaign->seed" :traits="$inheritedTraits" :appearance="$campaign->appearance" class="w-28 h-28" />

            <div>
                <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-2">A lineage · One Small Life</p>
                <h1 class="font-display font-extrabold text-h1 text-content mb-2">{{ $campaign->species_name }}</h1>
                @if ($ending)
                    <p class="text-body text-content-2">{{ $ending['name'] }} — {{ $ending['tagline'] }}</p>
                @else
                    <p class="text-body text-content-2">Still unfolding, now in the {{ \App\Domain\Campaigns\Stage::from($campaign->current_stage)->label() }} stage.</p>
                @endif
            </div>

            <x-ui.panel class="w-full p-6 text-left">
                @if ($ending)
                    <p class="text-small text-content-2 mb-4">{{ $ending['summary'] }}</p>
                @endif

                <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-2">
                    Adaptations carried · {{ count($adaptations) }}
                </p>
                @if (count($adaptations))
                    <div class="flex flex-wrap gap-1.5">
                        @foreach ($adaptations as $name)
                            <span class="inline-block rounded-sm bg-ink-2 px-2 py-0.5 text-small text-content-2">{{ $name }}</span>
                        @endforeach
                    </div>
                @else
                    <p class="text-small text-content-4">A young lineage, its adaptations still to come.</p>
                @endif
            </x-ui.panel>

            <div class="flex flex-col items-center gap-2 pt-1">
                <p class="text-small text-content-4">One small life, from a single cell to the stars.</p>
                <x-ui.button href="{{ url('/') }}" variant="primary" size="lg">Begin your own lineage</x-ui.button>
            </div>
        </div>
    </main>
</body>
</html>
