<?php

namespace App\Domain\Campaigns;

/**
 * Helpers for the CampaignState JSON blob stored in campaign_saves.state.
 * The authoritative shape is documented in docs/SAVE_FORMAT.md. This class
 * builds a fresh state and centralises the current schema version so
 * migrations have a single source of truth.
 */
class CampaignState
{
    /** Bump when the stored state shape changes; add a migrator in SaveMigrator. */
    public const SCHEMA_VERSION = 2;

    /**
     * Versions the save endpoint will accept. Keeping the previous one means a
     * browser still running an older JS bundle can keep autosaving through a
     * deploy instead of 422-ing on every write; it is migrated on read.
     *
     * @var list<int>
     */
    public const ACCEPTED_SCHEMA_VERSIONS = [1, 2];

    /**
     * Build the initial state for a brand-new campaign.
     *
     * @return array<string, mixed>
     */
    public static function initial(string $seed, string $species, Stage $stage = Stage::Cell): array
    {
        return [
            'saveSchemaVersion' => self::SCHEMA_VERSION,
            'generation' => [
                'seed' => $seed,
                'generatorVersion' => '0.1.0',
                'contentVersion' => '0.1.0',
            ],
            'progress' => [
                'currentStage' => $stage->value,
                'completed' => false,
                'endingId' => null,
            ],
            'species' => [
                'name' => $species,
            ],
            'traits' => [
                'inherited' => [],
                'active' => [],
            ],
            'history' => [],
            'resources' => [],
            /**
             * Final resources of each completed stage, keyed by stage id. Stage
             * resources are reset on advance, so without this the whole of
             * stages 3–6 leaves no trace and cannot inform the ending.
             */
            'chronicle' => [],
            'stageState' => new \stdClass(),
        ];
    }
}
