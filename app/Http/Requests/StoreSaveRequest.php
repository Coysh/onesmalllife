<?php

namespace App\Http\Requests;

use App\Domain\Campaigns\CampaignState;
use App\Domain\Campaigns\Stage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates an incoming save. The client is untrusted (brief §22): we check the
 * shape, allowed identifiers, numeric ranges and schema version here; the
 * controller additionally enforces ownership and legal stage transitions.
 */
class StoreSaveRequest extends FormRequest
{
    public function authorize(): bool
    {
        $campaign = $this->route('campaign');

        return $campaign !== null && $this->user()?->can('update', $campaign);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $stages = Stage::values();

        return [
            'slot' => ['nullable', 'integer', 'min:0', 'max:9'],
            'label' => ['nullable', 'string', 'max:60'],
            'session_seconds' => ['nullable', 'integer', 'min:0', 'max:86400'],

            'state' => ['required', 'array'],
            'state.saveSchemaVersion' => ['required', 'integer', Rule::in([CampaignState::SCHEMA_VERSION])],

            'state.progress' => ['required', 'array'],
            'state.progress.currentStage' => ['required', 'string', Rule::in($stages)],
            'state.progress.completed' => ['required', 'boolean'],
            'state.progress.endingId' => ['nullable', 'string', 'max:64'],

            'state.species' => ['required', 'array'],
            'state.species.name' => ['required', 'string', 'max:60'],

            'state.traits' => ['required', 'array'],
            'state.traits.active' => ['present', 'array', 'max:300'],
            'state.traits.active.*' => ['string', 'max:64'],
            'state.traits.inherited' => ['present', 'array', 'max:300'],
            'state.traits.inherited.*' => ['string', 'max:64'],

            'state.resources' => ['nullable', 'array'],
            'state.resources.*' => ['numeric', 'between:-1000000,1000000'],

            'state.history' => ['nullable', 'array', 'max:1000'],
        ];
    }
}
