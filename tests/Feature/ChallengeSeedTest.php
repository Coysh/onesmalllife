<?php

use App\Models\Campaign;
use App\Models\ChallengeSeed;
use App\Models\User;

it('generates a daily and weekly challenge seed idempotently', function () {
    $this->artisan('challenges:generate')->assertSuccessful();

    expect(ChallengeSeed::where('period_type', 'daily')->count())->toBe(1);
    expect(ChallengeSeed::where('period_type', 'weekly')->count())->toBe(1);

    $dailySeed = ChallengeSeed::where('period_type', 'daily')->first()->seed;

    // Running it again must not mint a second seed for the same period.
    $this->artisan('challenges:generate')->assertSuccessful();

    expect(ChallengeSeed::where('period_type', 'daily')->count())->toBe(1);
    expect(ChallengeSeed::where('period_type', 'daily')->first()->seed)->toBe($dailySeed);
});

it('starts a new campaign from a challenge seed instead of a random one', function () {
    $user = User::factory()->create();
    $challenge = ChallengeSeed::factory()->create(['seed' => 'fixed-challenge-seed']);

    $this->actingAs($user)->post(route('campaigns.store'), [
        'challenge_seed_id' => $challenge->id,
    ])->assertRedirect();

    $campaign = Campaign::where('user_id', $user->id)->firstOrFail();

    expect($campaign->seed)->toBe('fixed-challenge-seed');
    expect($campaign->challenge_seed_id)->toBe($challenge->id);
});

it('lets two different players start the same challenge with an identical seed', function () {
    $a = User::factory()->create();
    $b = User::factory()->create();
    $challenge = ChallengeSeed::factory()->create();

    $this->actingAs($a)->post(route('campaigns.store'), ['challenge_seed_id' => $challenge->id]);
    $this->actingAs($b)->post(route('campaigns.store'), ['challenge_seed_id' => $challenge->id]);

    $seeds = Campaign::whereIn('user_id', [$a->id, $b->id])->pluck('seed')->unique();
    expect($seeds)->toHaveCount(1);
});

it('shows the challenge leaderboard, ranked by fastest completion', function () {
    $user = User::factory()->create();
    $challenge = ChallengeSeed::factory()->create();

    $slow = Campaign::factory()->for($user)->create([
        'completed' => true, 'current_stage' => 'space', 'play_time_seconds' => 900,
        'challenge_seed_id' => $challenge->id, 'share_token' => 'tok-slow', 'gallery_public' => true,
    ]);
    $fast = Campaign::factory()->for($user)->create([
        'completed' => true, 'current_stage' => 'space', 'play_time_seconds' => 300,
        'challenge_seed_id' => $challenge->id, 'share_token' => 'tok-fast', 'gallery_public' => true,
    ]);
    // Not opted into the gallery — must not appear.
    Campaign::factory()->for($user)->create([
        'completed' => true, 'current_stage' => 'space', 'play_time_seconds' => 100,
        'challenge_seed_id' => $challenge->id, 'gallery_public' => false,
    ]);

    $response = $this->actingAs($user)->get(route('challenges.show', $challenge))->assertOk();

    $response->assertSeeInOrder([$fast->species_name, $slow->species_name]);
});
