{{--
    One Small Life — brand mark.
    A luminous nucleus inside expanding evolutionary rings with two satellite
    dots (amber + coral). Expresses growth / increasing scale resolving to a
    distant star. See handoff: Brand Foundation. Colour comes from tokens.
    Size is controlled by the caller via a Tailwind class (e.g. class="w-16 h-16").
--}}
<svg {{ $attributes->merge(['class' => 'w-16 h-16', 'role' => 'img', 'aria-label' => 'One Small Life']) }}
     viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {{-- faint outer evolutionary ring --}}
    <circle cx="32" cy="32" r="26" stroke="#2b9c8b" stroke-width="1.5" opacity="0.5" />
    {{-- mid ring --}}
    <circle cx="32" cy="32" r="18" stroke="#4fd4c4" stroke-width="2" opacity="0.9" />
    {{-- filled core --}}
    <circle cx="32" cy="32" r="10.5" fill="#0e6b60" />
    {{-- glowing nucleus --}}
    <circle cx="32" cy="32" r="4.5" fill="#8fe9d6" />
    {{-- satellite dots --}}
    <circle cx="52" cy="15" r="3" fill="#f5b955" />
    <circle cx="13" cy="49" r="2.5" fill="#f2795f" />
</svg>
