<x-guest-layout>
    <div class="mb-6">
        <h1 class="text-h2 font-display font-bold text-content mb-2">{{ __('Verify your email') }}</h1>
        <p class="text-small text-content-3">
            {{ __('Thanks for signing up! Please verify your email address by clicking the link we just sent you. If it did not arrive, we will gladly send another.') }}
        </p>
    </div>

    @if (session('status') == 'verification-link-sent')
        <div class="mb-4 flex items-center gap-2 text-small text-[color:var(--osl-success)]" role="status">
            <span aria-hidden="true" class="inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[color:var(--osl-success)] text-[10px] font-bold text-[color:var(--osl-brand-ink)]">✓</span>
            <span>{{ __('A new verification link has been sent to your email address.') }}</span>
        </div>
    @endif

    <div class="mt-4 flex items-center justify-between">
        <form method="POST" action="{{ route('verification.send') }}">
            @csrf

            <div>
                <x-primary-button>
                    {{ __('Resend Verification Email') }}
                </x-primary-button>
            </div>
        </form>

        <form method="POST" action="{{ route('logout') }}">
            @csrf

            <button type="submit" class="text-small text-content-3 hover:text-content rounded-xs focus-visible:outline-none">
                {{ __('Log out') }}
            </button>
        </form>
    </div>
</x-guest-layout>
