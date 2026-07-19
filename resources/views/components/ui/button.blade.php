@props([
    'variant' => 'primary', // primary | secondary | ghost | danger
    'size' => 'md',         // sm | md | lg
    'href' => null,         // render as <a> when provided
])
{{--
    Tidepool button. Colour + label, min 44px touch target at md/lg for tablet.
    Renders as <a> when :href is set, otherwise a <button type=submit>.
    See handoff: Motion and Feedback (press ~120ms) and Design Tokens.
--}}
@php
    $base = 'inline-flex items-center justify-center gap-2 font-semibold text-center rounded-md '
        . 'transition duration-fast ease-osl focus-visible:outline-none disabled:opacity-disabled '
        . 'disabled:pointer-events-none select-none';

    $sizes = [
        'sm' => 'text-small px-4 py-2 min-h-[36px]',
        'md' => 'text-small px-5 py-3 min-h-[44px]',
        'lg' => 'text-body px-6 py-3 min-h-[48px]',
    ];

    $variants = [
        'primary'   => 'bg-brand text-[color:var(--osl-text-on-brand)] hover:bg-brand-hi active:bg-brand-deep shadow-e1',
        'secondary' => 'bg-transparent text-content border border-ink-border hover:border-brand hover:text-content active:bg-ink-surface2',
        'ghost'     => 'bg-transparent text-content-2 hover:text-content hover:bg-ink-surface',
        'danger'    => 'bg-accent text-[color:var(--osl-brand-ink)] hover:bg-[color:var(--osl-accent-deep)]',
    ];

    $classes = trim($base . ' ' . ($sizes[$size] ?? $sizes['md']) . ' ' . ($variants[$variant] ?? $variants['primary']));
@endphp

@if ($href)
    <a href="{{ $href }}" {{ $attributes->merge(['class' => $classes]) }}>{{ $slot }}</a>
@else
    <button {{ $attributes->merge(['type' => 'submit', 'class' => $classes]) }}>{{ $slot }}</button>
@endif
