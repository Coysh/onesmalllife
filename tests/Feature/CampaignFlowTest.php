<?php

use App\Models\Campaign;
use App\Models\User;

it('shows the new-campaign setup screen', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->get(route('campaigns.create'))
        ->assertOk()
        ->assertSee('Shape your first cell')
        ->assertSee('name="palette"', false);
});

it('stores the builder appearance (v2 parts) and reflects it in the portrait', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/campaigns', [
        'name' => 'Painted', 'palette' => 4, 'body' => 'elongated', 'membrane' => 'double',
        'feeding' => 'gullet', 'movement' => 'jet', 'sensory' => 'antenna', 'defense' => 'spines', 'pattern' => 'stripe',
    ]);

    $campaign = App\Models\Campaign::where('user_id', $user->id)->firstOrFail();
    expect($campaign->appearance['version'])->toBe(2);
    expect($campaign->appearance['body'])->toBe('elongated');
    expect($campaign->appearance['defense'])->toBe('spines');

    $spec = App\Domain\Species\PortraitComposer::spec($campaign->seed, [], $campaign->appearance);
    expect($spec['albedo'])->toBe('#e08cc0'); // palette 4 albedo
    expect($spec['rx'])->toBe(40); // elongated body proportions
    expect($spec['membrane'])->toBe('double');
    expect($spec['defense'])->toBeTrue();
});

it('rejects part ids that are not in the catalogue', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/campaigns', ['body' => 'not-a-body'])
        ->assertSessionHasErrors('body');
    expect(App\Models\Campaign::where('user_id', $user->id)->exists())->toBeFalse();
});

it('normalises a legacy v1 appearance through the portrait pipeline', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create([
        'appearance' => ['palette' => 4, 'body' => 2, 'pattern' => true],
    ]);

    $spec = App\Domain\Species\PortraitComposer::spec($campaign->seed, [], $campaign->appearance);
    expect($spec['albedo'])->toBe('#e08cc0'); // palette carried over
    expect($spec['appearance']['version'])->toBe(2);
    expect($spec['appearance']['movement'])->toBe('cilia'); // legacy defaults fill new slots
    expect($spec['pattern'])->toBeTrue();
});

it('saves the current progress to a manual slot', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'cell']);
    $campaign->saves()->create([
        'slot' => 0, 'stage' => 'cell', 'save_schema_version' => 1,
        'state' => ['saveSchemaVersion' => 1, 'resources' => ['energy' => 60]],
    ]);

    $this->actingAs($user)->post(route('play.slot.save', [$campaign, 2]))
        ->assertRedirect(route('play', $campaign));

    $slot = $campaign->saves()->where('slot', 2)->firstOrFail();
    expect($slot->state['resources']['energy'])->toBe(60);
    expect($slot->label)->not->toBeEmpty();
});

it('restores a manual slot into the autosave', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'creature']);
    $campaign->saves()->create(['slot' => 0, 'stage' => 'creature', 'save_schema_version' => 1, 'state' => ['saveSchemaVersion' => 1, 'tag' => 'auto']]);
    $campaign->saves()->create(['slot' => 1, 'stage' => 'cell', 'save_schema_version' => 1, 'state' => ['saveSchemaVersion' => 1, 'tag' => 'slot1']]);

    $this->actingAs($user)->post(route('play.slot.restore', [$campaign, 1]))
        ->assertRedirect(route('play', $campaign));

    expect($campaign->fresh()->current_stage)->toBe('cell');
    expect($campaign->autosave()->state['tag'])->toBe('slot1');
});

it('forbids saving a slot on another player\'s campaign', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $campaign = Campaign::factory()->for($owner)->create();
    $campaign->saves()->create(['slot' => 0, 'stage' => 'cell', 'save_schema_version' => 1, 'state' => ['saveSchemaVersion' => 1]]);

    $this->actingAs($intruder)->post(route('play.slot.save', [$campaign, 1]))->assertForbidden();
});

it('lets a completed lineage keep playing (extended play)', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'space', 'completed' => true]);

    $this->actingAs($user)->get(route('play', $campaign))->assertOk();
});
