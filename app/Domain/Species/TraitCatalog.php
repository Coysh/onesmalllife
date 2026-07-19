<?php

namespace App\Domain\Species;

/**
 * Reads the shared trait catalogue (resources/game/data/traits.json) — the same
 * file the in-game TraitEngine (TypeScript) reads — so the server can name and
 * describe the adaptations a lineage has collected without duplicating the list.
 * Used by the account Chronicle to render the codex of adaptations.
 */
class TraitCatalog
{
    /** @var array<string,array<string,mixed>>|null keyed by trait id */
    private static ?array $byId = null;

    /** @return array<string,array<string,mixed>> */
    public static function all(): array
    {
        if (self::$byId !== null) {
            return self::$byId;
        }

        $path = resource_path('game/data/traits.json');
        $data = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
        $traits = is_array($data['traits'] ?? null) ? $data['traits'] : [];

        $byId = [];
        foreach ($traits as $trait) {
            if (is_string($trait['id'] ?? null)) {
                $byId[$trait['id']] = $trait;
            }
        }

        return self::$byId = $byId;
    }

    /** One trait definition, or null. @return array<string,mixed>|null */
    public static function get(string $id): ?array
    {
        return self::all()[$id] ?? null;
    }

    /** Human-readable name, falling back to the raw id if unknown. */
    public static function name(string $id): string
    {
        return (string) (self::get($id)['name'] ?? $id);
    }

    /** Total adaptations that can ever be inherited (the codex denominator). */
    public static function inheritableCount(): int
    {
        return count(array_filter(self::all(), fn (array $t): bool => (bool) ($t['inheritable'] ?? false)));
    }
}
