<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Opt-in sharing: an unguessable token that turns a finished lineage into a
 * read-only public showcase. Null (the default) means private, as every lineage
 * is today; a token is minted only when the owner chooses to share.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->string('share_token', 32)->nullable()->unique()->after('ending_id');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('share_token');
        });
    }
};
