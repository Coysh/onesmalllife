@props(['disabled' => false])

{{-- Tidepool text field: recessed dark well, brand focus ring. --}}
<input @disabled($disabled) {{ $attributes->merge(['class' =>
    'block w-full rounded-sm border border-ink-border bg-ink-2 text-content placeholder:text-content-4 '
    . 'text-small px-4 py-3 shadow-none '
    . 'focus:border-brand focus:ring-2 focus:ring-[color:var(--osl-focus-ring)] focus:ring-offset-0 '
    . 'disabled:opacity-disabled transition duration-fast ease-osl',
]) }}>
