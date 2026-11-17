/* @vitest-environment happy-dom */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ModalStackProvider, useModalStack } from '../../../contexts/ModalStackContext';
import { useUrlModal } from '../useUrlModal';
import { StrictMode, useEffect, useState } from 'react';

const ModalProbe = ({ reopenNonce, enabled = true }: { reopenNonce: number; enabled?: boolean }) => {
    useUrlModal({
        paramKey: 'game',
        reopenNonce,
        enabled,
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

const InitialReopenHarness = () => {
    const [nonce, setNonce] = useState(0);
    useEffect(() => { setNonce(value => value + 1); }, []);
    return <MemoryRouter initialEntries={['/?game=dicethrone']}><ModalStackProvider>
        <ModalProbe reopenNonce={nonce} /><StackProbe />
    </ModalStackProvider></MemoryRouter>;
};

describe('useUrlModal', () => {
    afterEach(() => {
        cleanup();
    });

    it('弹窗内容准备完成前不打开，完成后只打开一次并可关闭', async () => {
        const PendingHarness = () => {
            const [ready, setReady] = useState(false);
            const [nonce, setNonce] = useState(0);
            useEffect(() => { setNonce(1); }, []);
            return <MemoryRouter initialEntries={['/?game=dicethrone']}><ModalStackProvider>
                <ModalProbe enabled={ready} reopenNonce={nonce} /><StackProbe />
                <button onClick={() => setReady(true)}>ready</button>
            </ModalStackProvider></MemoryRouter>;
        };
        render(<PendingHarness />);
        expect(screen.getByTestId('modal-count')).toHaveTextContent('0');
        await act(async () => { screen.getByRole('button', { name: 'ready' }).click(); });
        await waitFor(() => expect(screen.getByTestId('modal-count')).toHaveTextContent('1'));
        await act(async () => { screen.getByRole('button', { name: 'close top' }).click(); });
        await waitFor(() => expect(screen.getByTestId('modal-count')).toHaveTextContent('0'));
    });

    it('首页初始带游戏参数并触发重开时只留下一个弹窗', async () => {
        render(<StrictMode><InitialReopenHarness /></StrictMode>);
        await waitFor(() => expect(screen.getByTestId('modal-count')).toHaveTextContent('1'));
        await act(async () => { screen.getByRole('button', { name: 'close top' }).click(); });
        await waitFor(() => expect(screen.getByTestId('modal-count')).toHaveTextContent('0'));
    });

    it('重复执行挂载 effect 后只保留一个详情，关闭后不留旧层', async () => {
        render(<StrictMode><Harness /></StrictMode>);
        await waitFor(() => expect(screen.getByTestId('modal-count')).toHaveTextContent('1'));
        await act(async () => { screen.getByRole('button', { name: 'close top' }).click(); });
        await waitFor(() => {
            expect(screen.getByTestId('modal-count')).toHaveTextContent('0');
            expect(screen.getByTestId('location-search')).not.toHaveTextContent('game=dicethrone');
        });
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
