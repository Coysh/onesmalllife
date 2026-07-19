<?php

use App\Models\Campaign;
use App\Models\User;

it('requires authentication to start or play', function () {
    $this->post('/campaigns')->assertRedirect('/login');

    $campaign = Campaign::factory()->create();
    $this->get(route('play', $campaign))->assertRedirect('/login');
});

it('creates a campaign with an initial autosave and redirects into play', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/campaigns');

    $campaign = Campaign::where('user_id', $user->id)->firstOrFail();
    $response->assertRedirect(route('play', $campaign));

    expect($campaign->seed)->not->toBeEmpty();
    expect($campaign->species_name)->not->toBeEmpty();
    expect($campaign->current_stage)->toBe('cell');
    expect($campaign->autosave())->not->toBeNull();
    expect($campaign->autosave()->state['saveSchemaVersion'])->toBe(1);
});

it('renders the Cell stage with the HUD, canvas mount and save url for the owner', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create();

    $response = $this->actingAs($user)->get(route('play', $campaign));

    $response->assertOk();
    $response->assertSee('id="game-canvas"', false);
    $response->assertSee('id="game-hud"', false);
    $response->assertSee('data-hud="energy-value"', false);
    $response->assertSee('data-save-url="'.route('play.save', $campaign).'"', false);
    $response->assertSee('id="campaign-state"', false);
});

it('forbids playing or deleting someone else\'s campaign', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $campaign = Campaign::factory()->for($owner)->create();

    $this->actingAs($intruder)->get(route('play', $campaign))->assertForbidden();
    $this->actingAs($intruder)->delete(route('campaigns.destroy', $campaign))->assertForbidden();
});

it('lists a player\'s lineages on the dashboard', function () {
    $user = User::factory()->create();
    $mine = Campaign::factory()->for($user)->create(['name' => 'Tidewalkers']);
    $theirs = Campaign::factory()->create(['name' => 'Someone Else']);

    $response = $this->actingAs($user)->get('/dashboard');

    $response->assertOk();
    $response->assertSee('Tidewalkers');
    $response->assertDontSee('Someone Else');
    $response->assertSee(route('play', $mine), false);
});

it('deletes a campaign and cascades its saves', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create();
    $campaign->saves()->create([
        'slot' => 0,
        'stage' => 'cell',
        'save_schema_version' => 1,
        'state' => ['saveSchemaVersion' => 1],
    ]);

    $this->actingAs($user)->delete(route('campaigns.destroy', $campaign))->assertRedirect(route('dashboard'));

    expect(Campaign::find($campaign->id))->toBeNull();
    $this->assertDatabaseCount('campaign_saves', 0);
});
