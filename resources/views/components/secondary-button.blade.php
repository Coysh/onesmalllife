{{-- Tidepool secondary button: outline on dark surface. --}}
<button {{ $attributes->merge(['type' => 'button', 'class' =>
    'inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-md '
    . 'bg-transparent text-content border border-ink-border font-semibold text-small '
    . 'hover:border-brand active:bg-ink-surface2 '
    . 'focus-visible:outline-none disabled:opacity-disabled disabled:pointer-events-none '
    . 'transition duration-fast ease-osl']) }}>
    {{ $slot }}
</button>
