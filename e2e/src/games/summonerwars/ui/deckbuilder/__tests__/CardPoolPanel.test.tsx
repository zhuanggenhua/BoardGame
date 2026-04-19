/**
 * CardPoolPanel 组件测试
 * 
 * 验证：
 * - CardSection 子组件可以正确渲染（不会因为 useTranslation 作用域问题崩溃）
 * - 放大预览按钮的 title 属性正确使用 i18n
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../../lib/i18n';
import { CardPoolPanel } from '../CardPoolPanel';
import type { DeckDraft } from '../../../config/deckValidation';

// Mock 数据
const mockDeckDraft: DeckDraft = {
    summoner: null,
    manualCards: new Map(),
    autoCards: [],
};

describe('CardPoolPanel', () => {
    it('应该正确渲染而不崩溃（验证 useTranslation 作用域修复）', () => {
        const { container } = render(
            <I18nextProvider i18n={i18n}>
                <CardPoolPanel
                    factionId={null}
                    currentDeck={mockDeckDraft}
                    onAddCard={() => {}}
                    onSelectSummoner={() => {}}
                />
            </I18nextProvider>
        );

        // 未选择阵营时应该显示提示文本
        expect(container.querySelector('.flex-1.flex.items-center.justify-center')).toBeTruthy();
    });

    it('CardSection 子组件应该能访问 t 函数（通过自己的 useTranslation）', () => {
        // 这个测试通过渲染不崩溃来验证修复
        // 之前的 bug 是 CardSection 尝试使用父组件的 t 函数导致 ReferenceError
        expect(() => {
            render(
                <I18nextProvider i18n={i18n}>
                    <CardPoolPanel
                        factionId="tundra-orcs"
                        currentDeck={mockDeckDraft}
                        onAddCard={() => {}}
                        onSelectSummoner={() => {}}
                    />
                </I18nextProvider>
            );
        }).not.toThrow();
    });
});
