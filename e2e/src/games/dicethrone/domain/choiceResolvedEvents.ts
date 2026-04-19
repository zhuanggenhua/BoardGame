import type { RandomFn } from '../../../engine/types';
import type { DiceThroneCore, DiceThroneEvent } from './types';

export interface ChoiceResolvedEventContext {
    state: DiceThroneCore;
    playerId: string;
    customId: string;
    sourceAbilityId?: string;
    value?: number;
    timestamp: number;
    random?: RandomFn;
}

export type ChoiceResolvedEventHandler = (context: ChoiceResolvedEventContext) => DiceThroneEvent[];

const choiceResolvedEventHandlers = new Map<string, ChoiceResolvedEventHandler>();

export function registerChoiceResolvedEventHandler(customId: string, handler: ChoiceResolvedEventHandler): void {
    choiceResolvedEventHandlers.set(customId, handler);
}

export function getChoiceResolvedEventHandler(customId: string): ChoiceResolvedEventHandler | undefined {
    return choiceResolvedEventHandlers.get(customId);
}
