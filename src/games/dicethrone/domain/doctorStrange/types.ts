import type { GameEvent } from '../../../../engine/types';
import type { AbilityCard } from '../core-types';

export type SpellZone = 'hand' | 'deck' | 'discard' | 'preparedSpells';

export type DoctorStrangeEvent =
    | GameEvent<'STRANGE_OPERATION_REQUESTED', { playerId: string; targetId?: string; operation: string; sourceId: string; values?: number[] }>
    | GameEvent<'STRANGE_OPERATION_RESOLVED', { playerId: string; sourceId: string }>
    | GameEvent<'STRANGE_CARD_MOVED', { playerId: string; cardId: string; from: SpellZone; to: SpellZone; position?: 'top' | 'bottom'; passive?: boolean }>
    | GameEvent<'STRANGE_DECK_ORDERED', { playerId: string; cardIds: string[] }>
    | GameEvent<'STRANGE_BANDS_ACTIVATED', { playerId: string }>;

export interface SpellCandidate {
    labelKey: string;
    labelParams?: Record<string, string | number>;
    previewRef?: AbilityCard['previewRef'];
    targetPlayerId?: string;
    choiceKind?: 'card' | 'player' | 'status' | 'skip';
    cardId?: string;
    cardSourceZone?: SpellZone;
    statusId?: string;
    tasks: SpellTask[];
}

/** 仅存在于正式ResolutionFrame中的法术程序，不持有卡牌/骰子的第二份状态。 */
export type SpellTask =
    | { kind: 'operation'; operation: string; values?: number[] }
    | { kind: 'prepare-choice'; zone: SpellZone; remaining: number; eligible?: string[]; optional?: boolean }
    | { kind: 'cast-choice'; zone: SpellZone; remaining: number; used?: string[]; exclude?: string[] }
    | { kind: 'prepare' | 'cast'; cardId: string; zone: SpellZone; passive?: boolean }
    | { kind: 'dispose'; cardId: string; destination: 'hand' | 'discard' }
    | { kind: 'effect'; effect: 'damage' | 'heal' | 'cp' | 'bonus' | 'prevent' | 'premonition' | 'deja-vu' | 'crimson-bands' | 'unblockable'; amount: number; targetId?: string; sourceId?: string }
    | { kind: 'target'; effect: 'damage' | 'heal' | 'deja-vu' | 'crimson-bands' | 'cp'; amount: number; opponents?: boolean; sourceId?: string }
    | { kind: 'remove-status' }
    | { kind: 'remove-status-target'; targetId: string; statusId: string; token: boolean }
    | { kind: 'draw'; amount: number; returnOne?: boolean }
    | { kind: 'income' }
    | { kind: 'consume'; tokenId: string; amount: number }
    | { kind: 'income-return'; cardIds: string[] }
    | { kind: 'return-position'; cardId: string }
    | { kind: 'return'; cardId: string; position: 'top' | 'bottom' }
    | { kind: 'ultimate' }
    | { kind: 'reorder'; cardIds: string[]; ordered?: string[] }
    | { kind: 'roll'; operation: 'astral' | 'tendrils' | 'shield' };

export interface SpellProgram {
    playerId: string;
    targetId: string;
    sourceId: string;
    parentResponseWindowId?: string;
    parentDamageId?: string;
    tasks: SpellTask[];
    choices?: SpellCandidate[];
}

export const isSpell = (card: AbilityCard): boolean => card.type === 'spell' && card.spell !== undefined;
