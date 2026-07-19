<?php

use App\Models\Campaign;
use App\Models\User;

function validSavePayload(array $overrides = []): array
{
    $state = array_replace_recursive([
        'saveSchemaVersion' => 1,
        'progress' => ['currentStage' => 'cell', 'completed' => false, 'endingId' => null],
        'species' => ['name' => 'Tidewalkers'],
        'traits' => ['active' => [], 'inherited' => []],
        'resources' => ['energy' => 50, 'integrity' => 90, 'evolution' => 3, 'absorbed' => 4],
        'history' => [],
    ], $overrides['state'] ?? []);

    return ['state' => $state];
}

it('saves a valid payload and updates campaign metadata', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'cell']);

    $response = $this->actingAs($user)
        ->postJson(route('play.save', $campaign), validSavePayload());

    $response->assertOk()->assertJson(['saved' => true]);

    $campaign->refresh();
    expect($campaign->autosave()->state['resources']['energy'])->toBe(50);
    expect($campaign->current_stage)->toBe('cell');
});

it('projects active traits into the campaign_traits table', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create();

    $this->actingAs($user)->postJson(
        route('play.save', $campaign),
        validSavePayload(['state' => ['traits' => ['active' => ['biology:membrane_ii', 'cognition:curious']]]]),
    )->assertOk();

    expect($campaign->traits()->pluck('trait_id')->sort()->values()->all())
        ->toBe(['biology:membrane_ii', 'cognition:curious']);
});

it('allows advancing to the very next stage', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'cell']);

    $this->actingAs($user)->postJson(
        route('play.save', $campaign),
        validSavePayload(['state' => ['progress' => ['currentStage' => 'creature']]]),
    )->assertOk();

    expect($campaign->fresh()->current_stage)->toBe('creature');
});

it('rejects an illegal stage skip', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'cell']);

    $this->actingAs($user)->postJson(
        route('play.save', $campaign),
        validSavePayload(['state' => ['progress' => ['currentStage' => 'tribe']]]),
    )->assertStatus(422);

    expect($campaign->fresh()->current_stage)->toBe('cell');
});

it('rejects an unknown save schema version', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create();

    $this->actingAs($user)->postJson(
        route('play.save', $campaign),
        validSavePayload(['state' => ['saveSchemaVersion' => 999]]),
    )->assertStatus(422);
});

it('rejects out-of-range resource values', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create();

    $this->actingAs($user)->postJson(
        route('play.save', $campaign),
        validSavePayload(['state' => ['resources' => ['energy' => 9_999_999]]]),
    )->assertStatus(422);
});

it('forbids saving to someone else\'s campaign', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $campaign = Campaign::factory()->for($owner)->create();

    $this->actingAs($intruder)
        ->postJson(route('play.save', $campaign), validSavePayload())
        ->assertForbidden();
});
