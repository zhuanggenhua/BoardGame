import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SelectableGameObject } from '../SelectableGameObject';

describe('SelectableGameObject', () => {
    it('把完整选中描边放在真实点击对象本体上', () => {
        const { getByRole } = render(
            <SelectableGameObject selected aria-label="测试卡牌">
                卡牌
            </SelectableGameObject>,
        );

        const button = getByRole('button', { name: '测试卡牌' });
        expect(button.dataset.gameObjectSelected).toBe('true');
        expect(button.className).toContain('ring-4 ring-green-400');
    });

    it('候选态与禁用态不会同时暴露可点击信号', () => {
        const { getByRole } = render(
            <SelectableGameObject available disabled aria-label="禁用卡牌">
                卡牌
            </SelectableGameObject>,
        );

        const button = getByRole('button', { name: '禁用卡牌' });
        expect(button).toBeDisabled();
        expect(button.dataset.gameObjectAvailable).toBeUndefined();
    });
});
