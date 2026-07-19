<?php

namespace App\Domain\Species;

/**
 * Reads the shared cell-part catalogue (resources/game/data/cell-parts.catalog.json)
 * — the single source of truth for the pre-creation builder, appearance
 * validation, portraits and in-game part effects. PHP and TypeScript both read
 * the same file so the creator, the portrait and the organism never disagree.
 */
class PartCatalog
{
    /** @var array<string,mixed>|null */
    private static ?array $catalog = null;

    public const SLOTS = ['body', 'membrane', 'feeding', 'movement', 'sensory', 'defense', 'pattern'];

    /** @return array<string,mixed> */
    public static function catalog(): array
    {
        if (self::$catalog !== null) {
            return self::$catalog;
        }

        $path = resource_path('game/data/cell-parts.catalog.json');
        $data = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;

        return self::$catalog = is_array($data) ? $data : ['slots' => [], 'palettes' => [], 'legacy' => []];
    }

    /**
     * Part options for one slot.
     *
     * @return list<array<string,mixed>>
     */
    public static function options(string $slot): array
    {
        return array_values(self::catalog()['slots'][$slot] ?? []);
    }

    /**
     * Valid part ids for a slot (for validation rules).
     *
     * @return list<string>
     */
    public static function ids(string $slot): array
    {
        return array_values(array_map(fn (array $o): string => (string) $o['id'], self::options($slot)));
    }

    /** @return list<array{name:string,albedo:string,accent:string,detail:string}> */
    public static function palettes(): array
    {
        return array_values(self::catalog()['palettes'] ?? []);
    }

    public static function paletteCount(): int
    {
        return max(1, count(self::palettes()));
    }

    /** One part definition, or null. @return array<string,mixed>|null */
    public static function part(string $slot, ?string $id): ?array
    {
        foreach (self::options($slot) as $option) {
            if (($option['id'] ?? null) === $id) {
                return $option;
            }
        }

        return null;
    }

    /**
     * Normalise any stored appearance (legacy v1 int-based, v2, or null) into
     * the v2 shape. Unknown/missing parts fall back to catalogue defaults.
     *
     * @param  array<string,mixed>|null  $appearance
     * @return array{version:int, palette:int, body:string, membrane:string, feeding:string, movement:string, sensory:string, defense:string, pattern:string}
     */
    public static function toV2(?array $appearance): array
    {
        $legacy = self::catalog()['legacy'] ?? [];
        $defaults = $legacy['defaults'] ?? [];

        $v2 = [
            'version' => 2,
            'palette' => 1,
            'body' => 'oval',
            'membrane' => $defaults['membrane'] ?? 'smooth',
            'feeding' => $defaults['feeding'] ?? 'filter',
            'movement' => $defaults['movement'] ?? 'cilia',
            'sensory' => $defaults['sensory'] ?? 'eyespot',
            'defense' => $defaults['defense'] ?? 'none',
            'pattern' => 'speckle',
        ];

        if ($appearance === null) {
            return $v2;
        }

        if ((int) ($appearance['version'] ?? 1) >= 2) {
            foreach (self::SLOTS as $slot) {
                $id = $appearance[$slot] ?? null;
                if (is_string($id) && self::part($slot, $id) !== null) {
                    $v2[$slot] = $id;
                }
            }
            $v2['palette'] = ((int) ($appearance['palette'] ?? 1)) % self::paletteCount();

            return $v2;
        }

        // Legacy v1: {palette:int, body:int(0-3), pattern:bool}.
        $bodyByIndex = $legacy['bodyByIndex'] ?? ['oval', 'elongated', 'twin', 'lobed'];
        $v2['palette'] = ((int) ($appearance['palette'] ?? 1)) % self::paletteCount();
        $v2['body'] = $bodyByIndex[((int) ($appearance['body'] ?? 0)) % count($bodyByIndex)];
        $v2['pattern'] = ! array_key_exists('pattern', $appearance) || $appearance['pattern'] ? 'speckle' : 'plain';

        return $v2;
    }
}
