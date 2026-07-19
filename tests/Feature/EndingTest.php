<?php

use App\Domain\Campaigns\EndingResolver;
use App\Models\Campaign;
use App\Models\User;

it('renders the ending screen with a resolved ending family for the owner', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['completed' => true, 'species_name' => 'Tidewalkers']);
    $campaign->traits()->create(['trait_id' => 'movement:cilia', 'inherited' => true, 'acquired_stage' => 'cell']);

    $response = $this->actingAs($user)->get(route('campaigns.ending', $campaign));

    $response->assertOk();
    $response->assertSee('Tidewalkers');
    $response->assertSee('It began with one small life.');
});

it('resolves deterministically to a valid ending family', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create();
    $campaign->traits()->create(['trait_id' => 'cognition:curious', 'inherited' => true, 'acquired_stage' => 'cell']);

    $a = EndingResolver::resolve($campaign->fresh());
    $b = EndingResolver::resolve($campaign->fresh());

    expect($a['id'])->toBe($b['id']);
    expect($a['name'])->not->toBeEmpty();
    // Curious lineages lean toward transcendence.
    expect($a['id'])->toBe('transcendence');
});

it('shows the species history timeline', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['species_name' => 'Tidewalkers']);
    $campaign->saves()->create([
        'slot' => 0,
        'stage' => 'creature',
        'save_schema_version' => 1,
        'state' => [
            'saveSchemaVersion' => 1,
            'history' => [
                ['t' => 10, 'category' => 'evolution', 'title' => 'Creature begins', 'description' => 'Crossed into the Creature stage.'],
            ],
        ],
    ]);

    $response = $this->actingAs($user)->get(route('campaigns.history', $campaign));

    $response->assertOk();
    $response->assertSee('First light');
    $response->assertSee('Creature begins');
});

it('forbids viewing another player\'s ending or history', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $campaign = Campaign::factory()->for($owner)->create();

    $this->actingAs($intruder)->get(route('campaigns.ending', $campaign))->assertForbidden();
    $this->actingAs($intruder)->get(route('campaigns.history', $campaign))->assertForbidden();
});
