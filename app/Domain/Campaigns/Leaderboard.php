<?php

namespace App\Domain\Campaigns;

use App\Models\Campaign;
use Illuminate\Support\Collection;

/**
 * Ranks the completed lineages an owner has opted into the public gallery
 * (Campaign::isGalleryEligible) — by fastest journey to the stars, in
 * play_time_seconds. Used both for the site-wide gallery and for a single
 * challenge seed's leaderboard (the caller decides which campaigns to pass
 * in; this class only ranks them).
 *
 * Pure read over already-loaded campaigns (with `traits`), same shape as
 * Chronicle — no queries of its own.
 */
class Leaderboard
{
    /**
     * @param  Collection<int,Campaign>  $campaigns  eager-loaded with `traits`, already filtered to gallery-eligible rows
     * @return list<array<string,mixed>>
     */
    public static function from(Collection $campaigns): array
    {
        return $campaigns
            ->filter(fn (Campaign $c) => $c->isGalleryEligible())
            ->sortBy(fn (Campaign $c) => $c->play_time_seconds)
            ->values()
            ->map(fn (Campaign $c, int $i) => [
                'rank' => $i + 1,
                'campaign' => $c,
                'speciesName' => $c->species_name,
                'ending' => $c->ending_id ? EndingResolver::resolve($c) : null,
                'playSeconds' => $c->play_time_seconds,
                'playLabel' => self::humanizeDuration($c->play_time_seconds),
                'adaptations' => $c->traits->count(),
                'completedAt' => $c->completed_at,
                'shareUrl' => $c->shareUrl(),
                'isChallenge' => $c->challenge_seed_id !== null,
            ])
            ->all();
    }

    private static function humanizeDuration(int $seconds): string
    {
        if ($seconds < 60) {
            return $seconds.'s';
        }
        $minutes = intdiv($seconds, 60);
        if ($minutes < 60) {
            return $minutes.'m';
        }

        return intdiv($minutes, 60).'h '.($minutes % 60).'m';
    }
}
