@props([
    'label' => 'Screenshot',
    'caption' => null,
    'src' => null,
    'ratio' => 'aspect-video',
])
{{-- To use a real image later, pass a :src (e.g. the asset() URL of a PNG). --}}
{{--
    Screenshot placeholder in the Tidepool style. When `src` is provided it shows
    the real image; otherwise a labelled placeholder so the page looks intentional
    before real captures exist. Swap in images by passing :src.
--}}
<figure {{ $attributes->merge(['class' => 'group']) }}>
    <div class="relative {{ $ratio }} w-full overflow-hidden rounded-lg border border-ink-border bg-ink-surface shadow-e2">
        @if ($src)
            <img src="{{ $src }}" alt="{{ $label }}" class="h-full w-full object-cover" loading="lazy">
        @else
            {{-- Placeholder: soft glow + faint brand mark + label --}}
            <div class="absolute inset-0"
                 style="background:
                     radial-gradient(120% 90% at 50% 0%, rgba(79,212,196,.10), transparent 60%),
                     linear-gradient(180deg, #0f2b30, #0a2429);"></div>
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                <x-ui.brand-mark class="w-10 h-10 opacity-40" />
                <p class="font-display font-bold text-content-2">{{ $label }}</p>
                <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4">Screenshot coming soon</p>
            </div>
        @endif
        <span class="absolute left-3 top-3 rounded-pill bg-[color:var(--osl-surface-glass)] backdrop-blur px-3 py-1 font-mono text-label uppercase tracking-[0.06em] text-content-3 border border-[color:var(--osl-border-glow)]">
            {{ $label }}
        </span>
    </div>
    @if ($caption)
        <figcaption class="mt-2 text-small text-content-3">{{ $caption }}</figcaption>
    @endif
</figure>
