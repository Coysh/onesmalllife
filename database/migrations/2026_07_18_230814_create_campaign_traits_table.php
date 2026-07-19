<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaign_traits', function (Blueprint $table) {
            $table->id();
            $table->uuid('campaign_id');
            $table->foreign('campaign_id')->references('id')->on('campaigns')->cascadeOnDelete();
            $table->string('trait_id');
            $table->boolean('inherited')->default(false);
            $table->string('acquired_stage')->default('cell');
            $table->timestamps();

            $table->unique(['campaign_id', 'trait_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_traits');
    }
};
