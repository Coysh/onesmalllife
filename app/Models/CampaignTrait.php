<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignTrait extends Model
{
    protected $fillable = [
        'campaign_id',
        'trait_id',
        'inherited',
        'acquired_stage',
    ];

    protected function casts(): array
    {
        return [
            'inherited' => 'boolean',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
