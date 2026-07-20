<?php

namespace App\Console\Commands;

use App\Models\ChallengeSeed;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Mints today's daily challenge seed and this ISO week's weekly challenge seed,
 * if they don't already exist. Scheduled to run once a day (see
 * bootstrap/app.php) — running it more than once, or on any day, is safe:
 * firstOrCreate is keyed on (period_type, period_key), so a seed is only ever
 * generated the first time its period is seen.
 */
class GenerateChallengeSeeds extends Command
{
    protected $signature = 'challenges:generate';

    protected $description = 'Generate the daily and weekly challenge seeds, if missing';

    public function handle(): int
    {
        $daily = ChallengeSeed::firstOrCreate(
            ['period_type' => 'daily', 'period_key' => now()->format('Y-m-d')],
            ['seed' => Str::random(12)],
        );
        $this->info(($daily->wasRecentlyCreated ? 'Created' : 'Already exists').": {$daily->label()}");

        $weekly = ChallengeSeed::firstOrCreate(
            ['period_type' => 'weekly', 'period_key' => now()->format('o-\WW')],
            ['seed' => Str::random(12)],
        );
        $this->info(($weekly->wasRecentlyCreated ? 'Created' : 'Already exists').": {$weekly->label()}");

        return self::SUCCESS;
    }
}
