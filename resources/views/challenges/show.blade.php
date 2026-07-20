<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name') }} — {{ $challengeSeed->label() }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen antialiased">
    <div class="relative min-h-screen"
         style="background:
             radial-gradient(120% 70% at 50% -10%, rgba(79,212,196,.10), transparent 60%),
             var(--osl-bg);">

        <header class="flex items-center justify-between px-6 py-4">
            <a href="{{ url('/') }}" class="flex items-center gap-3" aria-label="One Small Life">
                <x-ui.brand-mark class="w-9 h-9" />
                <x-ui.wordmark size="h3" />
            </a>
            <div class="flex items-center gap-4">
                <a href="{{ route('challenges.index') }}" class="text-small text-content-3 hover:text-content">Challenges</a>
                <a href="{{ route('dashboard') }}" class="text-small text-content-3 hover:text-content">Dashboard</a>
            </div>
        </header>

        <main class="mx-auto max-w-3xl px-6 py-10">
            <div class="mb-6 flex items-end justify-between gap-4">
                <div>
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">{{ $challengeSeed->label() }}</p>
                    <h1 class="font-display font-bold text-h1 text-content">Leaderboard</h1>
                </div>
                @if ($myCampaign)
                    <x-ui.button href="{{ route('play', $myCampaign) }}" variant="primary" size="md">Continue your run</x-ui.button>
                @else
                    <x-ui.button href="{{ route('campaigns.create', ['challenge_seed_id' => $challengeSeed->id]) }}" variant="primary" size="md">Join this challenge</x-ui.button>
                @endif
            </div>

            @if (count($leaderboard))
                <x-ui.panel class="p-4">
                    <div class="divide-y divide-ink-border">
                        @foreach ($leaderboard as $entry)
                            <div class="flex items-center gap-4 py-3">
                                <span class="font-mono text-content-4 w-6 text-right flex-none">{{ $entry['rank'] }}</span>
                                <x-ui.species-portrait :seed="$entry['campaign']->seed" :traits="$entry['campaign']->traits->pluck('trait_id')->all()" :appearance="$entry['campaign']->appearance" class="w-10 h-10 flex-none" />
                                <div class="flex-1 min-w-0">
                                    <p class="text-content font-semibold truncate">{{ $entry['speciesName'] }}</p>
                                    <p class="text-small text-content-4">{{ $entry['ending']['name'] ?? 'Unknown ending' }} · {{ $entry['adaptations'] }} adaptations</p>
                                </div>
                                <div class="text-right flex-none">
                                    <p class="font-mono text-content">{{ $entry['playLabel'] }}</p>
                                    @if ($entry['shareUrl'])
                                        <a href="{{ $entry['shareUrl'] }}" class="text-small text-content-4 hover:text-content">View</a>
                                    @endif
                                </div>
                            </div>
                        @endforeach
                    </div>
                </x-ui.panel>
            @else
                <x-ui.panel class="p-7 text-center">
                    <h2 class="font-display font-bold text-h3 text-content mb-1">No entries yet</h2>
                    <p class="text-small text-content-2">Be the first to finish this challenge and join the public gallery to appear here.</p>
                </x-ui.panel>
            @endif
        </main>
    </div>
</body>
</html>
