import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dice2D } from '../Dice2D';

describe('Dice2D', () => {
    it('恢复原 2D 骰子的 CSS 立体翻滚合同且不创建 Canvas/WebGL', async () => {
        const { container, getByTestId } = render(
            <Dice2D
                value={4}
                isRolling
                size="48px"
                locale="zh-CN"
                characterId="monk"
                definitionId="monk-dice"
            />,
        );

        const root = getByTestId('dice-2d');
        const cube = getByTestId('dice-2d-cube');
        const sprite = container.querySelector('img');

        expect(root).toHaveAttribute('data-visual-mode', 'css-2d-cube');
        expect(root).toHaveAttribute('data-roll-animation', 'dice2d-cube-tumble');
        expect(cube.className).toContain('dice2d-cube-preserve-3d');
        expect(cube.className).toContain('animate-dice2d-cube-tumble');
        expect(container.querySelectorAll('[data-face-id]')).toHaveLength(6);
        expect(container.querySelector('canvas')).toBeNull();
        expect(sprite).not.toBeNull();

        fireEvent.load(sprite!);
        await waitFor(() => {
            expect(root).toHaveAttribute('data-sprite-ready', 'true');
        });
        expect(container.querySelectorAll('[data-face-fallback="false"]')).toHaveLength(6);
    });

    it('停稳时按点数恢复到对应面，而不是只显示单张静态平面图', () => {
        const { container, getByTestId } = render(
            <Dice2D
                value={2}
                isRolling={false}
                size="48px"
                locale="zh-CN"
                characterId="monk"
                definitionId="monk-dice"
            />,
        );

        expect(getByTestId('dice-2d')).toHaveAttribute('data-roll-animation', 'settled');
        expect(getByTestId('dice-2d-cube')).toHaveStyle({
            transform: 'rotateX(-90deg) rotateY(0deg)',
        });
        expect(container.querySelectorAll('[data-face-id]')).toHaveLength(6);
        expect(container.querySelector('canvas')).toBeNull();
    });

    it('同一英雄骰贴图加载过后，新骰子实例不应先闪回白底数字兜底面', async () => {
        const first = render(
            <Dice2D
                value={6}
                isRolling={false}
                size="48px"
                locale="zh-CN"
                characterId="gunslinger"
                definitionId="gunslinger-dice"
            />,
        );

        const firstSprite = first.container.querySelector('img');
        expect(firstSprite).not.toBeNull();
        fireEvent.load(firstSprite!);
        await waitFor(() => {
            expect(first.getByTestId('dice-2d')).toHaveAttribute('data-sprite-ready', 'true');
        });
        first.unmount();

        const second = render(
            <Dice2D
                value={2}
                isRolling={false}
                size="48px"
                locale="zh-CN"
                characterId="gunslinger"
                definitionId="gunslinger-dice"
            />,
        );

        expect(second.getByTestId('dice-2d')).toHaveAttribute('data-sprite-ready', 'true');
        expect(second.container.querySelectorAll('[data-face-fallback="glyph"]')).toHaveLength(0);
    });
});
