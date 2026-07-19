@props([
    'as' => 'div',
    'glass' => false, // translucent floating surface (HUD chrome) vs solid card
])
{{--
    Tidepool surface panel. Solid card by default (ink.surface); pass :glass to
    get the translucent floating-HUD treatment used at the screen edges.
    See handoff: Interface Shell.
--}}
<{{ $as }}
    {{ $attributes->merge([
        'class' => $glass
            ? 'rounded-lg border border-[color:var(--osl-border-glow)] bg-[color:var(--osl-surface-glass)] backdrop-blur-md shadow-e2'
            : 'rounded-lg border border-ink-border bg-ink-surface shadow-e2',
    ]) }}
>
    {{ $slot }}
</{{ $as }}>
