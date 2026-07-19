<?php

namespace App\Domain\Species;

/**
 * Builds a species-portrait spec from a campaign's seed, traits and chosen
 * appearance. The portrait is composed from the same conceptual parts the game
 * uses (brief §15): the player's part choices (PartCatalog, appearance v2 —
 * legacy v1 appearances are normalised) set the baseline; trait
 * visualAttachments AUGMENT slots the player left at their defaults, never
 * overriding an explicit choice — so the DOM portrait always matches the
 * in-game organism.
 */
class PortraitComposer
{
    /** @var array<string, array<string,string>>|null */
    private static ?array $attachmentMap = null;

    /**
     * @param  list<string>  $traitIds
     * @param  array<string,mixed>|null  $appearance  Builder choices (v1 or v2).
     * @return array<string, mixed>
     */
    public static function spec(string $seed, array $traitIds = [], ?array $appearance = null): array
    {
        $n = crc32($seed);

        // No stored appearance at all → seed picks a look (pre-builder campaigns).
        $v2 = PartCatalog::toV2($appearance);
        if ($appearance === null) {
            $bodies = PartCatalog::ids('body');
            $patterns = PartCatalog::ids('pattern');
            $v2['palette'] = $n % PartCatalog::paletteCount();
            $v2['body'] = $bodies[intdiv($n, 7) % max(1, count($bodies))] ?? $v2['body'];
            $v2['pattern'] = (intdiv($n, 13) % 3) !== 0 ? ($patterns[1] ?? 'speckle') : 'plain';
        }

        $palette = PartCatalog::palettes()[$v2['palette']] ?? PartCatalog::palettes()[0];
        $body = PartCatalog::part('body', $v2['body']) ?? ['rx' => 34, 'ry' => 30];

        // Trait attachments fill slots the player left at their defaults.
        $attach = self::aggregateAttachments($traitIds);
        $defaults = ['membrane' => 'smooth', 'movement' => 'cilia', 'sensory' => 'eyespot', 'defense' => 'none'];
        foreach (['membrane', 'movement', 'sensory', 'defense'] as $slot) {
            if (isset($attach[$slot]) && $v2[$slot] === ($defaults[$slot] ?? null)) {
                $v2[$slot] = $attach[$slot];
            }
        }

        return [
            'albedo' => $palette['albedo'],
            'accent' => $palette['accent'],
            'detail' => $palette['detail'],
            'rx' => $body['rx'],
            'ry' => $body['ry'],
            'pattern' => $v2['pattern'] !== 'plain',
            'patternStyle' => $v2['pattern'],
            'membrane' => $v2['membrane'],
            'movement' => $v2['movement'],
            'feeding' => true,
            'feedingStyle' => $v2['feeding'],
            'sensory' => $v2['sensory'] !== 'none',
            'sensoryStyle' => $v2['sensory'],
            'defense' => $v2['defense'] !== 'none' || isset($attach['defense']),
            'defenseStyle' => $v2['defense'],
            'appearance' => $v2,
        ];
    }

    /**
     * @param  list<string>  $traitIds
     * @return array<string,string>
     */
    private static function aggregateAttachments(array $traitIds): array
    {
        $map = self::attachmentMap();
        $out = [];
        foreach ($traitIds as $id) {
            foreach ($map[$id] ?? [] as $slot => $value) {
                $out[$slot] = $value;
            }
        }

        return $out;
    }

    /** @return array<string, array<string,string>> */
    private static function attachmentMap(): array
    {
        if (self::$attachmentMap !== null) {
            return self::$attachmentMap;
        }

        $path = resource_path('game/data/traits.json');
        $map = [];
        if (is_file($path)) {
            $data = json_decode((string) file_get_contents($path), true);
            foreach ($data['traits'] ?? [] as $trait) {
                if (! empty($trait['visualAttachments'])) {
                    $map[$trait['id']] = $trait['visualAttachments'];
                }
            }
        }

        return self::$attachmentMap = $map;
    }
}
