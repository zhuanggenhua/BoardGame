import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dice3D } from '../Dice3D';

function getVisibleFallbackTransform(): string {
    const root = screen.getByTestId('dice-3d');
    const visibleFallback = Array.from(root.children).find((child) => (
        child instanceof HTMLElement && child.classList.contains('dice3d-preserve-3d')
    ));

    expect(visibleFallback).toBeInstanceOf(HTMLElement);
    return (visibleFallback as HTMLElement).style.transform;
}

describe('Dice3D 普通聚光骰面', () => {
    it('点数变化时应旋转到新的可见骰面', () => {
        const { rerender } = render(
            <Dice3D
                value={1}
                isRolling={false}
                variant="spotlight"
                enableWebgl={false}
            />,
        );
        const initialTransform = getVisibleFallbackTransform();

        rerender(
            <Dice3D
                value={6}
                isRolling={false}
                variant="spotlight"
                enableWebgl={false}
            />,
        );

        const changedTransform = getVisibleFallbackTransform();
        expect(changedTransform).not.toBe(initialTransform);
        expect(changedTransform).toContain('rotateX(3.141593rad)');
    });
});
