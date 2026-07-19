<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaigns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('seed');
            $table->string('generator_version')->default('0.1.0');
            $table->string('content_version')->default('0.1.0');
            $table->unsignedInteger('save_schema_version')->default(1);
            $table->string('current_stage')->default('cell');
            $table->boolean('completed')->default(false);
            $table->string('ending_id')->nullable();
            $table->unsignedBigInteger('play_time_seconds')->default(0);
            $table->string('species_name')->nullable();
            $table->timestamp('last_played_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'last_played_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaigns');
    }
};
