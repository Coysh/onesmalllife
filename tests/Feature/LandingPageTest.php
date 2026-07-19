<?php

use App\Models\User;

it('shows the title screen with the wordmark and tagline to guests', function () {
    $response = $this->get('/');

    $response->assertOk();
    $response->assertSee('Small', false); // wordmark: One <span>Small</span> Life
    $response->assertSee('An entire universe of possibilities.'); // meta description
    $response->assertSee('Create a free account'); // primary CTA
    $response->assertSee('One life, six worlds'); // the journey section
    $response->assertSee('Log in');
});

it('does not use the forbidden short-form brand names in player-facing copy', function () {
    $html = $this->get('/')->getContent();

    expect($html)->not->toContain('OneSmallLife');
    expect($html)->not->toContain('ONE SMALL LIFE');
    // "OSL" must not appear as a standalone player-facing token.
    expect($html)->not->toMatch('/\bOSL\b/');
});

it('offers returning players a way to continue once authenticated', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get('/');

    $response->assertOk();
    $response->assertSee('Continue');
    $response->assertDontSee('Begin your journey');
});
