import { describe, expect, it } from 'vitest';

import type { GameEngineConfig } from '../../engine/transport/server';
import type { MatchState } from '../../engine/types';
import {
    resolveManualSetupSelectionTakeoverPlayerId,
    resolveManualSetupAttemptReleaseSource,
    resolveManualSetupSelectionActionKindFromCommand,
    resolveManualSetupSelectionId,
    shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt,
    shouldReleaseManualSetupAttemptFromSharedState,
} from '../matchManualSetup';

describe('matchManualSetup', () => {
    it('自定义 action kind 未提供 override 时，不应被 shared await/release fallback 误吸收', () => {
        const sharedState = {
            core: {
                draftSetupSelections: {
                    '0': 'cleric',
                    '1': 'ranger',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;

        expect(shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt('setup-select-draft')).toBe(false);
        expect(shouldReleaseManualSetupAttemptFromSharedState({
            sharedState,
            playerId: '1',
            actionKind: 'setup-select-draft',
            selectionId: 'ranger',
        })).toBe(false);
        expect(resolveManualSetupAttemptReleaseSource({
            sharedState,
            seatState: sharedState,
            playerId: '1',
            actionKind: 'setup-select-draft',
            selectionId: 'ranger',
        })).toBeNull();
    });

    it('通用 fallback 只按前置选择 payload 解析 action kind，不识别具体游戏命令名', () => {
        expect(resolveManualSetupSelectionActionKindFromCommand({
            type: 'game:select_faction',
            payload: { factionId: 'ranger' },
        })).toBe('setup-select-faction');

        expect(resolveManualSetupSelectionActionKindFromCommand({
            type: 'game:select_draft',
            payload: { draftId: 'ranger' },
        })).toBeNull();
    });

    it('自定义 action kind 提供 override 时，应可等待 shared 确认并按 adapter 释放 attempt', () => {
        const manualSetupEngineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'> = {
            gameId: 'custom-manual-setup-await-game',
            onlineAiRecovery: {
                resolveManualSetupSelectionId: ({ actionKind, payload }) => (
                    actionKind === 'setup-select-draft'
                    && typeof (payload as { draftId?: unknown } | undefined)?.draftId === 'string'
                        ? (payload as { draftId: string }).draftId
                        : undefined
                ),
                shouldAwaitManualSetupSharedConfirmation: ({ actionKind, selectionId }) => (
                    actionKind === 'setup-select-draft' && selectionId === 'ranger'
                        ? true
                        : undefined
                ),
                shouldReleaseManualSetupAttemptFromSharedState: ({
                    sharedState,
                    playerId,
                    actionKind,
                    selectionId,
                }) => {
                    if (actionKind !== 'setup-select-draft') {
                        return undefined;
                    }
                    const selectedByPlayer = (sharedState.core as {
                        draftSetupSelections?: Record<string, unknown>;
                    } | undefined)?.draftSetupSelections;
                    if (!selectedByPlayer || typeof selectedByPlayer !== 'object') {
                        return undefined;
                    }
                    return selectedByPlayer[playerId] === selectionId;
                },
            },
        };
        const sharedState = {
            core: {
                draftSetupSelections: {
                    '0': 'cleric',
                    '1': 'ranger',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;
        const pendingSeatState = {
            core: {
                draftSetupSelections: {
                    '0': 'cleric',
                    '1': 'unselected',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;

        expect(resolveManualSetupSelectionId({
            actionKind: 'setup-select-draft',
            payload: { draftId: 'ranger' },
            engineConfig: manualSetupEngineConfig,
        })).toBe('ranger');
        expect(shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt('setup-select-draft', {
            playerId: '1',
            selectionId: 'ranger',
            engineConfig: manualSetupEngineConfig,
        })).toBe(true);
        expect(resolveManualSetupAttemptReleaseSource({
            sharedState,
            seatState: pendingSeatState,
            playerId: '1',
            actionKind: 'setup-select-draft',
            selectionId: 'ranger',
            engineConfig: manualSetupEngineConfig,
        })).toBe('shared');
    });

    it('manualSetupSelection 别名也应触发 shared manual setup takeover', () => {
        const sharedState = {
            core: {
                hostStarted: false,
                selectedCharacters: {
                    '0': 'monk',
                    '1': 'unselected',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;

        expect(resolveManualSetupSelectionTakeoverPlayerId({
            sharedState,
            currentPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
            hasManualDispatch: true,
        })).toBe('1');
    });
});
