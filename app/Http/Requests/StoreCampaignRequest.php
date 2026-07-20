<?php

namespace App\Http\Requests;

use App\Domain\Species\PartCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCampaignRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Any signed-in user may start a new lineage; the route is auth-guarded.
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [
            'name' => ['nullable', 'string', 'max:60'],
            'palette' => ['nullable', 'integer', 'min:0', 'max:'.(PartCatalog::paletteCount() - 1)],
            'challenge_seed_id' => ['nullable', 'integer', 'exists:challenge_seeds,id'],
        ];

        // Part slots validate against the shared catalogue (appearance v2).
        foreach (PartCatalog::SLOTS as $slot) {
            $rules[$slot] = ['nullable', 'string', Rule::in(PartCatalog::ids($slot))];
        }

        return $rules;
    }
}
