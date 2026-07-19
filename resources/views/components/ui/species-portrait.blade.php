@props([
    'seed' => 'one-small-life',
    'traits' => [],
    'appearance' => null,
])
{{--
    Species portrait — composed from the same parts the game uses, via
    PortraitComposer (brief §15). Size with a Tailwind class, e.g. class="w-32 h-32".
--}}
@php($p = \App\Domain\Species\PortraitComposer::spec($seed, is_array($traits) ? $traits : [], is_array($appearance) ? $appearance : null))
<svg {{ $attributes->merge(['class' => 'w-32 h-32', 'role' => 'img', 'aria-label' => 'Species portrait']) }}
     viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {{-- shadow --}}
    <ellipse cx="50" cy="{{ 50 + $p['ry'] * 0.55 }}" rx="{{ $p['rx'] * 1.05 }}" ry="{{ $p['ry'] * 0.32 }}" fill="#000000" opacity="0.22" />

    {{-- defense: plated/spiked styles read differently from the soft sheen --}}
    @if ($p['defense'])
        @if ($p['defenseStyle'] === 'spike_ring' || $p['defenseStyle'] === 'spines')
            @for ($i = 0; $i < 10; $i++)
                @php($a = $i / 10 * 6.2832)
                <line x1="{{ 50 + cos($a) * $p['rx'] }}" y1="{{ 50 + sin($a) * $p['ry'] }}"
                      x2="{{ 50 + cos($a) * ($p['rx'] + 7) }}" y2="{{ 50 + sin($a) * ($p['ry'] + 7) }}"
                      stroke="{{ $p['detail'] }}" stroke-width="2" stroke-linecap="round" opacity="0.85" />
            @endfor
        @elseif ($p['defenseStyle'] === 'thick_wall')
            <ellipse cx="50" cy="50" rx="{{ $p['rx'] + 3 }}" ry="{{ $p['ry'] + 3 }}" fill="none" stroke="{{ $p['detail'] }}" stroke-width="4" opacity="0.85" />
        @else
            <ellipse cx="50" cy="50" rx="{{ $p['rx'] + 6 }}" ry="{{ $p['ry'] + 6 }}" fill="{{ $p['accent'] }}" opacity="0.16" />
        @endif
    @endif

    {{-- movement (trailing, left) --}}
    @if ($p['movement'] === 'flagellum' || $p['movement'] === 'twin_flagella')
        <path d="M{{ 50 - $p['rx'] }} 50 q -14 -6 -22 4 q 8 4 20 2 z" fill="{{ $p['detail'] }}" opacity="0.9" />
    @else
        @for ($i = -2; $i <= 2; $i++)
            <line x1="{{ 50 - $p['rx'] }}" y1="{{ 50 + $i * 6 }}" x2="{{ 50 - $p['rx'] - 9 }}" y2="{{ 50 + $i * 6 + 2 }}" stroke="{{ $p['accent'] }}" stroke-width="2" stroke-linecap="round" opacity="0.75" />
        @endfor
    @endif

    {{-- body --}}
    <ellipse cx="50" cy="50" rx="{{ $p['rx'] }}" ry="{{ $p['ry'] }}" fill="{{ $p['albedo'] }}" />

    {{-- pattern --}}
    @if ($p['pattern'])
        @foreach ([[42,44],[58,40],[60,58],[40,60],[50,50]] as $d)
            <circle cx="{{ $d[0] }}" cy="{{ $d[1] }}" r="2.6" fill="{{ $p['accent'] }}" opacity="0.3" />
        @endforeach
    @endif

    {{-- nucleus --}}
    <circle cx="46" cy="48" r="{{ $p['rx'] * 0.4 }}" fill="{{ $p['accent'] }}" opacity="0.5" />
    <circle cx="46" cy="48" r="{{ $p['rx'] * 0.18 }}" fill="#ffffff" opacity="0.5" />

    {{-- membrane --}}
    <ellipse cx="50" cy="50" rx="{{ $p['rx'] }}" ry="{{ $p['ry'] }}" fill="none" stroke="{{ $p['detail'] }}"
             stroke-width="{{ $p['membrane'] === 'double' || $p['membrane'] === 'ridged' ? 3.5 : 2.5 }}" opacity="0.9" />
    @if ($p['membrane'] === 'double')
        <ellipse cx="50" cy="50" rx="{{ $p['rx'] - 5 }}" ry="{{ $p['ry'] - 5 }}" fill="none" stroke="{{ $p['accent'] }}" stroke-width="1.5" opacity="0.6" />
    @endif

    {{-- feeding (leading, right) --}}
    @if ($p['feeding'])
        <circle cx="{{ 50 + $p['rx'] * 0.85 }}" cy="50" r="4.5" fill="{{ $p['detail'] }}" />
        <circle cx="{{ 50 + $p['rx'] * 0.92 }}" cy="50" r="2" fill="#06201d" />
    @endif

    {{-- sensory (front-upper) --}}
    @if ($p['sensory'])
        <line x1="{{ 50 + $p['rx'] * 0.4 }}" y1="{{ 50 - $p['ry'] * 0.5 }}" x2="{{ 50 + $p['rx'] * 0.55 }}" y2="{{ 50 - $p['ry'] * 0.9 }}" stroke="{{ $p['detail'] }}" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="{{ 50 + $p['rx'] * 0.55 }}" cy="{{ 50 - $p['ry'] * 0.92 }}" r="3.5" fill="#f2795f" />
    @else
        <circle cx="{{ 50 + $p['rx'] * 0.35 }}" cy="{{ 50 - $p['ry'] * 0.45 }}" r="3.2" fill="#f2795f" />
    @endif

    {{-- highlight --}}
    <circle cx="{{ 50 - $p['rx'] * 0.35 }}" cy="{{ 50 - $p['ry'] * 0.4 }}" r="{{ $p['rx'] * 0.22 }}" fill="#ffffff" opacity="0.16" />
</svg>
