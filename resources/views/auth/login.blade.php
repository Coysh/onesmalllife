<x-guest-layout>
    <div class="mb-6">
        <p class="font-mono text-label uppercase tracking-[0.06em] text-content-4 mb-1">{{ __('Continue your lineage') }}</p>
        <h1 class="text-h2 font-display font-bold text-content">{{ __('Welcome back') }}</h1>
    </div>

    <!-- Session Status -->
    <x-auth-session-status class="mb-4" :status="session('status')" />

    <form method="POST" action="{{ route('login') }}" class="space-y-4">
        @csrf

        <!-- Email Address -->
        <div>
            <x-input-label for="email" :value="__('Email')" />
            <x-text-input id="email" type="email" name="email" :value="old('email')" required autofocus autocomplete="username" />
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <!-- Password -->
        <div>
            <x-input-label for="password" :value="__('Password')" />
            <x-text-input id="password" type="password" name="password" required autocomplete="current-password" />
            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <!-- Remember Me -->
        <label for="remember_me" class="inline-flex items-center gap-2 cursor-pointer">
            <input id="remember_me" type="checkbox" name="remember"
                   class="rounded-xs border-ink-border bg-ink-2 text-brand focus:ring-[color:var(--osl-focus-ring)]">
            <span class="text-small text-content-3">{{ __('Remember me') }}</span>
        </label>

        <div class="flex items-center justify-between gap-3 pt-2">
            @if (Route::has('password.request'))
                <a class="text-small text-brand hover:text-brand-hi rounded-xs focus-visible:outline-none" href="{{ route('password.request') }}">
                    {{ __('Forgot your password?') }}
                </a>
            @else
                <span></span>
            @endif

            <x-primary-button>{{ __('Log in') }}</x-primary-button>
        </div>

        @if (Route::has('register'))
            <p class="text-small text-content-3 pt-2">
                {{ __('New here?') }}
                <a href="{{ route('register') }}" class="text-brand hover:text-brand-hi">{{ __('Begin your journey') }}</a>
            </p>
        @endif
    </form>
</x-guest-layout>
