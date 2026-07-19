<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ config('app.name', 'One Small Life') }} — from a single cell to the stars</title>
    <meta name="description" content="One small life. An entire universe of possibilities. Guide one unbroken lineage from a single cell, through creatures and civilisations, all the way to the stars. Free, single-player, and made with love.">

    <meta property="og:title" content="One Small Life">
    <meta property="og:description" content="From a single cell to the stars — six stages, one continuous thread. Free to play.">
    <meta property="og:type" content="website">

    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen antialiased" style="background: var(--osl-bg);">

    {{-- ===================== NAV ===================== --}}
    <header class="sticky top-0 z-panel border-b border-ink-border/60"
            style="background: var(--osl-surface-glass); backdrop-filter: blur(10px);">
        <div class="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
            <a href="#top" class="flex items-center gap-3" aria-label="One Small Life">
                <x-ui.brand-mark class="w-8 h-8" />
                <x-ui.wordmark size="h3" />
            </a>
            <nav class="flex items-center gap-3">
                @auth
                    <x-ui.button href="{{ url('/dashboard') }}" variant="primary" size="sm">Continue your lineage</x-ui.button>
                @else
                    <a href="{{ route('login') }}" class="hidden sm:inline text-small text-content-3 hover:text-content px-2">Log in</a>
                    <x-ui.button href="{{ route('register') }}" variant="primary" size="sm">Create a free account</x-ui.button>
                @endauth
            </nav>
        </div>
    </header>

    {{-- ===================== HERO ===================== --}}
    <main id="top">
        <section class="relative overflow-hidden px-5 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center"
                 style="background:
                     radial-gradient(120% 80% at 50% -10%, rgba(79,212,196,.14), transparent 60%),
                     radial-gradient(90% 60% at 50% 120%, rgba(245,185,85,.06), transparent 55%),
                     var(--osl-bg);">
            <div class="pointer-events-none absolute inset-0 osl-motes" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>

            <div class="relative mx-auto max-w-3xl flex flex-col items-center gap-6">
                <x-ui.brand-mark class="w-20 h-20 osl-float" />

                <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4">
                    Free · Single-player · In your browser
                </p>

                <x-ui.wordmark as="h1" size="display" />

                <p class="text-h3 font-display text-content-2 max-w-xl">
                    From a single cell to the stars — six stages, one unbroken thread.
                </p>
                <p class="text-body text-content-3 max-w-xl">
                    Guide one continuous lineage out of a warm tide pool, through creatures and
                    tribes and civilisations, until it reaches for other stars. Every little choice
                    you make at the start echoes all the way to the end.
                </p>

                <div class="mt-2 flex flex-col sm:flex-row items-stretch gap-3">
                    @auth
                        <x-ui.button href="{{ url('/dashboard') }}" variant="primary" size="lg">Continue your lineage</x-ui.button>
                    @else
                        <x-ui.button href="{{ route('register') }}" variant="primary" size="lg">Create a free account &amp; play</x-ui.button>
                        <x-ui.button href="{{ route('login') }}" variant="secondary" size="lg">Log in</x-ui.button>
                    @endauth
                </div>
                <p class="text-small text-content-4">Takes about two minutes to start steering your first cell.</p>
            </div>

            <div class="relative mx-auto max-w-4xl mt-12">
                <x-ui.shot label="The Cell stage" caption="Placeholder — real captures coming as the game fills out." />
            </div>
        </section>

        {{-- ===================== THE JOURNEY ===================== --}}
        <section class="px-5 py-16 sm:py-20 border-t border-ink-border/60">
            <div class="mx-auto max-w-6xl">
                <div class="text-center max-w-2xl mx-auto mb-10">
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-brand-hi mb-2">The journey</p>
                    <h2 class="text-h1 font-display font-bold text-content mb-3">One life, six worlds</h2>
                    <p class="text-body text-content-3">
                        Each stage flows into the next, and your lineage carries everything it learns.
                        The armour you grow as a cell, the curiosity you nurture as a creature — it all
                        shapes the civilisation you become.
                    </p>
                </div>

                <ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    @php
                        $stages = [
                            ['n' => 1, 'name' => 'Cell', 'icon' => 'environment', 'text' => "Drift, feed, and dodge whatever's hungrier than you. Absorb nutrients, survive the tide pool, and earn your first mutations."],
                            ['n' => 2, 'name' => 'Creature', 'icon' => 'social', 'text' => 'Grow a body, explore the shore, meet your own kind, raise young, and pass your adaptations on.'],
                            ['n' => 3, 'name' => 'Tribe', 'icon' => 'culture', 'text' => 'Gather a people, build shelter, and kindle the first sparks of a culture all your own.'],
                            ['n' => 4, 'name' => 'Civilisation', 'icon' => 'technology', 'text' => 'Cities, trade, technology — and neighbours who don\'t always want what you want.'],
                            ['n' => 5, 'name' => 'Planetary', 'icon' => 'planet-health', 'text' => 'Balance industry against a living world. Unite your planet, or watch it fracture.'],
                            ['n' => 6, 'name' => 'Space', 'icon' => 'space-travel', 'text' => 'Reach for other stars, seed new worlds, and decide what your lineage leaves behind.'],
                        ];
                    @endphp
                    @foreach ($stages as $stage)
                        <li>
                            <x-ui.panel class="h-full p-5">
                                <div class="flex items-center gap-3 mb-2">
                                    <span class="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-ink-2 text-brand">
                                        <x-ui.icon :name="$stage['icon']" class="w-5 h-5" />
                                    </span>
                                    <div>
                                        <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4">Stage {{ $stage['n'] }}</p>
                                        <h3 class="font-display font-bold text-h3 text-content leading-none">{{ $stage['name'] }}</h3>
                                    </div>
                                </div>
                                <p class="text-small text-content-2">{{ $stage['text'] }}</p>
                            </x-ui.panel>
                        </li>
                    @endforeach
                </ol>
            </div>
        </section>

        {{-- ===================== WHY YOU MIGHT LOVE IT ===================== --}}
        <section class="px-5 py-16 sm:py-20 border-t border-ink-border/60"
                 style="background: linear-gradient(180deg, transparent, rgba(79,212,196,.03));">
            <div class="mx-auto max-w-6xl">
                <div class="text-center max-w-2xl mx-auto mb-10">
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-brand-hi mb-2">Why you might love it</p>
                    <h2 class="text-h1 font-display font-bold text-content">Big feelings, gentle learning curve</h2>
                </div>

                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    @php
                        $features = [
                            ['icon' => 'objective', 'title' => 'Your choices actually stick', 'text' => 'A trait you pick as a single cell can still be shaping your civilisation billions of years later. Nothing is throwaway.'],
                            ['icon' => 'environment', 'title' => 'Evolution you can see', 'text' => 'Your organism visibly changes as it adapts — new membranes, tails, senses. The creature on screen is the story you wrote.'],
                            ['icon' => 'save', 'title' => 'Finishable in an evening or two', 'text' => 'A whole run lands around 5–8 hours, with a real ending. It respects your time — no endless grind.'],
                            ['icon' => 'research', 'title' => 'No two lineages the same', 'text' => 'Worlds, species, rivals and events are all generated fresh, so every journey is its own story.'],
                            ['icon' => 'diplomacy', 'title' => 'Light strategy, big heart', 'text' => 'Easy to pick up, with just enough to think about — rivals to befriend or outmanoeuvre, worlds to tend or exploit.'],
                            ['icon' => 'health', 'title' => 'Free, and kind about it', 'text' => 'Single-player, free to play, no ads, no nonsense. Just you and one small life, all the way to the stars.'],
                        ];
                    @endphp
                    @foreach ($features as $f)
                        <x-ui.panel class="h-full p-5">
                            <span class="flex h-10 w-10 items-center justify-center rounded-md bg-ink-2 text-brand mb-3">
                                <x-ui.icon :name="$f['icon']" class="w-5 h-5" />
                            </span>
                            <h3 class="font-display font-bold text-content mb-1">{{ $f['title'] }}</h3>
                            <p class="text-small text-content-2">{{ $f['text'] }}</p>
                        </x-ui.panel>
                    @endforeach
                </div>
            </div>
        </section>

        {{-- ===================== SCREENSHOTS ===================== --}}
        <section class="px-5 py-16 sm:py-20 border-t border-ink-border/60">
            <div class="mx-auto max-w-6xl">
                <div class="text-center max-w-2xl mx-auto mb-10">
                    <p class="font-mono text-label uppercase tracking-[0.06em] text-brand-hi mb-2">A peek inside</p>
                    <h2 class="text-h1 font-display font-bold text-content mb-3">Warm, glowing, and a little strange</h2>
                    <p class="text-body text-content-3">
                        A warm lamp over a dark tank, not a cold simulator. (These are placeholders for
                        now — I'll swap in real captures as each stage comes to life.)
                    </p>
                </div>

                <div class="grid gap-5 sm:grid-cols-2">
                    <x-ui.shot label="Cell" caption="Steer, feed, and dodge predators in the tide pool." />
                    <x-ui.shot label="Creature" caption="Grow a body and gather a pack along the shore." />
                    <x-ui.shot label="Civilisation" caption="Guide settlements, tech, and touchy neighbours." />
                    <x-ui.shot label="The ending" caption="Every run resolves into a legacy that's yours." />
                </div>
            </div>
        </section>

        {{-- ===================== SPORE NOD ===================== --}}
        <section class="px-5 py-16 sm:py-20 border-t border-ink-border/60">
            <div class="mx-auto max-w-3xl text-center">
                <p class="font-mono text-label uppercase tracking-[0.06em] text-brand-hi mb-3">Remember Spore?</p>
                <h2 class="text-h1 font-display font-bold text-content mb-4">Yeah. Me too.</h2>
                <p class="text-body text-content-2">
                    If you ever lost a school holiday nudging a wobbly little creature from the
                    primordial soup all the way to a galactic empire — hi, kindred spirit.
                    <span class="text-content">One Small Life</span> is my love letter to that exact feeling:
                    the cell-to-galaxy dream, made faster, friendlier, and actually finishable in a
                    sitting or two.
                </p>
                <p class="text-body text-content-3 mt-4">
                    It's very much its own thing — its own creatures, its own choices, its own warm
                    little world — but that giddy <em>“look how far we've come”</em> is exactly what
                    I'm chasing. (Spore is a trademark of its own studio; this is a fan's tribute, not
                    affiliated with them.)
                </p>
            </div>
        </section>

        {{-- ===================== FROM TIM ===================== --}}
        <section class="px-5 py-16 sm:py-20 border-t border-ink-border/60"
                 style="background: linear-gradient(180deg, rgba(245,185,85,.04), transparent);">
            <div class="mx-auto max-w-2xl">
                <x-ui.panel class="p-6 sm:p-8">
                    <div class="flex items-center gap-3 mb-4">
                        <x-ui.brand-mark class="w-10 h-10" />
                        <div>
                            <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4">From the developer</p>
                            <h2 class="font-display font-bold text-h3 text-content">Hey, I'm Tim.</h2>
                        </div>
                    </div>
                    <div class="space-y-3 text-body text-content-2">
                        <p>
                            I'm building One Small Life on my own, mostly in the evenings, because I kept
                            wishing this exact game existed and eventually figured I'd better just make it.
                        </p>
                        <p>
                            It's a personal project and a proper labour of love, which means it's a little
                            rough around the edges and it grows every week. If you play it now, you're
                            genuinely along for the ride with me — bugs, half-finished bits, and all.
                        </p>
                        <p>
                            If it makes you smile even once, that's the whole point. And if you've got
                            thoughts, I'd love to hear them. Thanks for being here. 🌱
                        </p>
                    </div>
                    <p class="mt-5 font-display font-bold text-content">— Tim</p>
                </x-ui.panel>
            </div>
        </section>

        {{-- ===================== FINAL CTA ===================== --}}
        <section class="px-5 py-20 border-t border-ink-border/60 text-center"
                 style="background: radial-gradient(70% 70% at 50% 30%, rgba(79,212,196,.12), transparent 65%), var(--osl-bg);">
            <div class="mx-auto max-w-xl flex flex-col items-center gap-5">
                <x-ui.brand-mark class="w-16 h-16 osl-float" />
                <h2 class="text-h1 font-display font-bold text-content">Ready to begin?</h2>
                <p class="text-body text-content-3">
                    Create a free account and steer your first cell in a couple of minutes. It's early,
                    it's free, and it all starts with one small life.
                </p>
                @auth
                    <x-ui.button href="{{ url('/dashboard') }}" variant="primary" size="lg">Continue your lineage</x-ui.button>
                @else
                    <x-ui.button href="{{ route('register') }}" variant="primary" size="lg">Create a free account &amp; play</x-ui.button>
                @endauth
                <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4">It began with one small life</p>
            </div>
        </section>
    </main>

    {{-- ===================== FOOTER ===================== --}}
    <footer class="px-5 py-8 border-t border-ink-border/60">
        <div class="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-small text-content-4">
            <div class="flex items-center gap-2">
                <x-ui.brand-mark class="w-6 h-6" />
                <span>One Small Life — a personal project by Tim.</span>
            </div>
            <p>Free to play · Single-player · Made with care (and a lot of tea).</p>
        </div>
    </footer>

</body>
</html>
