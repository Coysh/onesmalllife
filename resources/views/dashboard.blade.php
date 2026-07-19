<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name') }} — Your lineages</title>
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
                <span class="text-small text-content-3">{{ auth()->user()->name }}</span>
                <a href="{{ route('settings') }}" class="text-small text-content-3 hover:text-content">Settings</a>
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit" class="text-small text-content-3 hover:text-content">Log out</button>
                </form>
            </div>
        </header>

        <main class="mx-auto max-w-3xl px-6 py-10">
            <div class="flex items-end justify-between mb-6">
                <div>
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">Your lineages</p>
                    <h1 class="font-display font-bold text-h1 text-content">Continue, or begin anew</h1>
                </div>
                <x-ui.button href="{{ route('campaigns.create') }}" variant="primary" size="lg">Begin a new lineage</x-ui.button>
            </div>

            @if (session('status'))
                <p class="mb-4 text-small text-[color:var(--osl-success)]">{{ session('status') }}</p>
            @endif

            {{-- The account Chronicle: what the whole bloodline has become. --}}
            @if ($chronicle['lineages'] > 0)
                <x-ui.panel class="mb-6 p-6">
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-4">Your Chronicle</p>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                        <div>
                            <p class="font-display font-extrabold text-h2 text-content leading-none">{{ $chronicle['lineages'] }}</p>
                            <p class="text-small text-content-3">Lineages raised</p>
                        </div>
                        <div>
                            <p class="font-display font-extrabold text-h2 text-content leading-none">{{ $chronicle['completed'] }}</p>
                            <p class="text-small text-content-3">Reached the stars</p>
                        </div>
                        <div>
                            <p class="font-display font-extrabold text-h2 text-content leading-none">{{ $chronicle['furthestStage'] }}</p>
                            <p class="text-small text-content-3">Furthest stage</p>
                        </div>
                        <div>
                            <p class="font-display font-extrabold text-h2 text-content leading-none">{{ $chronicle['playLabel'] }}</p>
                            <p class="text-small text-content-3">Lifetime</p>
                        </div>
                    </div>

                    <div class="border-t border-ink-border pt-4 mb-4">
                        <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-2">
                            Endings discovered · {{ $chronicle['familiesDiscovered'] }}/{{ $chronicle['familiesTotal'] }}
                        </p>
                        <div class="flex flex-wrap gap-2">
                            @foreach ($chronicle['families'] as $family)
                                <span @class([
                                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-small border',
                                    'text-content border-brand' => $family['discovered'],
                                    'text-content-4 border-ink-border' => ! $family['discovered'],
                                ])
                                      @if ($family['discovered']) style="background: color-mix(in srgb, var(--osl-brand) 10%, transparent)" @endif
                                      title="{{ $family['discovered'] ? $family['tagline'] : 'Not yet discovered' }}">
                                    <span class="h-1.5 w-1.5 rounded-full" style="background: {{ $family['discovered'] ? 'var(--osl-brand)' : '#5f8f8a' }}"></span>
                                    {{ $family['discovered'] ? $family['name'] : '— — —' }}
                                    @if ($family['count'] > 1) <span class="text-content-4">×{{ $family['count'] }}</span> @endif
                                </span>
                            @endforeach
                        </div>
                    </div>

                    <div class="border-t border-ink-border pt-4">
                        <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-2">
                            Adaptations collected · {{ $chronicle['adaptationsCollected'] }}/{{ $chronicle['adaptationsTotal'] }}
                        </p>
                        @if ($chronicle['adaptationsCollected'] > 0)
                            <div class="flex flex-wrap gap-1.5">
                                @foreach ($chronicle['adaptations'] as $adaptation)
                                    <span class="inline-block rounded-sm bg-ink-2 px-2 py-0.5 text-small text-content-2">{{ $adaptation['name'] }}</span>
                                @endforeach
                            </div>
                        @else
                            <p class="text-small text-content-4">Evolve adaptations in your lineages and they'll be recorded here forever.</p>
                        @endif
                    </div>
                </x-ui.panel>
            @endif

            @forelse ($campaigns as $campaign)
                <x-ui.panel class="mb-3 p-5">
                    <div class="flex items-center gap-5">
                        <x-ui.species-portrait :seed="$campaign->seed" :traits="$campaign->traits->pluck('trait_id')->all()" :appearance="$campaign->appearance" class="w-14 h-14 flex-none" />
                        <div class="flex-1 min-w-0">
                            <h2 class="font-display font-bold text-h3 text-content truncate">{{ $campaign->name }}</h2>
                            <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4">
                                Stage · {{ \App\Domain\Campaigns\Stage::from($campaign->current_stage)->label() }}
                                @if ($campaign->completed) · Complete @endif
                                @if ($campaign->last_played_at) · {{ $campaign->last_played_at->diffForHumans() }} @endif
                            </p>
                        </div>
                        <div class="flex items-center gap-2 flex-none">
                            <x-ui.button href="{{ route('play', $campaign) }}" variant="primary" size="md">Continue</x-ui.button>
                            <form method="POST" action="{{ route('campaigns.destroy', $campaign) }}"
                                  onsubmit="return confirm('End this lineage? This cannot be undone.');">
                                @csrf
                                @method('DELETE')
                                <x-ui.button variant="ghost" size="md">Delete</x-ui.button>
                            </form>
                        </div>
                    </div>
                </x-ui.panel>
            @empty
                <x-ui.panel class="p-7 text-center">
                    <x-ui.brand-mark class="mx-auto w-16 h-16 mb-3" />
                    <h2 class="font-display font-bold text-h3 text-content mb-1">No lineages yet</h2>
                    <p class="text-small text-content-2 mb-4">
                        It begins with one small life. Start a new lineage to steer your first cell.
                    </p>
                    <x-ui.button href="{{ route('campaigns.create') }}" variant="primary" size="lg">Begin a new lineage</x-ui.button>
                </x-ui.panel>
            @endforelse

            <p class="mt-6 text-small text-content-4">
                Controls in the Cell stage: <span class="font-mono">W A S D</span> / arrow keys, or hold the pointer to swim.
            </p>
        </main>
    </div>
</body>
</html>
