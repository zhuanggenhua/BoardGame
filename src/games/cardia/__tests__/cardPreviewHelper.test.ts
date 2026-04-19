/**
 * 卡牌预览辅助函数测试
 */

import { describe, it, expect } from 'vitest';
import { getCardiaCardPreviewMeta, getCardiaCardPreviewRef } from '../ui/cardPreviewHelper';

describe('cardPreviewHelper', () => {
    describe('getCardiaCardPreviewMeta', () => {
        it('应该从 defId 获取卡牌预览元数据', () => {
            const meta = getCardiaCardPreviewMeta('deck_i_card_09');
            expect(meta).not.toBeNull();
            expect(meta?.name).toBe('cards.deck_i_card_09.name');
            expect(meta?.previewRef).toMatchObject({
                type: 'image',
                aspectRatio: 106 / 160,
            });
        });

        it('应该从 UID 提取 defId 并获取卡牌预览元数据', () => {
            const meta = getCardiaCardPreviewMeta('deck_i_card_09_1775881348955_eiii1tdrz');
            expect(meta).not.toBeNull();
            expect(meta?.name).toBe('cards.deck_i_card_09.name');
            expect(meta?.previewRef).toMatchObject({
                type: 'image',
                aspectRatio: 106 / 160,
            });
        });

        it('应该对无效的 defId 返回 null', () => {
            const meta = getCardiaCardPreviewMeta('invalid_card_id');
            expect(meta).toBeNull();
        });

        it('应该对无效的 UID 返回 null', () => {
            const meta = getCardiaCardPreviewMeta('invalid_card_id_123_abc');
            expect(meta).toBeNull();
        });
    });

    describe('getCardiaCardPreviewRef', () => {
        it('应该从 defId 获取卡牌预览引用', () => {
            const ref = getCardiaCardPreviewRef('deck_i_card_01');
            expect(ref).not.toBeNull();
            expect(ref).toMatchObject({
                type: 'image',
                aspectRatio: 106 / 160,
            });
        });

        it('应该从 UID 提取 defId 并获取卡牌预览引用', () => {
            const ref = getCardiaCardPreviewRef('deck_i_card_01_1234567890_xyz');
            expect(ref).not.toBeNull();
            expect(ref).toMatchObject({
                type: 'image',
                aspectRatio: 106 / 160,
            });
        });

        it('应该对无效的 ID 返回 null', () => {
            const ref = getCardiaCardPreviewRef('invalid_card');
            expect(ref).toBeNull();
        });
    });
});
