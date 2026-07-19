{{-- Tidepool primary button: brand fill, ink text, 44px touch target. --}}
<button {{ $attributes->merge(['type' => 'submit', 'class' =>
    'inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-md '
    . 'bg-brand text-[color:var(--osl-text-on-brand)] font-semibold text-small '
    . 'hover:bg-brand-hi active:bg-brand-deep shadow-e1 '
    . 'focus-visible:outline-none disabled:opacity-disabled disabled:pointer-events-none '
    . 'transition duration-fast ease-osl']) }}>
    {{ $slot }}
</button>
