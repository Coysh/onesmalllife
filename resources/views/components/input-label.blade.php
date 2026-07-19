@props(['value'])

{{-- Tidepool field label: Space Mono, uppercase, mint. See handoff: Sample Screens 2. --}}
<label {{ $attributes->merge(['class' => 'block font-mono text-label uppercase tracking-[0.06em] text-brand-hi mb-2']) }}>
    {{ $value ?? $slot }}
</label>
