<?php

use App\Domain\Campaigns\CampaignState;
use App\Domain\Species\PortraitComposer;
use App\Models\Campaign;
use App\Models\User;

/**
 * End-to-end progression: a lineage advanced through every stage in sequence.
 * Guards the whole arc — the transition order, that traits accumulate as
 * inherited across all six stages, that appearance persists, and that the
 * final advance reaches the ending.
 */
it('advances a lineage through all six stages into the ending, carrying state', function () {
    $user = User::factory()->create();
    $campaign = Campaign::factory()->for($user)->create([
        'current_stage' => 'cell',
        'appearance' => ['version' => 2, 'palette' => 4, 'body' => 'elongated', 'membrane' => 'double', 'feeding' => 'gullet', 'movement' => 'jet', 'sensory' => 'antenna', 'defense' => 'spines', 'pattern' => 'stripe'],
    ]);
    $campaign->saves()->create([
        'slot' => 0,
        'stage' => 'cell',
        'save_schema_version' => CampaignState::SCHEMA_VERSION,
        'state' => array_replace(CampaignState::initial($campaign->seed, 'Tidewalkers'), [
            'traits' => ['active' => ['movement:cilia'], 'inherited' => []],
        ]),
    ]);

    $stages = ['cell', 'creature', 'tribe', 'civilisation', 'planetary', 'space'];
    foreach ($stages as $i => $stage) {
        // Each stage banks a distinct active trait, then advances.
        $save = $campaign->autosave();
        $state = $save->state;
        $state['traits']['active'] = array_values(array_unique([...($state['traits']['active'] ?? []), "test:trait_{$i}"]));
        $save->update(['state' => $state]);

        $this->actingAs($user)->post(route('play.advance', $campaign));
        $campaign->refresh();

        if ($stage !== 'space') {
            expect($campaign->current_stage)->toBe($stages[$i + 1]);
            // Everything active is now carried forward as inherited.
            $inherited = $campaign->autosave()->state['traits']['inherited'];
            expect($inherited)->toContain("test:trait_{$i}");
            // Per-stage resources start fresh.
            expect($campaign->autosave()->state['resources'])->toBe([]);
        }
    }

    // Past the final stage → completed, ending route.
    expect($campaign->fresh()->completed)->toBeTrue();

    // Every stage's trait accumulated across the whole run.
    $finalInherited = $campaign->autosave()->state['traits']['inherited'];
    foreach ([0, 1, 2, 3, 4] as $i) {
        expect($finalInherited)->toContain("test:trait_{$i}");
    }

    // Appearance survived every transition and still drives the portrait.
    $spec = PortraitComposer::spec($campaign->seed, [], $campaign->appearance);
    expect($spec['albedo'])->toBe('#e08cc0'); // palette 4
    expect($spec['appearance']['body'])->toBe('elongated');

    // The ending screen renders for the finished lineage.
    $this->actingAs($user)->get(route('campaigns.ending', $campaign))->assertOk();
});
