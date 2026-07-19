<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignSave extends Model
{
    protected $fillable = [
        'campaign_id',
        'slot',
        'label',
        'stage',
        'save_schema_version',
        'state',
    ];

    protected function casts(): array
    {
        return [
            'slot' => 'integer',
            'save_schema_version' => 'integer',
            'state' => 'array',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
