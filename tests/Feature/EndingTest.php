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

/** Give a campaign a chronicle of how its later stages finished. */
function chronicled(App\Models\User $user, array $chronicle): Campaign
{
    $campaign = Campaign::factory()->for($user)->create();
    $campaign->saves()->create([
        'slot' => 0,
        'stage' => 'space',
        'save_schema_version' => 1,
        'state' => ['saveSchemaVersion' => 1, 'chronicle' => $chronicle],
    ]);

    return $campaign->fresh();
}

it('lets the later stages decide the ending, not just early traits', function () {
    $user = User::factory()->create();

    // Two lineages with identical (empty) trait histories that played the back
    // half of the game in opposite ways must not land on the same ending.
    $steward = chronicled($user, [
        'planetary' => ['ecology' => 80, 'industry' => 40, 'unity' => 210],
    ]);
    $conqueror = chronicled($user, [
        'planetary' => ['ecology' => 5, 'industry' => 160, 'unity' => 100],
        'civilisation' => ['gold' => 200, 'tech' => 90],
    ]);

    expect(EndingResolver::resolve($steward)['id'])->toBe('stewardship');
    expect(EndingResolver::resolve($conqueror)['id'])->toBe('empire');
});

it('explains on the epilogue why the ending was reached', function () {
    $user = User::factory()->create();
    $campaign = chronicled($user, [
        'planetary' => ['ecology' => 80, 'industry' => 30, 'unity' => 230],
    ]);
    $campaign->update(['completed' => true]);

    $response = $this->actingAs($user)->get(route('campaigns.ending', $campaign));

    $response->assertOk();
    $response->assertSee('Why it ended this way');
    $response->assertSee('You left your homeworld greener than you found it.');
    $response->assertSee('The whole planet spoke with one voice before you left it.');
});

it('no longer defaults every quiet lineage to federation', function () {
    $user = User::factory()->create();

    // A lineage that reached the stars having built and shared little.
    $recluse = chronicled($user, [
        'space' => ['research' => 20, 'alloy' => 30, 'legacy' => 200],
    ]);

    expect(EndingResolver::resolve($recluse)['id'])->toBe('isolation');
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
