@props([
    'setting',
    'label',
    'hint' => null,
])
{{-- Tidepool toggle switch bound to a client setting (data-setting). --}}
<label class="flex items-start justify-between gap-4 cursor-pointer">
    <span class="min-w-0">
        <span class="font-semibold text-content">{{ $label }}</span>
        @if ($hint)
            <span class="block text-small text-content-3">{{ $hint }}</span>
        @endif
    </span>
    <span class="relative inline-flex flex-none items-center">
        <input type="checkbox" data-setting="{{ $setting }}" class="peer sr-only">
        <span class="block w-11 h-6 rounded-pill bg-ink-border peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--osl-focus-ring)] transition duration-fast"></span>
        <span class="absolute left-0.5 h-5 w-5 rounded-full bg-[color:var(--osl-text-on-brand)] transition duration-fast peer-checked:translate-x-5"></span>
    </span>
</label>
