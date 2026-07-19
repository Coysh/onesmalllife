@props([
    'name' => 'objective',
    'filled' => false,
])
{{--
    One shared icon family (brief §17). 24×24 grid, 2px stroke, round caps/joins,
    recolours via `currentColor`. Size with a Tailwind class (default 20px).
    Inline per-icon (rather than a <use> sprite) — same currentColor recolouring,
    simpler to maintain in Blade. Pair icons with a text label; never icon-only
    for important actions.
--}}
@php
    // Each icon is a set of path/shape fragments drawn with currentColor.
    $icons = [
        'food' => '<path d="M12 4c-4 0-6 3-6 7 0 5 4 9 6 9s6-4 6-9c0-4-2-7-6-7z"/><path d="M12 4v16"/>',
        'energy' => '<path d="M12 3 5 13h6l-1 8 8-11h-6z"/>',
        'materials' => '<path d="M4 8l8-4 8 4-8 4z"/><path d="M4 8v8l8 4 8-4V8"/><path d="M12 12v8"/>',
        'population' => '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 20c0-3 2-5 5-5s5 2 5 5"/><path d="M13 20c0-3 2-5 5-5"/>',
        'health' => '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
        'defence' => '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
        'speed' => '<path d="M4 12h10"/><path d="M4 8h13"/><path d="M4 16h7"/><path d="M14 6l6 6-6 6"/>',
        'intelligence' => '<circle cx="12" cy="10" r="6"/><path d="M9 19h6M10 22h4"/>',
        'social' => '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
        'aggression' => '<path d="M4 20L20 4M14 4h6v6"/>',
        'environment' => '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
        'technology' => '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
        'culture' => '<path d="M6 4c4 2 8 2 12 0v14c-4 2-8 2-12 0z"/><path d="M12 4v14"/>',
        'diplomacy' => '<path d="M8 11l-4 2 4 2M16 11l4 2-4 2"/><path d="M9 13h6"/>',
        'territory' => '<path d="M6 4v16M6 4l12 3-4 3 4 3-12 3"/>',
        'planet-health' => '<circle cx="12" cy="12" r="8"/><path d="M4 12c4 3 12 3 16 0M8 5c-2 4-2 10 0 14"/>',
        'research' => '<path d="M4 4l8 4 8-4M12 8v6M8 20l4-6 4 6"/>',
        'space-travel' => '<path d="M12 3c4 3 5 8 5 12l-5 4-5-4c0-4 1-9 5-12z"/><circle cx="12" cy="10" r="2"/>',
        'warning' => '<path d="M12 4l9 16H3z"/><path d="M12 10v5M12 18h.01"/>',
        'objective' => '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 12l2 2 4-4"/>',
        'save' => '<path d="M5 5h11l3 3v11H5z"/><path d="M8 5v5h7V5M8 19v-5h8v5"/>',
    ];
    $body = $icons[$name] ?? $icons['objective'];
@endphp
<svg {{ $attributes->merge(['class' => 'w-5 h-5', 'aria-hidden' => 'true']) }}
     viewBox="0 0 24 24" fill="{{ $filled ? 'currentColor' : 'none' }}" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
    {!! $body !!}
</svg>
