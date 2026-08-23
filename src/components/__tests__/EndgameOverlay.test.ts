import { describe, expect, it } from 'vitest';
import {
    getEndgameOverlayScrollClassNames,
    shouldShowVictoryParticles,
    type GameOverResult,
} from '../game/framework/widgets/EndgameOverlay';

describe('getEndgameOverlayScrollClassNames', () => {
    it('默认不展示结束层滚动条', () => {
        expect(getEndgameOverlayScrollClassNames()).toEqual({
            overlay: 'overflow-hidden overscroll-contain',
            content: 'overflow-hidden overscroll-contain',
        });
    });

    it('content 模式只允许内容区纵向滚动，并关闭横向滚动', () => {
        expect(getEndgameOverlayScrollClassNames('content')).toEqual({
            overlay: 'overflow-hidden overscroll-contain',
            content: 'overflow-y-auto overflow-x-hidden overscroll-contain',
        });
    });

    it('overlay 模式保留整层滚动兜底，但仍关闭横向滚动', () => {
        expect(getEndgameOverlayScrollClassNames('overlay')).toEqual({
            overlay: 'overflow-y-auto overflow-x-hidden overscroll-contain',
            content: 'overflow-y-auto overflow-x-hidden overscroll-contain',
        });
    });
});

describe('shouldShowVictoryParticles', () => {
    it('无结果或平局不触发', () => {
        expect(shouldShowVictoryParticles(undefined, '0')).toBe(false);
        expect(shouldShowVictoryParticles({ draw: true }, '0')).toBe(false);
    });

    it('缺少赢家或玩家信息不触发', () => {
        const result: GameOverResult = { winner: undefined };
        expect(shouldShowVictoryParticles(result, '0')).toBe(false);
        expect(shouldShowVictoryParticles({ winner: '0' }, null)).toBe(false);
        expect(shouldShowVictoryParticles({ winner: '0' }, undefined)).toBe(false);
    });

    it('本地模式只要有赢家即可触发', () => {
        expect(shouldShowVictoryParticles({ winner: '0' }, null, { isLocalMode: true })).toBe(true);
        expect(shouldShowVictoryParticles({ winner: '1' }, undefined, { isLocalMode: true })).toBe(true);
    });

    it('观战模式不触发', () => {
        expect(shouldShowVictoryParticles({ winner: '0' }, '0', { isSpectator: true })).toBe(false);
        expect(shouldShowVictoryParticles({ winner: '0' }, null, { isLocalMode: true, isSpectator: true })).toBe(false);
    });

    it('赢家与玩家一致时触发', () => {
        expect(shouldShowVictoryParticles({ winner: '0' }, '0')).toBe(true);
        expect(shouldShowVictoryParticles({ winner: 1 as unknown as string }, '1')).toBe(true);
    });

    it('赢家与玩家不一致不触发', () => {
        expect(shouldShowVictoryParticles({ winner: '1' }, '0')).toBe(false);
    });

    it('多人 winners 数组包含当前玩家时也触发', () => {
        expect(shouldShowVictoryParticles({ winner: '0', winners: ['0', '2'] }, '2')).toBe(true);
        expect(shouldShowVictoryParticles({ winner: '0', winners: ['0', '2'] }, '1')).toBe(false);
    });
});
