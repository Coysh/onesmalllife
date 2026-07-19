<?php

use App\Domain\Campaigns\CampaignState;
use App\Domain\Saves\SaveMigrator;
use App\Models\Campaign;
use App\Models\User;

it('upgrades a pre-versioned save to the current schema and fills core keys', function () {
    $migrated = SaveMigrator::migrate(['species' => ['name' => 'Old']]);

    expect($migrated['saveSchemaVersion'])->toBe(CampaignState::SCHEMA_VERSION);
    expect($migrated['traits'])->toHaveKeys(['active', 'inherited']);
    expect($migrated['progress']['currentStage'])->toBe('cell');
    expect($migrated['species']['name'])->toBe('Old'); // existing data preserved
});

it('leaves a current-version save unchanged', function () {
    $current = CampaignState::initial('seed', 'Tidewalkers');
    expect(SaveMigrator::migrate($current)['saveSchemaVersion'])->toBe(CampaignState::SCHEMA_VERSION);
});

it('accumulates play time from session deltas', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'cell', 'play_time_seconds' => 100]);

    $payload = [
        'session_seconds' => 45,
        'state' => [
            'saveSchemaVersion' => 1,
            'progress' => ['currentStage' => 'cell', 'completed' => false, 'endingId' => null],
            'species' => ['name' => 'Tidewalkers'],
            'traits' => ['active' => [], 'inherited' => []],
            'resources' => ['energy' => 50],
            'history' => [],
        ],
    ];

    $this->actingAs($user)->postJson(route('play.save', $campaign), $payload)->assertOk();
    expect($campaign->fresh()->play_time_seconds)->toBe(145);
});
