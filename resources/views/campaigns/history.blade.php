<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name') }} — {{ $campaign->species_name }} history</title>
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
            <x-ui.button href="{{ route('dashboard') }}" variant="ghost" size="sm">Back to lineages</x-ui.button>
        </header>

        <main class="mx-auto max-w-2xl px-6 py-10">
            <div class="flex items-center gap-4 mb-6">
                <x-ui.species-portrait :seed="$campaign->seed" :traits="$campaign->traits->pluck('trait_id')->all()" :appearance="$campaign->appearance" class="w-16 h-16 flex-none" />
                <div>
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">Species history</p>
                    <h1 class="font-display font-bold text-h1 text-content">{{ $campaign->species_name }}</h1>
                </div>
            </div>

            <x-ui.panel class="p-6">
                <ol class="relative border-l border-ink-border ml-3">
                    <li class="mb-6 ml-6">
                        <span class="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand"></span>
                        <p class="font-mono text-label uppercase text-content-4">Origin</p>
                        <p class="font-display font-bold text-content">First light</p>
                        <p class="text-small text-content-2">A single cell stirred in the warm shallows. Your story starts here.</p>
                    </li>

                    @foreach ($history as $event)
                        <li class="mb-6 ml-6">
                            <span class="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full" style="background: var(--osl-res-evolution)"></span>
                            <p class="font-mono text-label uppercase text-content-4">{{ $event['category'] ?? 'event' }}</p>
                            <p class="font-display font-bold text-content">{{ $event['title'] ?? 'A change' }}</p>
                            <p class="text-small text-content-2">{{ $event['description'] ?? '' }}</p>
                        </li>
                    @endforeach
                </ol>

                @if ($campaign->completed)
                    <p class="mt-2 font-mono text-label uppercase tracking-[0.06em] text-content-4">
                        It began with one small life.
                    </p>
                @endif
            </x-ui.panel>
        </main>
    </div>
</body>
</html>
