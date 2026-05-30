import { describe, expect, it } from 'vitest';

import {
    buildSmashUpPublicRoomSummary,
    readSmashUpDeckQueryEnabled,
    readSmashUpEnabledExpansions,
    SMASHUP_DECK_QUERY_SETUP_VALUE,
} from '../roomSetup';

describe('SmashUp 房间设置解析', () => {
    it('未传扩展配置时沿用默认扩展集合', () => {
        expect(readSmashUpEnabledExpansions()).toEqual(['titans', 'diy']);
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

    it('公开房间摘要会带出余牌查询 tag，但不泄露无关私有字段', () => {
        expect(buildSmashUpPublicRoomSummary({
            roomName: '不应泄露',
            password: '1234',
            ownerKey: 'guest:owner',
            setupSelections: {
                expansions: ['titans', SMASHUP_DECK_QUERY_SETUP_VALUE],
            },
        })).toEqual({
            enabledExpansions: ['titans', SMASHUP_DECK_QUERY_SETUP_VALUE],
        });
    });
});
