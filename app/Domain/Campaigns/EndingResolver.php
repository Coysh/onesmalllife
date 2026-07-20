<?php

namespace App\Domain\Campaigns;

use App\Models\Campaign;

/**
 * Chooses one of the ending families (brief §21) from a campaign's accumulated
 * traits — an ending is earned by the whole journey, not a single final choice.
 * Deterministic: the same lineage always resolves to the same ending.
 */
class EndingResolver
{
    /**
     * @return array{id: string, name: string, tagline: string, summary: string}
     */
    public static function resolve(Campaign $campaign): array
    {
        $traitIds = $campaign->traits()->pluck('trait_id')->all();
        $has = fn (string $id) => in_array($id, $traitIds, true);

        // No baseline: federation used to start a point ahead and win every
        // tie, which made most lineages resolve the same way regardless of play.
        $scores = [
            'federation' => 0,
            'stewardship' => 0,
            'empire' => 0,
            'transcendence' => 0,
            'isolation' => 0,
        ];

        // The ending is earned by the whole arc — cell AND creature choices.
        if ($has('cognition:curious')) {
            $scores['transcendence'] += 3;
            $scores['federation'] += 1;
        }
        if ($has('biology:membrane_ii') || $has('biology:membrane_i')) {
            $scores['empire'] += 2;
        }
        if ($has('feeding:filter')) {
            $scores['stewardship'] += 2;
        }
        if ($has('biology:mucus_coat')) {
            $scores['isolation'] += 2;
        }
        if ($has('movement:cilia') || $has('movement:flagellum')) {
            $scores['federation'] += 2;
        }
        // Creature-stage adaptations weigh in too.
        if ($has('creature:jaws')) {
            $scores['empire'] += 3; // a predator's line
        }
        if ($has('creature:hide')) {
            $scores['isolation'] += 2;
            $scores['stewardship'] += 1; // enduring, self-reliant
        }
        if ($has('creature:legs') || $has('creature:swift')) {
            $scores['federation'] += 2; // restless wanderers who reach outward
        }
        if ($has('creature:senses')) {
            $scores['transcendence'] += 2; // a mind that reads the world
        }
        if ($has('creature:gut')) {
            $scores['stewardship'] += 2; // frugal, in balance with the land
        }

        // Stages 3–6: how the lineage actually governed, built and treated its
        // world. Each stage's final resources are recorded on advance.
        $chronicle = $campaign->autosave()?->state['chronicle'] ?? [];
        $of = fn (string $stage, string $res) => (float) ($chronicle[$stage][$res] ?? 0);

        // Tribe — a people rich in culture bind others to them.
        if ($of('tribe', 'culture') >= 200) {
            $scores['federation'] += 2;
            $scores['stewardship'] += 1;
        }

        // Civilisation — knowledge or gold, and which you chased.
        if ($of('civilisation', 'tech') >= 200) {
            $scores['transcendence'] += 3;
        }
        if ($of('civilisation', 'gold') >= 150) {
            $scores['empire'] += 3;
        }

        // Planetary — the clearest moral signal in the game: did the biosphere
        // survive your industry?
        $ecology = $of('planetary', 'ecology');
        $industry = $of('planetary', 'industry');
        if ($ecology >= 60) {
            $scores['stewardship'] += 4;
        } elseif ($ecology > 0 && $ecology < 20) {
            $scores['empire'] += 3; // a world spent to build something else
        }
        if ($industry >= 120) {
            $scores['empire'] += 2;
        }
        if ($of('planetary', 'unity') >= 220) {
            $scores['federation'] += 3;
        }

        // Space — what the lineage reached for once it left home.
        if ($of('space', 'research') >= 150) {
            $scores['transcendence'] += 3;
        }
        if ($of('space', 'alloy') >= 150) {
            $scores['empire'] += 2;
        }
        if ($of('space', 'legacy') >= 220) {
            $scores['federation'] += 3;
        }
        // A lineage that reached the stars having built and shared very little
        // kept to itself.
        if ($of('space', 'alloy') < 60 && $of('space', 'research') < 60) {
            $scores['isolation'] += 3;
        }

        // What you actually did out there, not just what you accumulated.
        // Only judged if the lineage reached space at all — an unplayed stage
        // must not read as a deliberate choice to keep to yourself.
        if (isset($chronicle['space'])) {
            $colonies = $of('space', 'colonies');
            $contacts = $of('space', 'contacts');

            if ($colonies >= 4) {
                $scores['empire'] += 3; // worlds taken and held
            } elseif ($colonies <= 1) {
                $scores['isolation'] += 2; // you went out, and stayed few
            }

            if ($contacts >= 2) {
                $scores['federation'] += 4; // you spoke to what you found
            } elseif ($contacts === 0.0 && $of('space', 'worldsSeen') >= 3) {
                $scores['isolation'] += 2; // you saw them, and said nothing
            }
        }

        // Ties resolve deterministically by family order (empire never wins a
        // tie over stewardship by accident): keysort as a stable tiebreak.
        $max = max($scores);
        $id = 'federation';
        foreach ($scores as $family => $score) {
            if ($score === $max) {
                $id = $family;
                break;
            }
        }

        return array_merge(['id' => $id], self::FAMILIES[$id]);
    }

    /**
     * All ending families keyed by id — the full set a player can discover
     * across their lineages (the Chronicle's "families discovered" denominator).
     *
     * @return array<string,array{name:string,tagline:string,summary:string}>
     */
    public static function families(): array
    {
        return self::FAMILIES;
    }

    private const FAMILIES = [
        'federation' => [
            'name' => 'The Seedbearers',
            'tagline' => 'Your lineage carried life to a new star.',
            'summary' => 'Curious and connected, your people reached outward and bound distant worlds into a gentle federation of kin.',
        ],
        'stewardship' => [
            'name' => 'The Tidekeepers',
            'tagline' => 'Your lineage learned to tend a living world.',
            'summary' => 'Patient and rooted, your people healed their world and carried its balance with them among the stars.',
        ],
        'empire' => [
            'name' => 'The Farreach',
            'tagline' => 'Your lineage spread its banner across the dark.',
            'summary' => 'Resilient and bold, your people expanded relentlessly, claiming system after system for the lineage.',
        ],
        'transcendence' => [
            'name' => 'The Lumenborn',
            'tagline' => 'Your lineage became something more than flesh.',
            'summary' => 'Endlessly curious, your people turned inward and upward until mind outgrew the body that first stirred in the shallows.',
        ],
        'isolation' => [
            'name' => 'The Deepstill',
            'tagline' => 'Your lineage chose a quiet, deliberate path.',
            'summary' => 'Self-contained and content, your people withdrew into a chosen stillness, whole unto themselves among the stars.',
        ],
    ];
}
