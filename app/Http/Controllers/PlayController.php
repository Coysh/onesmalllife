<?php

namespace App\Http\Controllers;

use App\Domain\Campaigns\CampaignState;
use App\Domain\Campaigns\EndingResolver;
use App\Domain\Campaigns\Stage;
use App\Domain\Saves\SaveMigrator;
use App\Domain\Species\PortraitComposer;
use App\Http\Requests\StoreSaveRequest;
use App\Models\Campaign;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;

class PlayController extends Controller
{
    /** Load a campaign into the game shell. */
    public function show(Campaign $campaign): \Illuminate\View\View
    {
        $this->authorize('view', $campaign);

        $state = $campaign->autosave()?->state
            ?? CampaignState::initial($campaign->seed, $campaign->species_name ?? 'Your lineage');
        $state = SaveMigrator::migrate($state); // upgrade older saves on load

        // Dev-only playtest jump: /play/{id}?stage=civilisation loads any stage
        // directly (local environment only; never affects the stored save).
        $jumped = false;
        $jump = request()->query('stage');
        if (is_string($jump) && app()->environment('local') && Stage::tryFrom($jump) !== null) {
            $state['progress']['currentStage'] = $jump;
            $state['resources'] = [];
            $jumped = true;
        }

        // Expose the chosen palette + parts so the in-game organism matches
        // its portrait (appearance v2; legacy appearances are normalised).
        $portrait = PortraitComposer::spec($campaign->seed, [], $campaign->appearance);
        $state['species']['palette'] = [
            'albedo' => $portrait['albedo'],
            'accent' => $portrait['accent'],
            'detail' => $portrait['detail'],
        ];
        $state['species']['appearance'] = $portrait['appearance'];

        $slots = $campaign->saves()->whereBetween('slot', [1, 3])->get()->keyBy('slot');

        return view('game.play', [
            'campaign' => $campaign,
            'seed' => $campaign->seed,
            'species' => $campaign->species_name ?? 'Your lineage',
            'state' => $state,
            // A dev stage-jump is a transient playtest — never autosave it (the
            // stored stage would reject the illegal transition anyway).
            'saveUrl' => $jumped ? '' : route('play.save', $campaign),
            'slots' => $slots,
        ]);
    }

    /** Persist an autosave from the client (untrusted — validated by the request). */
    public function save(StoreSaveRequest $request, Campaign $campaign): JsonResponse
    {
        $validated = $request->validated();
        $state = $validated['state'];

        $incomingStage = Stage::from($state['progress']['currentStage']);
        $currentStage = Stage::from($campaign->current_stage);

        // Enforce legal transitions server-side (no skipping stages).
        if (! $currentStage->canTransitionTo($incomingStage)) {
            return response()->json([
                'message' => 'Illegal stage transition.',
            ], 422);
        }

        $campaign->saves()->updateOrCreate(
            ['slot' => 0],
            [
                'stage' => $incomingStage->value,
                'save_schema_version' => CampaignState::SCHEMA_VERSION,
                'state' => $state,
            ],
        );

        $campaign->update([
            'current_stage' => $incomingStage->value,
            'completed' => (bool) ($state['progress']['completed'] ?? false),
            'species_name' => $state['species']['name'] ?? $campaign->species_name,
            'play_time_seconds' => $campaign->play_time_seconds + (int) ($validated['session_seconds'] ?? 0),
            'last_played_at' => now(),
        ]);

        // Project active traits into the queryable table (server-side ownership record).
        $active = $state['traits']['active'] ?? [];
        foreach ($active as $traitId) {
            $campaign->traits()->updateOrCreate(
                ['trait_id' => $traitId],
                ['inherited' => false, 'acquired_stage' => $incomingStage->value],
            );
        }

        return response()->json(['saved' => true, 'at' => now()->toIso8601String()]);
    }

