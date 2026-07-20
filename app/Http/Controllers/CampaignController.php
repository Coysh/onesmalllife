<?php

namespace App\Http\Controllers;

use App\Domain\Campaigns\CampaignState;
use App\Domain\Campaigns\Chronicle;
use App\Domain\Campaigns\EndingResolver;
use App\Domain\Campaigns\Stage;
use App\Domain\Species\PartCatalog;
use App\Http\Requests\StoreCampaignRequest;
use App\Models\Campaign;
use App\Models\ChallengeSeed;
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
        // Arriving from the challenges page ties this build to that seed —
        // the query param just pre-fills a hidden field on the form.
        $challengeSeed = request()->filled('challenge_seed_id')
            ? ChallengeSeed::find(request()->query('challenge_seed_id'))
            : null;

        return view('campaigns.create', ['challengeSeed' => $challengeSeed]);
    }

    /** Start a new lineage: generate a seed + species, seed the autosave. */
    public function store(StoreCampaignRequest $request): RedirectResponse
    {
        // A challenge seed (daily/weekly) puts everyone in the same starting
        // world; otherwise each lineage gets its own random one.
        $challengeSeed = $request->filled('challenge_seed_id')
            ? ChallengeSeed::find($request->input('challenge_seed_id'))
            : null;

        $seed = $challengeSeed?->seed ?? Str::random(12);
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
            'challenge_seed_id' => $challengeSeed?->id,
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
            // How each later stage finished — the epilogue reports the whole
            // lineage, not only the traits it happened to pick up early.
            'chronicle' => $state['chronicle'] ?? [],
            'reasons' => self::endingReasons($state['chronicle'] ?? []),
        ]);
    }

    /**
     * The lineage's later stages read back as plain sentences, so the ending is
     * explained rather than merely announced. Mirrors the weightings in
     * EndingResolver — if those thresholds move, move these with them.
     *
     * @param  array<string,array<string,float>>  $chronicle
     * @return list<string>
     */
    private static function endingReasons(array $chronicle): array
    {
        $of = fn (string $stage, string $res) => (float) ($chronicle[$stage][$res] ?? 0);
        $ecology = $of('planetary', 'ecology');

        $reasons = [];
        if ($of('tribe', 'culture') >= 200) {
            $reasons[] = 'Your tribe grew rich in story and song, and others were drawn to it.';
        }
        if ($of('civilisation', 'tech') >= 200) {
            $reasons[] = 'Your civilisation chased knowledge above all else.';
        }
        if ($of('civilisation', 'gold') >= 150) {
            $reasons[] = 'Your cities grew wealthy, and that wealth bought reach.';
        }
        if ($ecology >= 60) {
            $reasons[] = 'You left your homeworld greener than you found it.';
        } elseif ($ecology > 0 && $ecology < 20) {
            $reasons[] = 'Your homeworld was spent to build what came next.';
        }
        if ($of('planetary', 'unity') >= 220) {
            $reasons[] = 'The whole planet spoke with one voice before you left it.';
        }
        if ($of('space', 'research') >= 150) {
            $reasons[] = 'Among the stars, your people kept asking questions.';
        }
        if ($of('space', 'legacy') >= 220) {
            $reasons[] = 'Your lineage left a mark that will outlast its worlds.';
        }

        $colonies = (int) $of('space', 'colonies');
        $contacts = (int) $of('space', 'contacts');
        if ($colonies > 0) {
            $reasons[] = $colonies === 1
                ? 'One world beyond your own carries your people.'
                : "Your people took root on {$colonies} worlds beyond their own.";
        }
        if ($contacts > 0) {
            $reasons[] = $contacts === 1
                ? 'You met another species out there, and chose to speak.'
                : "You met {$contacts} other species out there, and chose to speak.";
        } elseif ($of('space', 'worldsSeen') >= 3) {
            $reasons[] = 'You crossed a galaxy and spoke to no one.';
        }

        return $reasons;
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
