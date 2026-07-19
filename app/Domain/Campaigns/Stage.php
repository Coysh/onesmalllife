<?php

namespace App\Domain\Campaigns;

/**
 * The six connected stages of a lineage (brief §13). The ordering here is the
 * canonical progression; transitions may only advance to the next stage.
 */
enum Stage: string
{
    case Cell = 'cell';
    case Creature = 'creature';
    case Tribe = 'tribe';
    case Civilisation = 'civilisation';
    case Planetary = 'planetary';
    case Space = 'space';

    public function label(): string
    {
        return match ($this) {
            self::Cell => 'Cell',
            self::Creature => 'Creature',
            self::Tribe => 'Tribe',
            self::Civilisation => 'Civilisation',
            self::Planetary => 'Planetary',
            self::Space => 'Space',
        };
    }

    /** The stage that follows this one, or null at the end of the journey. */
    public function next(): ?self
    {
        $order = self::cases();
        foreach ($order as $i => $stage) {
            if ($stage === $this) {
                return $order[$i + 1] ?? null;
            }
        }

        return null;
    }

    /** May a campaign move from this stage to $target? Only same or next stage. */
    public function canTransitionTo(self $target): bool
    {
        return $target === $this || $target === $this->next();
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
