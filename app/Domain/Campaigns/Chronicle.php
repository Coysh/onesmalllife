<?php

namespace App\Domain\Campaigns;

use App\Domain\Species\TraitCatalog;
use App\Models\Campaign;
use Illuminate\Support\Collection;

/**
 * The account-level legacy layer: rolls a player's whole set of lineages into
 * one Chronicle — ending families discovered, adaptations ever collected, the
 * furthest stage reached, and lifetime totals. Turns disconnected playthroughs
 * into a single growing record, so the account itself accrues meaning.
 *
 * Pure read over already-loaded campaigns (with their traits) — no queries of
 * its own, so it is trivially testable and adds nothing to the request budget.
 */
class Chronicle
{
    /**
     * @param  Collection<int,Campaign>  $campaigns  eager-loaded with `traits`
     * @return array<string,mixed>
     */
    public static function from(Collection $campaigns): array
    {
        $completed = $campaigns->where('completed', true);

        // Ending families discovered. Deterministic: prefer the persisted
        // ending_id, falling back to resolving traits for older completed
        // lineages that finished before ending_id was recorded.
        $familyDefs = EndingResolver::families();
        $counts = array_fill_keys(array_keys($familyDefs), 0);
        foreach ($completed as $campaign) {
            $id = $campaign->ending_id ?: EndingResolver::resolve($campaign)['id'];
            if (isset($counts[$id])) {
                $counts[$id]++;
            }
        }
        $families = [];
        foreach ($familyDefs as $id => $def) {
            $families[] = [
                'id' => $id,
                'name' => $def['name'],
                'tagline' => $def['tagline'],
                'count' => $counts[$id],
                'discovered' => $counts[$id] > 0,
            ];
        }

        // Adaptations collected across every lineage (distinct trait ids).
        $adaptations = $campaigns
            ->flatMap(fn (Campaign $c) => $c->traits->pluck('trait_id'))
            ->unique()
            ->map(fn (string $id) => [
                'id' => $id,
                'name' => TraitCatalog::name($id),
                'category' => (string) (TraitCatalog::get($id)['category'] ?? 'other'),
            ])
            ->sortBy([['category', 'asc'], ['name', 'asc']])
            ->values()
            ->all();

        // Furthest stage reached across all lineages.
        $order = array_map(fn (Stage $s): string => $s->value, Stage::cases());
        $furthest = Stage::Cell;
        foreach ($campaigns as $campaign) {
            $stage = Stage::from($campaign->current_stage);
            if (array_search($stage->value, $order, true) > array_search($furthest->value, $order, true)) {
                $furthest = $stage;
            }
        }

        $playSeconds = (int) $campaigns->sum('play_time_seconds');

        return [
            'lineages' => $campaigns->count(),
            'completed' => $completed->count(),
            'furthestStage' => $furthest->label(),
            'reachedStars' => $completed->isNotEmpty(),
            'playSeconds' => $playSeconds,
            'playLabel' => self::humanizeDuration($playSeconds),
            'families' => $families,
            'familiesDiscovered' => count(array_filter($families, fn (array $f): bool => $f['discovered'])),
            'familiesTotal' => count($familyDefs),
            'adaptations' => $adaptations,
            'adaptationsCollected' => count($adaptations),
            'adaptationsTotal' => count(TraitCatalog::all()),
        ];
    }

    private static function humanizeDuration(int $seconds): string
    {
        if ($seconds < 60) {
            return $seconds.'s';
        }
        $minutes = intdiv($seconds, 60);
        if ($minutes < 60) {
            return $minutes.'m';
        }

        return intdiv($minutes, 60).'h '.($minutes % 60).'m';
    }
}
