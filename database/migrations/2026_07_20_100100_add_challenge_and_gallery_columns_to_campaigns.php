<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * completed_at: when a lineage reached its ending — needed to rank challenge
 * and gallery leaderboards by real-world speed, which play_time_seconds alone
 * (cumulative session time) can't do.
 *
 * gallery_public: an opt-in second gate on top of share_token. A lineage must
 * already be shared *and* completed before its owner can list it in the public
 * gallery/leaderboards — sharing a private link stays strictly less exposed
 * than appearing in a leaderboard.
 *
 * challenge_seed_id: links a campaign to the ChallengeSeed it was started
 * from, if any. Null for ordinary (randomly seeded) lineages.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->timestamp('completed_at')->nullable()->after('ending_id');
            $table->boolean('gallery_public')->default(false)->after('share_token');
            $table->foreignId('challenge_seed_id')->nullable()->after('gallery_public')
                ->constrained('challenge_seeds')->nullOnDelete();

            $table->index('challenge_seed_id');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropConstrainedForeignId('challenge_seed_id');
            $table->dropColumn(['completed_at', 'gallery_public']);
        });
    }
};
