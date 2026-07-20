<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A seed shared by every player for a given day or week (see
 * App\Console\Commands\GenerateChallengeSeeds, which mints these
 * automatically). Starting a campaign from a ChallengeSeed reuses its seed
 * instead of generating a random one, so every attempt starts from the same
 * world — outcomes then diverge purely on the choices each player makes.
 */
class ChallengeSeed extends Model
{
    use HasFactory;

    protected $fillable = [
        'period_type',
        'period_key',
        'seed',
    ];

    public function campaigns(): HasMany
    {
        return $this->hasMany(Campaign::class);
    }

    /** A human label, e.g. "Daily · 20 Jul 2026" or "Weekly · 2026-W29". */
    public function label(): string
    {
        $kind = $this->period_type === 'weekly' ? 'Weekly' : 'Daily';

        return "{$kind} · {$this->period_key}";
    }
}
