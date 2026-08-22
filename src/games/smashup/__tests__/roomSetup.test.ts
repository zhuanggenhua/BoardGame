import { describe, expect, it } from 'vitest';

import {
    buildSmashUpPublicRoomSummary,
    readSmashUpDeckQueryEnabled,
    readSmashUpEnabledExpansions,
    readSmashUpRuntimeSetupConfig,
    readSmashUpTeamMode,
    readSmashUpVictoryTarget,
    SMASHUP_DECK_QUERY_SETUP_VALUE,
    SMASHUP_VICTORY_20_SETUP_VALUE,
} from '../roomSetup';

describe('SmashUp 房间设置解析', () => {
    it('未传扩展配置时沿用默认扩展集合', () => {
        expect(readSmashUpEnabledExpansions()).toEqual(['titans', 'diy']);
    });

    it('扩展读取会按固定顺序归一化，保持 DIY 在最后', () => {
        expect(readSmashUpEnabledExpansions({
            setupSelections: {
                expansions: ['diy', 'titans', 'deckQuery'],
            },
        })).toEqual(['titans', 'diy']);
    });

    it('优先读取 setupSelections 中的扩展配置', () => {
        expect(readSmashUpEnabledExpansions({
            setupSelections: {
                expansions: ['titans'],
            },
        })).toEqual(['titans']);
    });

    it('余牌查询默认开启，显式关闭时返回 false', () => {
        expect(readSmashUpDeckQueryEnabled()).toBe(true);
        expect(readSmashUpDeckQueryEnabled({
            deckQuery: 'off',
        })).toBe(false);
        expect(readSmashUpDeckQueryEnabled({
            setupSelections: {
                deckQuery: 'on',
            },
        })).toBe(true);
        expect(readSmashUpDeckQueryEnabled({
            setupSelections: {
                expansions: ['titans', 'diy'],
            },
        })).toBe(false);
        expect(readSmashUpDeckQueryEnabled({
            setupSelections: {
                expansions: ['titans', SMASHUP_DECK_QUERY_SETUP_VALUE],
            },
        })).toBe(true);
    });

    it('4 人房间配置会统一桥接为运行时 setup 配置对象', () => {
        expect(readSmashUpRuntimeSetupConfig({
            setupSelections: {
                expansions: ['diy', 'titans', SMASHUP_DECK_QUERY_SETUP_VALUE],
                teamMode: '2v2',
            },
        }, { playerCount: 4 })).toEqual({
            enabledExpansions: ['titans', 'diy'],
            deckQueryEnabled: true,
            victoryTarget: 15,
            teamMode: '2v2',
        });
    });

    it('20 分模式通过扩展选项启用，并不会混入运行时派系扩展集合', () => {
        const setupData = {
            setupSelections: {
                expansions: ['diy', SMASHUP_VICTORY_20_SETUP_VALUE, 'titans', SMASHUP_DECK_QUERY_SETUP_VALUE],
            },
        };

        expect(readSmashUpEnabledExpansions(setupData)).toEqual(['titans', 'diy']);
        expect(readSmashUpVictoryTarget(setupData)).toBe(20);
        expect(readSmashUpRuntimeSetupConfig(setupData, { playerCount: 2 })).toEqual({
            enabledExpansions: ['titans', 'diy'],
            deckQueryEnabled: true,
            victoryTarget: 20,
            teamMode: 'ffa',
        });
    });

    it('非 4 人房间即使传入 2v2 也会回落为 ffa', () => {
        expect(readSmashUpTeamMode({
            setupSelections: {
                teamMode: '2v2',
            },
        }, 2)).toBe('ffa');
    });

    it('公开房间摘要会带出余牌查询 tag，但不泄露无关私有字段', () => {
        expect(buildSmashUpPublicRoomSummary({
            roomName: '不应泄露',
            password: '1234',
            ownerKey: 'guest:owner',
            setupSelections: {
                expansions: ['diy', SMASHUP_VICTORY_20_SETUP_VALUE, 'titans', SMASHUP_DECK_QUERY_SETUP_VALUE],
            },
        })).toEqual({
            enabledExpansions: ['titans', SMASHUP_DECK_QUERY_SETUP_VALUE, SMASHUP_VICTORY_20_SETUP_VALUE, 'diy'],
        });
    });
});
