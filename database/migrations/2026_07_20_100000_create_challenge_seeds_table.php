<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A shared seed all players can play the same day/week, generated automatically
 * (see App\Console\Commands\GenerateChallengeSeeds). One row per period — the
 * unique (period_type, period_key) pair is what makes generation idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('challenge_seeds', function (Blueprint $table) {
            $table->id();
            $table->string('period_type'); // 'daily' | 'weekly'
            $table->string('period_key'); // e.g. '2026-07-20' or '2026-W29'
            $table->string('seed');
            $table->timestamps();

            $table->unique(['period_type', 'period_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('challenge_seeds');
    }
};
