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

    it('余牌查询默认关闭，显式开启后返回 true', () => {
        expect(readSmashUpDeckQueryEnabled()).toBe(false);
        expect(readSmashUpDeckQueryEnabled({
            setupSelections: {
                deckQuery: 'on',
            },
        })).toBe(true);
        expect(readSmashUpDeckQueryEnabled({
            setupSelections: {
                expansions: ['titans', SMASHUP_DECK_QUERY_SETUP_VALUE],
            },
        })).toBe(true);
    });

    it('公开房间摘要只带真正的扩展信息，不带余牌查询', () => {
        expect(buildSmashUpPublicRoomSummary({
            roomName: '不应泄露',
            password: '1234',
            ownerKey: 'guest:owner',
            setupSelections: {
                expansions: ['titans', SMASHUP_DECK_QUERY_SETUP_VALUE],
            },
        })).toEqual({
            enabledExpansions: ['titans'],
        });
    });
});
