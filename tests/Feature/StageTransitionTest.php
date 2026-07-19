<?php

use App\Models\Campaign;
use App\Models\User;

it('advances a completed Cell campaign into the Creature stage, carrying traits forward', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'cell']);
    $campaign->saves()->create([
        'slot' => 0,
        'stage' => 'cell',
        'save_schema_version' => 1,
        'state' => [
            'saveSchemaVersion' => 1,
            'progress' => ['currentStage' => 'cell', 'completed' => true, 'endingId' => null],
            'species' => ['name' => 'Tidewalkers'],
            'traits' => ['active' => ['movement:cilia', 'feeding:filter'], 'inherited' => []],
            'resources' => ['energy' => 40, 'integrity' => 80, 'evolution' => 5, 'absorbed' => 14],
            'history' => [],
        ],
    ]);

    $response = $this->actingAs($user)->post(route('play.advance', $campaign));
    $response->assertRedirect(route('play', $campaign));

    $campaign->refresh();
    expect($campaign->current_stage)->toBe('creature');

    $state = $campaign->autosave()->state;
    expect($state['progress']['currentStage'])->toBe('creature');
    expect($state['traits']['inherited'])->toContain('movement:cilia');
    expect($state['traits']['inherited'])->toContain('feeding:filter');

    // Inherited traits are recorded in the projection table.
    expect($campaign->traits()->where('inherited', true)->count())->toBe(2);
});

it('marks the campaign complete and shows the ending when advancing past the final stage', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'space']);

    $this->actingAs($user)->post(route('play.advance', $campaign))->assertRedirect(route('campaigns.ending', $campaign));

    expect($campaign->fresh()->completed)->toBeTrue();
});

it('forbids advancing someone else\'s campaign', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $campaign = Campaign::factory()->for($owner)->create();

    $this->actingAs($intruder)->post(route('play.advance', $campaign))->assertForbidden();
});
