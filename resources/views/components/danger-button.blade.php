{{-- Tidepool danger button: coral fill for destructive confirmations. --}}
<button {{ $attributes->merge(['type' => 'submit', 'class' =>
    'inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-md '
    . 'bg-accent text-[color:var(--osl-brand-ink)] font-semibold text-small '
    . 'hover:bg-[color:var(--osl-accent-deep)] '
    . 'focus-visible:outline-none disabled:opacity-disabled disabled:pointer-events-none '
    . 'transition duration-fast ease-osl']) }}>
    {{ $slot }}
</button>
