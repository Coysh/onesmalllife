<?php

use App\Domain\Campaigns\Chronicle;
use App\Domain\Campaigns\Stage;
use App\Models\Campaign;
use App\Models\User;

it('aggregates a player\'s lineages into a Chronicle', function () {
    $user = User::factory()->create();

    // A completed lineage that leans transcendence (curious) with two adaptations.
    $done = Campaign::factory()->for($user)->create([
        'completed' => true, 'current_stage' => 'space', 'play_time_seconds' => 600,
    ]);
    $done->traits()->create(['trait_id' => 'cognition:curious', 'inherited' => true, 'acquired_stage' => 'cell']);
    $done->traits()->create(['trait_id' => 'movement:cilia', 'inherited' => true, 'acquired_stage' => 'cell']);

    // An in-progress lineage at the Creature stage sharing one adaptation.
    $wip = Campaign::factory()->for($user)->create([
        'completed' => false, 'current_stage' => 'creature', 'play_time_seconds' => 120,
    ]);
    $wip->traits()->create(['trait_id' => 'movement:cilia', 'inherited' => false, 'acquired_stage' => 'creature']);

    $campaigns = Campaign::where('user_id', $user->id)->with('traits')->get();
    $chronicle = Chronicle::from($campaigns);

    expect($chronicle['lineages'])->toBe(2);
    expect($chronicle['completed'])->toBe(1);
    expect($chronicle['furthestStage'])->toBe(Stage::Space->label());
    expect($chronicle['playSeconds'])->toBe(720);
    expect($chronicle['familiesDiscovered'])->toBe(1);
    expect($chronicle['familiesTotal'])->toBe(5);
    // movement:cilia is shared across both lineages → counted once.
    expect($chronicle['adaptationsCollected'])->toBe(2);

    // curious(+3 transcendence,+1 federation) + cilia(+2 federation) → federation wins.
    $federation = collect($chronicle['families'])->firstWhere('id', 'federation');
    expect($federation['discovered'])->toBeTrue();
    $empire = collect($chronicle['families'])->firstWhere('id', 'empire');
    expect($empire['discovered'])->toBeFalse();
});

it('shows the Chronicle on the dashboard', function () {
    $user = User::factory()->create();
    Campaign::factory()->for($user)->create(['completed' => true, 'current_stage' => 'space']);

    $this->actingAs($user)->get(route('dashboard'))
        ->assertOk()
        ->assertSee('Your Chronicle')
        ->assertSee('Endings discovered');
});
