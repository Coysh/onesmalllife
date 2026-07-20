<?php

namespace App\Http\Controllers;

use App\Domain\Campaigns\Leaderboard;
use App\Models\Campaign;
use App\Models\ChallengeSeed;

/**
 * Shared-seed challenges: everyone who joins a challenge starts from the same
 * automatically-generated seed (App\Console\Commands\GenerateChallengeSeeds),
 * then plays it entirely solo. Afterward, anyone who opted a run into the
 * gallery (Campaign::gallery_public) shows up on that challenge's leaderboard.
 */
class ChallengeController extends Controller
{
    /** The current daily + weekly challenges, with the player's own attempt (if any). */
    public function index(): \Illuminate\View\View
    {
        $daily = ChallengeSeed::where('period_type', 'daily')
            ->where('period_key', now()->format('Y-m-d'))
            ->first();
        $weekly = ChallengeSeed::where('period_type', 'weekly')
            ->where('period_key', now()->format('o-\WW'))
            ->first();

        $userId = request()->user()->id;
        $mine = fn (?ChallengeSeed $seed) => $seed
            ? Campaign::where('user_id', $userId)->where('challenge_seed_id', $seed->id)->first()
            : null;

        return view('challenges.index', [
            'daily' => $daily,
            'weekly' => $weekly,
            'myDaily' => $mine($daily),
            'myWeekly' => $mine($weekly),
        ]);
    }

    /** A single challenge's leaderboard, ranked by fastest completion. */
    public function show(ChallengeSeed $challengeSeed): \Illuminate\View\View
    {
        $campaigns = $challengeSeed->campaigns()->with('traits')->get();

        return view('challenges.show', [
            'challengeSeed' => $challengeSeed,
            'leaderboard' => Leaderboard::from($campaigns),
            'myCampaign' => Campaign::where('user_id', request()->user()->id)
                ->where('challenge_seed_id', $challengeSeed->id)
                ->first(),
        ]);
    }
}
