<?php

namespace App\Domain\Saves;

use App\Domain\Campaigns\CampaignState;

/**
 * Upgrades a stored CampaignState blob to the current schema version (brief §22).
 * Migrators are pure functions keyed by target version — migrations()[$n] takes
 * a v($n-1) state and returns a v$n state. On load, older saves are migrated in
 * sequence up to CampaignState::SCHEMA_VERSION.
 */
class SaveMigrator
{
    /**
     * @return array<int, callable(array<string,mixed>): array<string,mixed>>
     */
    private static function migrations(): array
    {
        return [
            // v0 (pre-versioned) → v1: guarantee the core keys exist.
            1 => fn (array $s): array => array_replace([
                'traits' => ['active' => [], 'inherited' => []],
                'progress' => ['currentStage' => 'cell', 'completed' => false, 'endingId' => null],
                'resources' => [],
            ], $s),
        ];
    }

    /**
     * @param  array<string,mixed>  $state
     * @return array<string,mixed>
     */
    public static function migrate(array $state): array
    {
        $version = (int) ($state['saveSchemaVersion'] ?? 0);
        $target = CampaignState::SCHEMA_VERSION;

        for ($v = $version + 1; $v <= $target; $v++) {
            $migrator = self::migrations()[$v] ?? null;
            if ($migrator !== null) {
                $state = $migrator($state);
            }
            $state['saveSchemaVersion'] = $v;
        }

        // Already-current (or newer) saves are left as-is at the target version.
        $state['saveSchemaVersion'] = max($target, (int) ($state['saveSchemaVersion'] ?? $target));

        return $state;
    }
}
