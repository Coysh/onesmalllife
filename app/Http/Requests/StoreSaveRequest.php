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
            // Accept the previous version too, so a browser still running the
            // last JS bundle doesn't 422 on every autosave during a deploy.
            // The controller always stores at the current version.
            'state.saveSchemaVersion' => ['required', 'integer', Rule::in(CampaignState::ACCEPTED_SCHEMA_VERSIONS)],

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

            // Per-stage state (charted map, colonies, powers met), keyed by
            // stage id. Bounded so an untrusted client cannot post a save of
            // unlimited size; contents are the player's own and only affect
            // their campaign.
            'state.stageState' => ['nullable', 'array', 'max:6'],
            'state.stageState.*' => ['array'],
            'state.stageState.*.taken' => ['sometimes', 'array', 'max:500'],
            'state.stageState.*.taken.*' => ['string', 'max:64'],
            'state.stageState.*.discovered' => ['sometimes', 'array', 'max:400'],
            'state.stageState.*.colonies' => ['sometimes', 'array', 'max:64'],
            'state.stageState.*.rivalClaims' => ['sometimes', 'array', 'max:64'],
            'state.stageState.*.rivalClaims.*' => ['string', 'max:64'],
            'state.stageState.*.encountered' => ['sometimes', 'array', 'max:64'],
            'state.stageState.*.encountered.*' => ['string', 'max:64'],
            'state.stageState.*.rivals' => ['sometimes', 'array', 'max:64'],

            // Stage 2's bounded creature build. These named fields deliberately
            // do not accept arbitrary object keys or invented part ids.
            'state.stageState.creature' => ['sometimes', 'array:version,equipped,unlocked,collected'],
            'state.stageState.creature.version' => ['required_with:state.stageState.creature', 'integer', Rule::in([1])],
            'state.stageState.creature.equipped' => ['required_with:state.stageState.creature', 'array:locomotion,feeding,adaptation'],
            'state.stageState.creature.equipped.locomotion' => ['required_with:state.stageState.creature', 'string', Rule::in(['steady-legs', 'bounding-legs', 'endurance-feet'])],
            'state.stageState.creature.equipped.feeding' => ['required_with:state.stageState.creature', 'string', Rule::in(['grazing-jaws', 'hunting-fangs', 'grinding-molars', 'serrated-fangs'])],
            'state.stageState.creature.equipped.adaptation' => ['required_with:state.stageState.creature', 'string', Rule::in(['watchful-senses', 'thick-hide', 'keen-eyes'])],
            'state.stageState.creature.unlocked' => ['required_with:state.stageState.creature', 'array', 'max:10'],
            'state.stageState.creature.unlocked.*' => ['string', Rule::in(['steady-legs', 'bounding-legs', 'endurance-feet', 'grazing-jaws', 'hunting-fangs', 'grinding-molars', 'serrated-fangs', 'watchful-senses', 'thick-hide', 'keen-eyes'])],
            'state.stageState.creature.collected' => ['required_with:state.stageState.creature', 'array', 'max:6'],
            'state.stageState.creature.collected.*' => ['string', 'max:64'],

            'state.chronicle' => ['nullable', 'array', 'max:6'],
        ];
    }

    /** An equipped part is meaningful only if the player has unlocked it. */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $build = data_get($this->input('state'), 'stageState.creature');
            if (!is_array($build)) {
                return;
            }
            $unlocked = array_flip(is_array($build['unlocked'] ?? null) ? $build['unlocked'] : []);
            foreach ((array) ($build['equipped'] ?? []) as $part) {
                if (!isset($unlocked[$part])) {
                    $validator->errors()->add('state.stageState.creature.equipped', 'Equipped creature parts must be unlocked.');
                    return;
                }
            }
        });
    }
}
