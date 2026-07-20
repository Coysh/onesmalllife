<?php

use App\Http\Controllers\CampaignController;
use App\Http\Controllers\ChallengeController;
use App\Http\Controllers\GalleryController;
use App\Http\Controllers\PlayController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SharedCampaignController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Public, unlisted showcase of a shared lineage (token is the only way in).
Route::get('/s/{token}', [SharedCampaignController::class, 'show'])->name('shared.show');

// Public hall of fame — every gallery-opted-in, completed lineage.
Route::get('/gallery', [GalleryController::class, 'index'])->name('gallery.index');

Route::middleware('auth')->group(function () {
    // Dashboard = the player's lineages.
    Route::get('/dashboard', [CampaignController::class, 'index'])->name('dashboard');

    Route::view('/settings', 'settings')->name('settings');

    // Campaign lifecycle.
    Route::get('/campaigns/create', [CampaignController::class, 'create'])->name('campaigns.create');
    Route::post('/campaigns', [CampaignController::class, 'store'])->name('campaigns.store');
    Route::delete('/campaigns/{campaign}', [CampaignController::class, 'destroy'])->name('campaigns.destroy');
    Route::get('/campaigns/{campaign}/ending', [CampaignController::class, 'ending'])->name('campaigns.ending');
    Route::get('/campaigns/{campaign}/history', [CampaignController::class, 'history'])->name('campaigns.history');

    // Opt-in sharing of a lineage (owner only).
    Route::post('/campaigns/{campaign}/share', [SharedCampaignController::class, 'enable'])->name('campaigns.share');
    Route::delete('/campaigns/{campaign}/share', [SharedCampaignController::class, 'disable'])->name('campaigns.unshare');

    // Opt-in public gallery/leaderboard listing (owner only; requires sharing + completed).
    Route::post('/campaigns/{campaign}/gallery', [SharedCampaignController::class, 'enterGallery'])->name('campaigns.gallery.enter');
    Route::delete('/campaigns/{campaign}/gallery', [SharedCampaignController::class, 'leaveGallery'])->name('campaigns.gallery.leave');

    // Shared-seed challenges.
    Route::get('/challenges', [ChallengeController::class, 'index'])->name('challenges.index');
    Route::get('/challenges/{challengeSeed}', [ChallengeController::class, 'show'])->name('challenges.show');

    // Play a campaign + persist its autosave.
    Route::get('/play/{campaign}', [PlayController::class, 'show'])->name('play');
    Route::post('/play/{campaign}/save', [PlayController::class, 'save'])->name('play.save');
    Route::post('/play/{campaign}/advance', [PlayController::class, 'advance'])->name('play.advance');
    Route::post('/play/{campaign}/slots/{slot}/save', [PlayController::class, 'saveSlot'])->whereNumber('slot')->name('play.slot.save');
    Route::post('/play/{campaign}/slots/{slot}/restore', [PlayController::class, 'restoreSlot'])->whereNumber('slot')->name('play.slot.restore');
});

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
