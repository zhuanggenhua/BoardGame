/* @vitest-environment happy-dom */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ModalStackProvider, useModalStack } from '../../../contexts/ModalStackContext';
import { useUrlModal } from '../useUrlModal';
import { useState } from 'react';

const ModalProbe = ({ reopenNonce }: { reopenNonce: number }) => {
    useUrlModal({
        paramKey: 'game',
        reopenNonce,
        getModalConfig: (gameId) => ({
            render: () => <div data-testid="url-modal">{gameId}</div>,
        }),
    });

    return null;
};

const StackProbe = () => {
    const { stack, closeTop } = useModalStack();
    const location = useLocation();
    return (
        <div>
            <span data-testid="modal-count">{stack.length}</span>
            <span data-testid="location-search">{location.search}</span>
            <button type="button" onClick={closeTop}>
                close top
            </button>
        </div>
    );
};

const Harness = () => {
    const [reopenNonce, setReopenNonce] = useState(0);
    return (
        <MemoryRouter initialEntries={['/?homeStyle=classic&game=dicethrone']}>
            <ModalStackProvider>
                <ModalProbe reopenNonce={reopenNonce} />
                <StackProbe />
                <button type="button" onClick={() => setReopenNonce((value) => value + 1)}>
                    reopen
                </button>
            </ModalStackProvider>
        </MemoryRouter>
    );
};

describe('useUrlModal', () => {
    afterEach(() => {
        cleanup();
    });

    it('程序化重开 URL 弹窗时不应清理当前 game 查询参数', async () => {
        render(<Harness />);

        await waitFor(() => {
            expect(screen.getByTestId('modal-count')).toHaveTextContent('1');
        });

        await act(async () => {
            screen.getByRole('button', { name: 'reopen' }).click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('modal-count')).toHaveTextContent('1');
            expect(screen.getByTestId('location-search')).toHaveTextContent('homeStyle=classic');
            expect(screen.getByTestId('location-search')).toHaveTextContent('game=dicethrone');
        });
    });

    it('用户主动关闭 URL 弹窗时仍应清理 game 查询参数并保留其他参数', async () => {
        render(<Harness />);

        await waitFor(() => {
            expect(screen.getByTestId('modal-count')).toHaveTextContent('1');
        });

        await act(async () => {
            screen.getByRole('button', { name: 'close top' }).click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('modal-count')).toHaveTextContent('0');
            expect(screen.getByTestId('location-search')).toHaveTextContent('homeStyle=classic');
            expect(screen.getByTestId('location-search')).not.toHaveTextContent('game=dicethrone');
        });
    });
});
