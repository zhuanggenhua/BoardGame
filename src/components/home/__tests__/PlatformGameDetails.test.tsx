// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformGameDetails } from '../PlatformGameDetails';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
describe('收藏详情内嵌承接', () => {
    it('内嵌详情不用模态语义，关闭和原房间操作仍可用', () => {
        const close = vi.fn(); const create = vi.fn();
        render(<PlatformGameDetails presentation="inline" title="山屋惊魂" description="探索宅邸" thumbnail={<span>封面</span>}
            playerOptions={[3, 4, 5, 6]} bestPlayers={[4, 5]} primaryActions={<button onClick={create}>创建房间</button>}
            secondaryActions={null} author={null} tabs={[{ id: 'lobby', label: '在线大厅' }]} selectedTab="lobby" onTab={() => {}} onClose={close}>房间列表</PlatformGameDetails>);
        expect(screen.getByRole('region', { name: '山屋惊魂' })).toBeTruthy();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.queryByRole('button', { name: /platform.moreDetails/ })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '创建房间' })); expect(create).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId('game-details-close-button')); expect(close).toHaveBeenCalledTimes(1);
    });
});