    /** Bookmark the current progress into a manual save slot (1–3). */
    public function saveSlot(Campaign $campaign, int $slot): RedirectResponse
    {
        $this->authorize('update', $campaign);
        abort_unless($slot >= 1 && $slot <= 3, 404);

        $autosave = $campaign->autosave();
        abort_if($autosave === null, 422, 'Nothing to save yet.');

        $campaign->saves()->updateOrCreate(
            ['slot' => $slot],
            [
                'label' => Stage::from($campaign->current_stage)->label().' · '.now()->format('M j, H:i'),
                'stage' => $autosave->stage,
                'save_schema_version' => $autosave->save_schema_version,
                'state' => $autosave->state,
            ],
        );

        return redirect()->route('play', $campaign)->with('status', "Saved to slot {$slot}.");
    }

    /** Restore a manual save slot into the live autosave, then reload. */
    public function restoreSlot(Campaign $campaign, int $slot): RedirectResponse
    {
        $this->authorize('update', $campaign);
        $save = $campaign->saves()->where('slot', $slot)->firstOrFail();

        $campaign->saves()->updateOrCreate(
            ['slot' => 0],
            ['stage' => $save->stage, 'save_schema_version' => $save->save_schema_version, 'state' => $save->state],
        );
        $campaign->update(['current_stage' => $save->stage, 'last_played_at' => now()]);

        return redirect()->route('play', $campaign)->with('status', "Restored slot {$slot}.");
    }

    /** Advance the lineage to the next stage, carrying traits forward as inherited. */
    public function advance(Campaign $campaign): RedirectResponse
    {
        $this->authorize('update', $campaign);

        $current = Stage::from($campaign->current_stage);
        $next = $current->next();

        $state = $campaign->autosave()?->state
            ?? CampaignState::initial($campaign->seed, $campaign->species_name ?? 'Your lineage');

        // Record how this stage ended before its resources are cleared — this
        // is what lets the ending reflect the whole lineage rather than only
        // the traits picked up in stages 1–2.
        $allStageState = (array) ($state['stageState'] ?? []);
        $stageState = (array) ($allStageState[$current->value] ?? []);
        $state['chronicle'][$current->value] = array_merge($state['resources'] ?? [], [
            // Counts, not the objects: the epilogue wants "what did you do",
            // and the full records stay in stageState.
            'colonies' => count($stageState['colonies'] ?? []),
            'contacts' => count(array_filter(
                $stageState['rivals'] ?? [],
                fn ($r) => str_starts_with((string) ($r['id'] ?? ''), 'native:'),
            )),
            'worldsSeen' => count($stageState['encountered'] ?? []),
        ]);

        if ($next === null) {
            $campaign->saves()->updateOrCreate(
                ['slot' => 0],
                ['stage' => $current->value, 'save_schema_version' => CampaignState::SCHEMA_VERSION, 'state' => $state],
            );
            $campaign->refresh();

            // Persist the resolved ending family so the Chronicle can tally
            // families discovered without re-deriving it every time.
            // completed_at (real-world clock, distinct from play_time_seconds)
            // is what lets challenge/gallery leaderboards rank by speed.
            $campaign->update([
                'completed' => true,
                'ending_id' => EndingResolver::resolve($campaign)['id'],
                'completed_at' => now(),
                'last_played_at' => now(),
            ]);

            return redirect()->route('campaigns.ending', $campaign);
        }

        // Everything the organism has become carries forward as inherited.
        $active = $state['traits']['active'] ?? [];
        $inherited = array_values(array_unique(array_merge($state['traits']['inherited'] ?? [], $active)));

        $state['traits']['inherited'] = $inherited;
        $state['progress']['currentStage'] = $next->value;
        $state['progress']['completed'] = false;
        $state['resources'] = []; // per-stage resources start fresh
        $state['history'][] = [
            't' => $campaign->play_time_seconds,
            'category' => 'evolution',
            'title' => $next->label().' begins',
            'description' => "The lineage crosses into the {$next->label()} stage.",
        ];

        $campaign->saves()->updateOrCreate(
            ['slot' => 0],
            ['stage' => $next->value, 'save_schema_version' => CampaignState::SCHEMA_VERSION, 'state' => $state],
        );

        foreach ($inherited as $traitId) {
            $campaign->traits()->updateOrCreate(
                ['trait_id' => $traitId],
                ['inherited' => true, 'acquired_stage' => $current->value],
            );
        }

        $campaign->update(['current_stage' => $next->value, 'completed' => false, 'last_played_at' => now()]);

        return redirect()->route('play', $campaign);
    }
}

