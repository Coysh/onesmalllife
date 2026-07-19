<?php

namespace App\Http\Controllers;

use App\Domain\Campaigns\CampaignState;
use App\Domain\Campaigns\Chronicle;
use App\Domain\Campaigns\EndingResolver;
use App\Domain\Campaigns\Stage;
use App\Domain\Species\PartCatalog;
use App\Http\Requests\StoreCampaignRequest;
use App\Models\Campaign;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;

class CampaignController extends Controller
{
    /** Dashboard: the player's lineages, newest first. */
    public function index(): \Illuminate\View\View
    {
        $campaigns = Campaign::query()
            ->where('user_id', request()->user()->id)
            ->with('traits')
            ->orderByDesc('last_played_at')
            ->get();

        return view('dashboard', [
            'campaigns' => $campaigns,
            'chronicle' => Chronicle::from($campaigns),
        ]);
    }

    /** New-campaign setup screen. */
    public function create(): \Illuminate\View\View
    {
        return view('campaigns.create');
    }

    /** Start a new lineage: generate a seed + species, seed the autosave. */
    public function store(StoreCampaignRequest $request): RedirectResponse
    {
        $seed = Str::random(12);
        $species = $this->generateSpeciesName($seed);

        // Appearance v2: the builder posts one part id per slot (validated
        // against PartCatalog); normalise + fill defaults through toV2.
        $partInput = array_filter([
            'version' => 2,
            'palette' => $request->filled('palette') ? (int) $request->input('palette') : null,
            ...collect(PartCatalog::SLOTS)->mapWithKeys(fn (string $slot) => [$slot => $request->input($slot)])->all(),
        ], fn ($v) => $v !== null);

        $appearance = count($partInput) > 1 ? PartCatalog::toV2($partInput) : null;

        $campaign = Campaign::create([
            'user_id' => $request->user()->id,
            'name' => $request->input('name') ?: $species,
            'seed' => $seed,
            'current_stage' => Stage::Cell->value,
            'species_name' => $species,
            'last_played_at' => now(),
            'appearance' => $appearance,
        ]);

        $campaign->saves()->create([
            'slot' => 0,
            'stage' => Stage::Cell->value,
            'save_schema_version' => CampaignState::SCHEMA_VERSION,
            'state' => CampaignState::initial($seed, $species),
        ]);

        return redirect()->route('play', $campaign);
    }

    public function destroy(Campaign $campaign): RedirectResponse
    {
        $this->authorize('delete', $campaign);
        $campaign->delete();

        return redirect()->route('dashboard')->with('status', 'Lineage ended.');
    }

    /** The ending sequence — shown once the lineage completes the Space stage. */
    public function ending(Campaign $campaign): \Illuminate\View\View
    {
        $this->authorize('view', $campaign);

        $state = $campaign->autosave()?->state ?? [];

        return view('campaigns.ending', [
            'campaign' => $campaign,
            'ending' => EndingResolver::resolve($campaign),
            'inheritedTraits' => $campaign->traits()->pluck('trait_id')->all(),
            'history' => $state['history'] ?? [],
        ]);
    }

    /** The species-history timeline. */
    public function history(Campaign $campaign): \Illuminate\View\View
    {
        $this->authorize('view', $campaign);

        $state = $campaign->autosave()?->state ?? [];

        return view('campaigns.history', [
            'campaign' => $campaign,
            'history' => $state['history'] ?? [],
        ]);
    }

    private function generateSpeciesName(string $seed): string
    {
        $prefixes = ['Tide', 'Lumen', 'Coral', 'Drift', 'Ember', 'Vero', 'Silt', 'Marrow'];
        $suffixes = ['walkers', 'kin', 'folk', 'born', 'shoal', 'spire', 'wake', 'tide'];
        $n = crc32($seed);

        return $prefixes[$n % count($prefixes)].$suffixes[intdiv($n, 7) % count($suffixes)];
    }
}
