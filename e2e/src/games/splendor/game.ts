import type { ActionLogEntry, ActionLogSegment, Command, GameEvent, MatchState } from '../../engine/types';
import { createBaseSystems, createGameEngine } from '../../engine';
import { SplendorDomain } from './domain';
import type { SplendorCommand, SplendorCore, SplendorEvent, TokenColor } from './domain';
import { CARD_DEFS_BY_ID, NOBLE_DEFS_BY_ID, getPaymentTokens } from './domain/rules';
import './cardPreview';

const ACTION_ALLOWLIST = [
    'HOST_START_GAME',
    'TAKE_THREE_DIFFERENT_GEMS',
    'TAKE_TWO_SAME_GEMS',
    'RESERVE_OPEN_CARD',
    'RESERVE_DECK_TOP_CARD',
    'BUY_OPEN_CARD',
    'BUY_RESERVED_CARD',
    'DISCARD_GEMS_TO_LIMIT',
    'CHOOSE_NOBLE',
] as const;

const SP_NS = 'game-splendor';

const COLOR_I18N_KEY: Record<TokenColor, string> = {
    white: 'colors.white',
    blue: 'colors.blue',
    green: 'colors.green',
    red: 'colors.red',
    black: 'colors.black',
    gold: 'colors.gold',
};

const i18nSeg = (
    key: string,
    params?: Record<string, string | number>,
): ActionLogSegment => ({
    type: 'i18n' as const,
    ns: SP_NS,
    key,
    ...(params ? { params } : {}),
});

const cardSegment = (cardId: string): ActionLogEntry['segments'][number] => ({
    type: 'card',
    cardId,
    previewText: CARD_DEFS_BY_ID[cardId]?.name ?? cardId,
    previewRef: {
        type: 'renderer',
        rendererId: 'splendor-card-renderer',
        payload: { kind: 'card', cardId },
    },
});

const textSeg = (text: string): ActionLogSegment => ({ type: 'text', text });

const tokenListSegments = (tokens: Partial<Record<TokenColor, number>>): ActionLogSegment[] => {
    const entries = Object.entries(tokens).filter(([, count]) => Number(count) > 0);
    return entries.flatMap(([color, count], index) => {
        const segments: ActionLogSegment[] = [];
        if (index > 0) segments.push(textSeg('、'));
        segments.push(textSeg(`${count}枚`));
        segments.push(i18nSeg(COLOR_I18N_KEY[color as TokenColor]));
        return segments;
    });
};

const cardCostSegments = (cardId: string): ActionLogSegment[] => {
    const card = CARD_DEFS_BY_ID[cardId];
    if (!card) return [];
    return tokenListSegments(card.cost);
};

export function formatSplendorActionEntry({
    command,
    state,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | null {
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const splendorState = state.core as SplendorCore;

    switch (command.type) {
        case 'TAKE_THREE_DIFFERENT_GEMS': {
            return {
                id: `${command.type}-${command.playerId}-${timestamp}`,
                timestamp,
                actorId: command.playerId,
                kind: command.type,
                segments: [
                    i18nSeg('actionLog.takeThree'),
                    ...tokenListSegments(
                        Object.fromEntries(
                            ((command.payload as { colors: string[] }).colors ?? []).map((color) => [color, 1]),
                        ) as Partial<Record<TokenColor, number>>,
                    ),
                ],
            };
        }
        case 'TAKE_TWO_SAME_GEMS': {
            const color = (command.payload as { color: string }).color;
            return {
                id: `${command.type}-${command.playerId}-${timestamp}`,
                timestamp,
                actorId: command.playerId,
                kind: command.type,
                segments: [i18nSeg('actionLog.takeTwoSame'), i18nSeg(COLOR_I18N_KEY[color as TokenColor])],
            };
        }
        case 'RESERVE_OPEN_CARD': {
            const payload = command.payload as { cardId: string };
            return {
                id: `${command.type}-${command.playerId}-${timestamp}`,
                timestamp,
                actorId: command.playerId,
                kind: command.type,
                segments: [
                    i18nSeg('actionLog.reserveOpen'),
                    cardSegment(payload.cardId),
                    textSeg('（'),
                    i18nSeg('actionLog.reserveOpenCost'),
                    ...cardCostSegments(payload.cardId),
                    textSeg('）'),
                ],
            };
        }
        case 'RESERVE_DECK_TOP_CARD': {
            const payload = command.payload as { tier: number };
            return {
                id: `${command.type}-${command.playerId}-${timestamp}`,
                timestamp,
                actorId: command.playerId,
                kind: command.type,
                segments: [i18nSeg('actionLog.reserveDeckTop', { tier: payload.tier })],
            };
        }
        case 'BUY_OPEN_CARD':
        case 'BUY_RESERVED_CARD': {
            const payload = command.payload as { cardId: string };
            const player = splendorState.players[command.playerId];
            const card = CARD_DEFS_BY_ID[payload.cardId];
            const payment = card ? getPaymentTokens(player, card) : {};
            return {
                id: `${command.type}-${command.playerId}-${timestamp}`,
                timestamp,
                actorId: command.playerId,
                kind: command.type,
                segments: [
                    i18nSeg('actionLog.buyCard'),
                    ...(Object.keys(payment).length > 0
                        ? tokenListSegments(payment)
                        : [i18nSeg('actionLog.freePurchase')]),
                    textSeg('，'),
                    cardSegment(payload.cardId),
                ],
            };
        }
        case 'DISCARD_GEMS_TO_LIMIT': {
            const payload = command.payload as { color: string };
            return {
                id: `${command.type}-${command.playerId}-${timestamp}`,
                timestamp,
                actorId: command.playerId,
                kind: command.type,
                segments: [i18nSeg('actionLog.discardGem'), i18nSeg(COLOR_I18N_KEY[payload.color as TokenColor])],
            };
        }
        case 'CHOOSE_NOBLE': {
            const payload = command.payload as { nobleId: string };
            const noble = NOBLE_DEFS_BY_ID[payload.nobleId];
            return {
                id: `${command.type}-${command.playerId}-${timestamp}`,
                timestamp,
                actorId: command.playerId,
                kind: command.type,
                segments: [i18nSeg('actionLog.chooseNoble', { noble: noble?.name ?? payload.nobleId })],
            };
        }
        case 'HOST_START_GAME':
            return null;
        default:
            return null;
    }
}

export const engineConfig = createGameEngine<SplendorCore, SplendorCommand, SplendorEvent>({
    domain: SplendorDomain,
    systems: createBaseSystems<SplendorCore>({
        actionLog: {
            commandAllowlist: ACTION_ALLOWLIST,
            formatEntry: formatSplendorActionEntry,
        },
    }),
    minPlayers: 2,
    maxPlayers: 4,
    commandTypes: [
        'HOST_START_GAME',
        'TAKE_THREE_DIFFERENT_GEMS',
        'TAKE_TWO_SAME_GEMS',
        'RESERVE_OPEN_CARD',
        'RESERVE_DECK_TOP_CARD',
        'BUY_OPEN_CARD',
        'BUY_RESERVED_CARD',
        'DISCARD_GEMS_TO_LIMIT',
        'CHOOSE_NOBLE',
    ],
});

export default engineConfig;
