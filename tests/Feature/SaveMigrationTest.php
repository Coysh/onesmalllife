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

it('upgrades a v1 save to v2 with empty per-stage state, preserving its data', function () {
    $v1 = [
        'saveSchemaVersion' => 1,
        'species' => ['name' => 'Tidewalkers'],
        'resources' => ['legacy' => 40],
        'traits' => ['active' => ['creature:jaws'], 'inherited' => []],
    ];

    $migrated = SaveMigrator::migrate($v1);

    expect($migrated['saveSchemaVersion'])->toBe(2);
    expect($migrated)->toHaveKeys(['stageState', 'chronicle']);
    // Nothing that already existed is disturbed.
    expect($migrated['resources']['legacy'])->toBe(40);
    expect($migrated['traits']['active'])->toBe(['creature:jaws']);
});

it('derives a default creature build from a legacy creature diet', function () {
    $migrated = SaveMigrator::migrate([
        'saveSchemaVersion' => 1,
        'progress' => ['currentStage' => 'creature'],
        'resources' => ['diet' => 1],
    ]);

    expect($migrated['stageState']['creature']['equipped'])->toBe([
        'locomotion' => 'steady-legs',
        'feeding' => 'hunting-fangs',
        'adaptation' => 'watchful-senses',
    ]);
});

it('accepts a save from the previous schema version so a deploy does not 422', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'cell']);

    $this->actingAs($user)->postJson(route('play.save', $campaign), [
        'state' => [
            'saveSchemaVersion' => 1, // an older bundle still in someone's tab
            'progress' => ['currentStage' => 'cell', 'completed' => false, 'endingId' => null],
            'species' => ['name' => 'Tidewalkers'],
            'traits' => ['active' => [], 'inherited' => []],
            'resources' => ['energy' => 10],
        ],
    ])->assertOk();

    // It is stored at the current version regardless.
    expect($campaign->fresh()->autosave()->save_schema_version)->toBe(CampaignState::SCHEMA_VERSION);
});

it('rejects an unknown or unequipped creature part in a save', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'creature']);
    $state = [
        'saveSchemaVersion' => CampaignState::SCHEMA_VERSION,
        'progress' => ['currentStage' => 'creature', 'completed' => false, 'endingId' => null],
        'species' => ['name' => 'Tidewalkers'],
        'traits' => ['active' => [], 'inherited' => []],
        'resources' => [],
        'stageState' => ['creature' => [
            'version' => 1,
            'equipped' => ['locomotion' => 'invented-legs', 'feeding' => 'grazing-jaws', 'adaptation' => 'watchful-senses'],
            'unlocked' => ['grazing-jaws', 'watchful-senses'],
            'collected' => [],
        ]],
    ];

    $this->actingAs($user)->postJson(route('play.save', $campaign), ['state' => $state])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('state.stageState.creature.equipped.locomotion');
});

it('round-trips a colonised galaxy through a save and back', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create(['current_stage' => 'space']);

    $stageState = [
        'space' => [
            'taken' => ['shipyards', 'scout'],
            'discovered' => [['x' => 0.2, 'y' => 0.6, 'r' => 0.14]],
            'colonies' => [[
                'siteId' => 'nadir', 'name' => 'Nadir Hold', 'worldType' => 'ruin',
                'population' => 3.5, 'capacity' => 7, 'specialisation' => 'research',
                'founded' => 120, 'defense' => 0,
            ]],
            'rivalClaims' => ['cinder'],
            'encountered' => ['nadir', 'aurelia'],
            'rivals' => [[
                'id' => 'native:aurelia', 'name' => 'the Aurelia Chorus', 'archetype' => 'trader',
                'x' => 0.78, 'y' => 0.55, 'present' => true, 'emergesAt' => 0, 'discovered' => true,
                'strength' => 20, 'relationship' => 15, 'defense' => 0, 'progress' => 0,
                'defeated' => false, 'conquerCooldown' => 0,
            ]],
        ],
    ];

    $this->actingAs($user)->postJson(route('play.save', $campaign), [
        'state' => [
            'saveSchemaVersion' => CampaignState::SCHEMA_VERSION,
            'progress' => ['currentStage' => 'space', 'completed' => false, 'endingId' => null],
            'species' => ['name' => 'Tidewalkers'],
            'traits' => ['active' => [], 'inherited' => []],
            'resources' => ['research' => 50, 'alloy' => 20, 'legacy' => 30],
            'stageState' => $stageState,
        ],
    ])->assertOk();

    // The whole galaxy comes back, not just the numbers.
    $stored = $campaign->fresh()->autosave()->state['stageState']['space'];
    expect($stored['colonies'][0]['name'])->toBe('Nadir Hold');
    expect($stored['colonies'][0]['specialisation'])->toBe('research');
    expect($stored['rivals'][0]['id'])->toBe('native:aurelia');
    expect($stored['encountered'])->toBe(['nadir', 'aurelia']);
    expect($stored['rivalClaims'])->toBe(['cinder']);
    expect($stored['taken'])->toBe(['shipyards', 'scout']);
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
