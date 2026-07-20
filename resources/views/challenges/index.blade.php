<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name') }} — Challenges</title>
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
                <a href="{{ route('dashboard') }}" class="text-small text-content-3 hover:text-content">Dashboard</a>
                <a href="{{ route('gallery.index') }}" class="text-small text-content-3 hover:text-content">Gallery</a>
                <span class="text-small text-content-3">{{ auth()->user()->name }}</span>
            </div>
        </header>

        <main class="mx-auto max-w-3xl px-6 py-10">
            <div class="mb-6">
                <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">Same seed, every lineage</p>
                <h1 class="font-display font-bold text-h1 text-content">Challenges</h1>
                <p class="text-small text-content-3 mt-1">Everyone who joins a challenge starts from the exact same world. You still play entirely solo — afterward, compare how your choices played out against everyone else's.</p>
            </div>

            @if (session('status'))
                <p class="mb-4 text-small text-[color:var(--osl-success)]">{{ session('status') }}</p>
            @endif

            @foreach ([['label' => 'Daily challenge', 'seed' => $daily, 'mine' => $myDaily], ['label' => 'Weekly challenge', 'seed' => $weekly, 'mine' => $myWeekly]] as $row)
                <x-ui.panel class="mb-4 p-6">
                    <div class="flex items-center justify-between gap-4">
                        <div>
                            <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">{{ $row['label'] }}</p>
                            @if ($row['seed'])
                                <h2 class="font-display font-bold text-h3 text-content">{{ $row['seed']->label() }}</h2>
                            @else
                                <h2 class="font-display font-bold text-h3 text-content-4">Not generated yet — check back soon</h2>
                            @endif
                        </div>
                        @if ($row['seed'])
                            <div class="flex items-center gap-2 flex-none">
                                @if ($row['mine'])
                                    <x-ui.button href="{{ route('play', $row['mine']) }}" variant="primary" size="md">Continue</x-ui.button>
                                @else
                                    <x-ui.button href="{{ route('campaigns.create', ['challenge_seed_id' => $row['seed']->id]) }}" variant="primary" size="md">Start</x-ui.button>
                                @endif
                                <x-ui.button href="{{ route('challenges.show', $row['seed']) }}" variant="ghost" size="md">Leaderboard</x-ui.button>
                            </div>
                        @endif
                    </div>
                </x-ui.panel>
            @endforeach
        </main>
    </div>
</body>
</html>
