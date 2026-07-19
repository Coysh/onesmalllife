<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>{{ config('app.name', 'One Small Life') }}</title>

        {{-- Fonts are self-hosted via @fontsource and bundled by Vite (see resources/css/app.css). --}}
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="min-h-screen antialiased">
        {{-- The tank: a warm radial glow over the dark teal-black foundation. --}}
        <div class="relative min-h-screen flex flex-col items-center justify-center px-4 py-8 overflow-hidden"
             style="background:
                 radial-gradient(120% 80% at 50% -10%, rgba(79,212,196,.10), transparent 60%),
                 radial-gradient(90% 60% at 50% 110%, rgba(245,185,85,.06), transparent 55%),
                 var(--osl-bg);">

            <a href="/" class="flex flex-col items-center gap-4 mb-6" aria-label="{{ __('Return to the title screen') }}">
                <x-ui.brand-mark class="w-16 h-16" />
                <x-ui.wordmark size="h2" />
            </a>

            <x-ui.panel class="w-full sm:max-w-md p-6 sm:p-7">
                {{ $slot }}
            </x-ui.panel>
        </div>
    </body>
</html>
