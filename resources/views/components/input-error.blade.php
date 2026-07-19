@props(['messages'])

{{-- Coral error chip: colour + "!" glyph + message, never colour alone. --}}
@if ($messages)
    <ul {{ $attributes->merge(['class' => 'text-small text-[color:var(--osl-accent)] space-y-1']) }} role="alert">
        @foreach ((array) $messages as $message)
            <li class="flex items-start gap-2">
                <span aria-hidden="true" class="mt-px inline-flex h-4 w-4 flex-none items-center justify-center rounded-xs bg-[color:var(--osl-accent)] text-[10px] font-bold text-[color:var(--osl-brand-ink)]">!</span>
                <span>{{ $message }}</span>
            </li>
        @endforeach
    </ul>
@endif
