<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\Campaign>
 */
class CampaignFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->words(2, true),
            'seed' => fake()->bothify('seed-####-????'),
            'generator_version' => '0.1.0',
            'content_version' => '0.1.0',
            'save_schema_version' => 1,
            'current_stage' => 'cell',
            'completed' => false,
            'play_time_seconds' => 0,
            'species_name' => fake()->firstName().'kin',
            'last_played_at' => now(),
        ];
    }
}
