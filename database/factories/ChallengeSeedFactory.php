<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\ChallengeSeed>
 */
class ChallengeSeedFactory extends Factory
{
    public function definition(): array
    {
        return [
            'period_type' => 'daily',
            'period_key' => fake()->unique()->date('Y-m-d'),
            'seed' => fake()->bothify('chal-####-????'),
        ];
    }

    public function weekly(): static
    {
        return $this->state(fn () => [
            'period_type' => 'weekly',
            'period_key' => fake()->unique()->numerify('2026-W##'),
        ]);
    }
}
