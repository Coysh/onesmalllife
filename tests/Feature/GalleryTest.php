<?php

use App\Models\Campaign;
use App\Models\User;

it('only lists completed campaigns whose owner opted into the gallery', function () {
    $user = User::factory()->create();

    $listed = Campaign::factory()->for($user)->create([
        'completed' => true, 'current_stage' => 'space', 'share_token' => 'tok-listed', 'gallery_public' => true,
    ]);
    // Shared but not gallery-opted-in.
    Campaign::factory()->for($user)->create([
        'completed' => true, 'current_stage' => 'space', 'share_token' => 'tok-hidden', 'gallery_public' => false,
    ]);
    // Gallery flag set but not completed — must not appear either.
    Campaign::factory()->for($user)->create([
        'completed' => false, 'current_stage' => 'creature', 'share_token' => 'tok-wip', 'gallery_public' => true,
    ]);

    $this->get(route('gallery.index'))
        ->assertOk()
        ->assertSee($listed->species_name);
});

it('requires the campaign to be completed before it can join the gallery', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['completed' => false, 'current_stage' => 'creature']);

    $this->actingAs($user)->post(route('campaigns.gallery.enter', $campaign))->assertStatus(422);
    expect($campaign->fresh()->gallery_public)->toBeFalse();
});

it('lets an owner join and leave the gallery, minting a share token if needed', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['completed' => true, 'current_stage' => 'space']);

    $this->actingAs($user)->post(route('campaigns.gallery.enter', $campaign))->assertRedirect();
    $campaign->refresh();
    expect($campaign->gallery_public)->toBeTrue();
    expect($campaign->share_token)->not->toBeNull();

    $this->actingAs($user)->delete(route('campaigns.gallery.leave', $campaign))->assertRedirect();
    expect($campaign->fresh()->gallery_public)->toBeFalse();
    // Leaving the gallery does not revoke the share link itself.
    expect($campaign->fresh()->share_token)->not->toBeNull();
});

it('forbids a non-owner from listing someone else\'s lineage', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $campaign = Campaign::factory()->for($owner)->create(['completed' => true, 'current_stage' => 'space']);

    $this->actingAs($intruder)->post(route('campaigns.gallery.enter', $campaign))->assertForbidden();
});

it('clears the gallery flag when sharing is turned off', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create([
        'completed' => true, 'current_stage' => 'space', 'share_token' => 'tok-both', 'gallery_public' => true,
    ]);

    $this->actingAs($user)->delete(route('campaigns.unshare', $campaign))->assertRedirect();
    expect($campaign->fresh()->gallery_public)->toBeFalse();
});
