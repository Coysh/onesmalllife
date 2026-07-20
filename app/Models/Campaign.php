<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Campaign extends Model
{
    use HasFactory;
    use HasUuids;

    protected $fillable = [
        'user_id',
        'name',
        'seed',
        'generator_version',
        'content_version',
        'save_schema_version',
        'current_stage',
        'completed',
        'ending_id',
        'play_time_seconds',
        'species_name',
        'last_played_at',
        'appearance',
        'share_token',
        'gallery_public',
        'challenge_seed_id',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'completed' => 'boolean',
            'save_schema_version' => 'integer',
            'play_time_seconds' => 'integer',
            'last_played_at' => 'datetime',
            'completed_at' => 'datetime',
            'appearance' => 'array',
            'gallery_public' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function challengeSeed(): BelongsTo
    {
        return $this->belongsTo(ChallengeSeed::class);
    }

    public function saves(): HasMany
    {
        return $this->hasMany(CampaignSave::class);
    }

    public function traits(): HasMany
    {
        return $this->hasMany(CampaignTrait::class);
    }

    /** The autosave lives in slot 0. */
    public function autosave(): ?CampaignSave
    {
        return $this->saves()->where('slot', 0)->first();
    }

    /** Whether this lineage is currently shared via a public link. */
    public function isShared(): bool
    {
        return $this->share_token !== null;
    }

    /** Mint the share token if absent; returns the token either way. */
    public function ensureShareToken(): string
    {
        if ($this->share_token === null) {
            $this->update(['share_token' => Str::random(16)]);
        }

        return $this->share_token;
    }

    /** The public showcase URL, or null while private. */
    public function shareUrl(): ?string
    {
        return $this->share_token ? route('shared.show', $this->share_token) : null;
    }

    /** Gallery listing requires both an active share link and a finished lineage. */
    public function isGalleryEligible(): bool
    {
        return $this->isShared() && $this->completed;
    }
}
