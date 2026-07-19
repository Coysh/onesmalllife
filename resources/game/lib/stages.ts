/**
 * Canonical stage order (mirrors app/Domain/Campaigns/Stage.php on the server).
 * Transitions may only advance to the next stage.
 */
export const STAGE_ORDER = ['cell', 'creature', 'tribe', 'civilisation', 'planetary', 'space'] as const;

export type StageId = (typeof STAGE_ORDER)[number];

export function nextStageId(id: string): string | null {
    const i = STAGE_ORDER.indexOf(id as StageId);
    return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}

export function isStrategicStage(id: string): boolean {
    return ['tribe', 'civilisation', 'planetary', 'space'].includes(id);
}
