<?php

namespace App\Http\Controllers;

use App\Domain\Campaigns\EndingResolver;
use App\Domain\Species\TraitCatalog;
use App\Models\Campaign;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

/**
 * Opt-in public showcase of a finished lineage. The owner toggles sharing on/off
 * (mint/clear an unguessable token); anyone with the link sees a read-only,
 * de-identified card — portrait, species name, ending and adaptations — with no
 * account details and no way to reach the owner's other lineages. Unlisted and
 * noindex: the only route in is the token itself.
 */
class SharedCampaignController extends Controller
{
    /** Public: render a shared lineage by its token (no auth). */
    public function show(string $token): View
    {
        $campaign = Campaign::where('share_token', $token)->firstOrFail();

        $traitIds = $campaign->traits()->pluck('trait_id')->all();
        $adaptations = collect($traitIds)
            ->map(fn (string $id): string => TraitCatalog::name($id))
            ->sort()
            ->values()
            ->all();

        return view('campaigns.shared', [
            'campaign' => $campaign,
            'ending' => $campaign->completed ? EndingResolver::resolve($campaign) : null,
            'inheritedTraits' => $traitIds,
            'adaptations' => $adaptations,
        ]);
    }

    /** Owner: turn sharing on, minting a token if needed. */
    public function enable(Campaign $campaign): RedirectResponse
    {
        $this->authorize('update', $campaign);
        $campaign->ensureShareToken();

        return back()->with('status', 'Share link ready.');
    }

    /** Owner: turn sharing off, revoking the public link. */
    public function disable(Campaign $campaign): RedirectResponse
    {
        $this->authorize('update', $campaign);
        $campaign->update(['share_token' => null]);

        return back()->with('status', 'Sharing turned off.');
    }
}
