<?php

namespace App\Http\Controllers;

use App\Domain\Campaigns\Leaderboard;
use App\Models\Campaign;

/**
 * Public, no-auth hall of fame: every completed lineage its owner opted into
 * the gallery (Campaign::gallery_public), ranked fastest-to-the-stars first.
 * Same privacy model as the unlisted share link — this is the one place that
 * model is deliberately made discoverable, since listing here is an explicit
 * second opt-in on top of sharing.
 */
class GalleryController extends Controller
{
    public function index(): \Illuminate\View\View
    {
        $campaigns = Campaign::where('gallery_public', true)
            ->where('completed', true)
            ->with('traits')
            ->get();

        return view('gallery.index', [
            'leaderboard' => Leaderboard::from($campaigns),
        ]);
    }
}
