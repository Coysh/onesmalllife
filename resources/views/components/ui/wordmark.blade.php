@props([
    'as' => 'span',
    'size' => 'h2', // display | h1 | h2 | h3
])
{{--
    One Small Life — wordmark. Bricolage Grotesque 800, tight tracking, with
    "Small" always in brand teal. See handoff: Brand Foundation.
    Do not use "OSL" / "ONE SMALL LIFE" / "OneSmallLife" in player-facing text.
--}}
<{{ $as }} {{ $attributes->merge(['class' => "font-display font-extrabold tracking-tight text-content text-$size"]) }}>
    One <span class="text-brand">Small</span> Life
</{{ $as }}>
