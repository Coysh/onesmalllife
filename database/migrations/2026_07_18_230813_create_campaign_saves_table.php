<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaign_saves', function (Blueprint $table) {
            $table->id();
            $table->uuid('campaign_id');
            $table->foreign('campaign_id')->references('id')->on('campaigns')->cascadeOnDelete();
            // slot 0 = autosave; 1..n = manual save slots
            $table->unsignedSmallInteger('slot')->default(0);
            $table->string('label')->nullable();
            $table->string('stage')->default('cell');
            $table->unsignedInteger('save_schema_version')->default(1);
            $table->jsonb('state');
            $table->timestamps();

            $table->unique(['campaign_id', 'slot']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_saves');
    }
};
