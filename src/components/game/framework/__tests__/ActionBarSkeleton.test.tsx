import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionBarSkeleton } from '../ActionBarSkeleton';

describe('ActionBarSkeleton', () => {
    it('会把 containerProps 透传到真实 DOM 容器，供教程锚点和测试定位复用', () => {
        render(
            <ActionBarSkeleton
                actions={[
                    { id: 'move', label: '移动', disabled: false },
                    { id: 'explore', label: '探索', disabled: false },
                ]}
                containerProps={{
                    'data-tutorial-id': 'test-action-zone',
                    'data-testid': 'test-action-zone',
                    title: 'action-zone',
                }}
            />,
        );

        const container = screen.getByTestId('test-action-zone');
        expect(container).toHaveAttribute('data-tutorial-id', 'test-action-zone');
        expect(container).toHaveAttribute('title', 'action-zone');
        expect(container).toHaveAttribute('data-component', 'action-bar');
    });
});
