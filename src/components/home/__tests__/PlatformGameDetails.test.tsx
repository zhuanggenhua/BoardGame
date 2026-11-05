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
        expect(screen.queryByText(/common:game_details.recommended_players/)).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '创建房间' })); expect(create).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId('game-details-close-button')); expect(close).toHaveBeenCalledTimes(1);
    });
    it('作者贴在标题右侧，人数格不再重复写推荐人数', () => {
        render(<PlatformGameDetails title="王权骰铸" description="介绍" thumbnail={<span>封面</span>}
            playerOptions={[2, 3, 4]} bestPlayers={[3]} primaryActions={<button>创建房间</button>}
            secondaryActions={null} author={<button>电子化作者：佚名</button>} tabs={[{ id: 'lobby', label: '在线大厅' }]}
            selectedTab="lobby" onTab={() => {}} onClose={() => {}}>房间列表</PlatformGameDetails>);
        const heading = document.querySelector('.platform-details-heading');
        expect(heading?.textContent).toContain('王权骰铸');
        expect(heading?.querySelector('.platform-details-author')?.textContent).toContain('电子化作者：佚名');
        expect(document.querySelector('.platform-details-actions .platform-details-author')).toBeNull();
        expect(screen.getByTestId('game-details-player-recommendation').textContent).toBe('234');
        expect(screen.queryByText(/common:game_details.recommended_players/)).toBeNull();
    });
});
