@props(['status'])

{{-- Success/status notice: mint, with check glyph. --}}
@if ($status)
    <div {{ $attributes->merge(['class' => 'flex items-center gap-2 text-small text-[color:var(--osl-success)]']) }} role="status">
        <span aria-hidden="true" class="inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[color:var(--osl-success)] text-[10px] font-bold text-[color:var(--osl-brand-ink)]">✓</span>
        <span>{{ $status }}</span>
    </div>
@endif
