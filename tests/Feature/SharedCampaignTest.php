<?php

use App\Models\Campaign;
use App\Models\User;

it('lets an owner enable sharing and serves the public page without auth', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create([
        'completed' => true, 'current_stage' => 'space', 'species_name' => 'Tidewalkers',
    ]);
    $campaign->traits()->create(['trait_id' => 'movement:cilia', 'inherited' => true, 'acquired_stage' => 'cell']);

    $this->actingAs($user)->post(route('campaigns.share', $campaign))->assertRedirect();

    $campaign->refresh();
    expect($campaign->share_token)->not->toBeNull();

    // Public: no auth needed, reachable only by the token, and marked noindex.
    $this->get(route('shared.show', $campaign->share_token))
        ->assertOk()
        ->assertSee('Tidewalkers')
        ->assertSee('noindex', false);
});

it('forbids a non-owner from sharing a lineage', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $campaign = Campaign::factory()->for($owner)->create();

    $this->actingAs($intruder)->post(route('campaigns.share', $campaign))->assertForbidden();
});

it('revokes the public link when sharing is turned off', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['share_token' => 'tok_abc123def456']);

    $this->actingAs($user)->delete(route('campaigns.unshare', $campaign))->assertRedirect();
    expect($campaign->fresh()->share_token)->toBeNull();

    // The old link no longer resolves.
    $this->get('/s/tok_abc123def456')->assertNotFound();
});

it('404s an unknown share token', function () {
    $this->get('/s/does-not-exist')->assertNotFound();
});
