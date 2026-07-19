<?php

use App\Domain\Species\PortraitComposer;
use App\Models\Campaign;
use App\Models\User;

it('composes a deterministic portrait spec from the seed', function () {
    $a = PortraitComposer::spec('fixed-seed');
    $b = PortraitComposer::spec('fixed-seed');

    expect($a)->toBe($b);
    expect($a['albedo'])->toStartWith('#');
    expect($a['rx'])->toBeGreaterThan(0);
});

it('reflects trait visual attachments in the portrait spec', function () {
    $plain = PortraitComposer::spec('seed-x', []);
    $evolved = PortraitComposer::spec('seed-x', ['biology:membrane_ii', 'movement:flagellum', 'feeding:filter']);

    // Appearance v2: every organism has a feeding part; traits still augment
    // the slots the player left at their defaults.
    expect($plain['feeding'])->toBeTrue();
    expect($plain['membrane'])->toBe('smooth');
    expect($evolved['membrane'])->toBe('double');
    expect($evolved['movement'])->toBe('flagellum');
});

it('renders the composed portrait on the ending screen', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['completed' => true]);
    $campaign->traits()->create(['trait_id' => 'movement:cilia', 'inherited' => true, 'acquired_stage' => 'cell']);

    $this->actingAs($user)->get(route('campaigns.ending', $campaign))
        ->assertOk()
        ->assertSee('aria-label="Species portrait"', false);
});
