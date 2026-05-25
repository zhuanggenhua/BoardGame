import { describe, expect, it } from 'vitest';
import type { MatchChatMessage } from '../../services/matchSocket';
import { UI_Z_INDEX } from '../../core';
import type { MatchState } from '../../engine/types';
import { GAME_HUD_FAB_Z_INDEX, getLatestIncomingMessage, isSelfChatMessage, shouldSuppressSmashUpHudFab, trimChatMessages } from '../game/framework/widgets/GameHUD';
import { resolveFabSatellitesToRender, shouldTrackFabButtonRect } from '../system/FabMenu';
import { resolveExpandedFabLayout } from '../system/fabLayout';
import { resolveFabStoredPosition, serializeFabPositionPercent } from '../system/fabPosition';

const buildMessage = (override: Partial<MatchChatMessage> = {}): MatchChatMessage => ({
    id: 'msg-1',
    matchId: 'room-1',
    senderId: '1',
    senderName: '玩家1',
    text: '你好',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...override,
});

function buildSmashUpState(overrides?: Partial<MatchState<any>>): MatchState<any> {
    return {
        core: {
            players: {
                '0': { id: '0', hand: [], deck: [], discard: [], vp: 0, factions: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
                '1': { id: '1', hand: [], deck: [], discard: [], vp: 0, factions: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [],
            baseDeck: [],
            baseDiscard: [],
            nextUid: 1,
            turnNumber: 1,
        },
        sys: {
            phase: 'scoreBases',
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        },
        ...(overrides ?? {}),
    } as MatchState<any>;
}

describe('GameHUD chat preview helpers', () => {
    it('isSelfChatMessage 使用 senderId 判断自身消息', () => {
        const message = buildMessage({ senderId: '2', senderName: '玩家2' });
        expect(isSelfChatMessage(message, '2', '玩家1')).toBe(true);
        expect(isSelfChatMessage(message, '1', '玩家1')).toBe(false);
    });

    it('isSelfChatMessage 使用 senderName 判断自身消息', () => {
        const message = buildMessage({ senderId: undefined, senderName: '玩家A' });
        expect(isSelfChatMessage(message, '1', '玩家A')).toBe(true);
        expect(isSelfChatMessage(message, '1', '玩家B')).toBe(false);
    });

    it('getLatestIncomingMessage 返回最新的非自身消息', () => {
        const messages = [
            buildMessage({ id: 'msg-1', senderId: '1', senderName: '玩家1', text: '我发的' }),
            buildMessage({ id: 'msg-2', senderId: '2', senderName: '玩家2', text: '对方1' }),
            buildMessage({ id: 'msg-3', senderId: '1', senderName: '玩家1', text: '我发的2' }),
            buildMessage({ id: 'msg-4', senderId: '3', senderName: '玩家3', text: '对方2' }),
        ];
        const latest = getLatestIncomingMessage(messages, '1', '玩家1');
        expect(latest?.id).toBe('msg-4');
    });

    it('getLatestIncomingMessage 无非自身消息时返回 null', () => {
        const messages = [
            buildMessage({ id: 'msg-1', senderId: '1', senderName: '玩家1', text: '我发的' }),
            buildMessage({ id: 'msg-2', senderId: '1', senderName: '玩家1', text: '我发的2' }),
        ];
        const latest = getLatestIncomingMessage(messages, '1', '玩家1');
        expect(latest).toBeNull();
    });

    it('trimChatMessages 超过上限时保留最新消息', () => {
        const messages = [
            buildMessage({ id: 'msg-1' }),
            buildMessage({ id: 'msg-2' }),
            buildMessage({ id: 'msg-3' }),
            buildMessage({ id: 'msg-4' }),
        ];
        const trimmed = trimChatMessages(messages, 3);
        expect(trimmed.map((msg) => msg.id)).toEqual(['msg-2', 'msg-3', 'msg-4']);
    });

    it('trimChatMessages 未超过上限时保持原数组', () => {
        const messages = [
            buildMessage({ id: 'msg-1' }),
            buildMessage({ id: 'msg-2' }),
        ];
        const trimmed = trimChatMessages(messages, 3);
        expect(trimmed).toEqual(messages);
    });
});

describe('FabMenu helpers', () => {
    it('游戏内应急悬浮球层级必须高于所有常规 modal 内容层', () => {
        expect(GAME_HUD_FAB_Z_INDEX).toBe(UI_Z_INDEX.emergencyHud);
        expect(GAME_HUD_FAB_Z_INDEX).toBeGreaterThan(UI_Z_INDEX.modalContent);
        expect(GAME_HUD_FAB_Z_INDEX).toBeGreaterThan(UI_Z_INDEX.tutorial);
    });

    it('操作日志卡牌预览层级必须高于悬浮球，且不改变悬浮球层级', () => {
        expect(GAME_HUD_FAB_Z_INDEX).toBe(UI_Z_INDEX.emergencyHud);
        expect(UI_Z_INDEX.cardPreviewTooltip).toBeGreaterThan(GAME_HUD_FAB_Z_INDEX);
    });

    it('卫星按钮顺序始终按业务定义靠近主球的一端优先渲染', () => {
        expect(resolveFabSatellitesToRender(['feedback', 'fullscreen', 'action-log', 'settings'])).toEqual([
            'settings',
            'action-log',
            'fullscreen',
            'feedback',
        ]);
    });

    it('预览、tooltip 和激活中的内容面板都需要持续追踪按钮锚点位置', () => {
        expect(shouldTrackFabButtonRect({
            showTooltip: false,
            showPreview: false,
            isActive: true,
            hasContent: true,
        })).toBe(true);
        expect(shouldTrackFabButtonRect({
            showTooltip: false,
            showPreview: false,
            isActive: true,
            hasContent: false,
        })).toBe(false);
        expect(shouldTrackFabButtonRect({
            showTooltip: true,
            showPreview: false,
            isActive: false,
            hasContent: false,
        })).toBe(true);
    });

    it('恢复保存的越界百分比位置时会收回到视口内并要求回写存储', () => {
        const resolved = resolveFabStoredPosition({
            savedPosition: JSON.stringify({ leftPercent: 1.4, topPercent: -0.25 }),
            legacyOffset: null,
            viewportWidth: 100,
            viewportHeight: 100,
            basePosition: { left: 24, top: 24 },
            normalizePosition: (target) => target,
            clampPosition: (target) => ({
                left: Math.min(Math.max(target.left, 12), 60),
                top: Math.min(Math.max(target.top, 8), 72),
            }),
            resolvedButtonSize: 48,
        });

        expect(resolved.position).toEqual({ left: 60, top: 8 });
        expect(resolved.percent).toEqual({ leftPercent: 0.6, topPercent: 0.08 });
        expect(resolved.shouldPersist).toBe(true);
        expect(resolved.clearLegacyOffset).toBe(false);
    });

    it('旧版 offset 恢复时也会收回到视口内并清理旧存储键', () => {
        const resolved = resolveFabStoredPosition({
            savedPosition: null,
            legacyOffset: JSON.stringify({ x: 120, y: -80 }),
            viewportWidth: 200,
            viewportHeight: 120,
            basePosition: { left: 40, top: 32 },
            normalizePosition: (target) => target,
            clampPosition: (target) => ({
                left: Math.min(Math.max(target.left, 16), 120),
                top: Math.min(Math.max(target.top, 10), 84),
            }),
            resolvedButtonSize: 48,
        });

        expect(resolved.position).toEqual({ left: 120, top: 10 });
        expect(resolved.percent).toEqual(serializeFabPositionPercent({ left: 120, top: 10 }, 200, 120));
        expect(resolved.shouldPersist).toBe(true);
        expect(resolved.clearLegacyOffset).toBe(true);
    });

    it('展开态靠近底部时会整体上移，但保持主球与最近卫星按钮的固定间距', () => {
        const layout = resolveExpandedFabLayout({
            position: { left: 120, top: 130 },
            alignment: { v: 'bottom', h: 'right' },
            satelliteCount: 2,
            buttonSize: 44,
            buttonGap: 8,
            viewportHeight: 160,
            safeAreaTop: 0,
            safeAreaBottom: 0,
            getHorizontalAlignment: () => 'left',
        });

        expect(layout.position).toEqual({ left: 120, top: 130 });
        expect(layout.listOffset).toEqual({ x: 0, y: 0 });
        expect(layout.alignment).toEqual({ v: 'bottom', h: 'left' });
    });

    it('展开态靠近顶部时会整体下移，而不是只把卫星按钮单独推开', () => {
        const layout = resolveExpandedFabLayout({
            position: { left: 120, top: 6 },
            alignment: { v: 'top', h: 'left' },
            satelliteCount: 2,
            buttonSize: 44,
            buttonGap: 8,
            viewportHeight: 180,
            safeAreaTop: 12,
            safeAreaBottom: 6,
            getHorizontalAlignment: () => 'right',
        });

        expect(layout.position).toEqual({ left: 120, top: 6 });
        expect(layout.listOffset).toEqual({ x: 0, y: -32 });
        expect(layout.alignment).toEqual({ v: 'top', h: 'right' });
    });

    it('SmashUp owner prompt 激活时应隐藏全局 FAB，避免出现第二视觉焦点', () => {
        const state = buildSmashUpState({
            core: {
                ...buildSmashUpState().core,
                currentPlayer: '0',
            },
            sys: {
                phase: 'playCards',
                interaction: {
                    current: {
                        id: 'prompt-1',
                        playerId: '0',
                        data: {
                            sourceId: 'test_prompt',
                            targetType: 'base',
                            options: [{ id: 'a', label: 'A', value: { baseIndex: 0 } }],
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: undefined },
            },
        });

        expect(shouldSuppressSmashUpHudFab({
            gameId: 'smashup',
            mode: 'online',
            state,
            playerId: '0',
        })).toBe(true);
    });

    it('SmashUp 非响应者 waiting shell 期间也应隐藏全局 FAB', () => {
        const state = buildSmashUpState({
            sys: {
                phase: 'scoreBases',
                interaction: { current: undefined, queue: [] },
                responseWindow: {
                    current: {
                        id: 'rw-1',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['1', '0'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
                resolution: {
                    activeFrameId: 'frame-1',
                    frames: [{
                        id: 'frame-1',
                        kind: 'smashup:reaction:score-after',
                        ownerGame: 'smashup',
                        ownerSystem: 'smashup-reaction',
                        ownerToken: 'smashup:reaction:frame-1',
                        ordering: 'responder-round',
                        status: 'running',
                        step: 'optional',
                        phase: 'scoreBases',
                        phaseGate: 'block-advance-when-blocked',
                        metadata: {
                            smashupReactionSession: {
                                frameId: 'frame-1',
                                frameKind: 'score-after',
                                phase: 'optional',
                                activePlayerId: '1',
                                currentPlayerId: '1',
                                consecutivePasses: 0,
                                responseWindowType: 'afterScoring',
                            },
                        },
                    }],
                },
            },
        });

        expect(shouldSuppressSmashUpHudFab({
            gameId: 'smashup',
            mode: 'online',
            state,
            playerId: '0',
        })).toBe(true);
    });

    it('SmashUp 本地单屏 owner prompt 期间即使未显式传 myPlayerId 也应隐藏全局 FAB', () => {
        const state = buildSmashUpState({
            core: {
                ...buildSmashUpState().core,
                currentPlayer: '0',
            },
            sys: {
                phase: 'playCards',
                interaction: {
                    current: {
                        id: 'prompt-local',
                        playerId: '0',
                        data: {
                            sourceId: 'local_prompt',
                            targetType: 'hand',
                            options: [{ id: 'card-a', label: 'A', value: { cardUid: 'card-a' } }],
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: undefined },
            },
        });

        expect(shouldSuppressSmashUpHudFab({
            gameId: 'smashup',
            mode: 'local',
            state,
            playerId: null,
        })).toBe(true);
    });

    it('非 SmashUp 页面不应误隐藏全局 FAB', () => {
        expect(shouldSuppressSmashUpHudFab({
            gameId: 'splendor',
            mode: 'online',
            state: buildSmashUpState(),
            playerId: '0',
        })).toBe(false);
    });
});
