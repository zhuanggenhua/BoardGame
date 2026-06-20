/* @vitest-environment happy-dom */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../../engine/types';
import Board from '../Board';
import { createBetrayalCharacterSelectCore, createBetrayalFoundationCore } from '../game';
import gameLocale from '../../../../public/locales/zh-CN/game-betrayal.json';
import commonLocale from '../../../../public/locales/zh-CN/common.json';

type TranslationTree = Record<string, string | TranslationTree>;

function resolveTranslation(tree: TranslationTree, key: string): string | undefined {
    return key.split('.').reduce<string | TranslationTree | undefined>((value, segment) => {
        if (!value || typeof value === 'string') {
            return undefined;
        }
        return value[segment];
    }, tree) as string | undefined;
}

function interpolate(template: string, options?: Record<string, unknown>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token: string) => String(options?.[token] ?? ''));
}

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const [namespace, plainKey] = key.includes(':') ? key.split(':', 2) : ['game-betrayal', key];
            const tree = namespace === 'common' ? commonLocale as TranslationTree : gameLocale as TranslationTree;
            const resolved = resolveTranslation(tree, plainKey);
            return typeof resolved === 'string' ? interpolate(resolved, options) : key;
        },
        i18n: { language: 'zh-CN' },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../../../components/common/media/OptimizedImage', () => ({
    OptimizedImage: ({ src, alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) => (
        <img alt={alt} data-src={src} {...rest} />
    ),
}));

describe('Betrayal Board foundation', () => {
    it('能渲染角色选择屏并提供确认入口', () => {
        render(
            <Board
                G={{
                    core: createBetrayalCharacterSelectCore(['0', '1', '2']),
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                ]}
                isConnected
            />,
        );

        expect(screen.getByTestId('betrayal-character-select-screen')).toBeInTheDocument();
        expect(screen.getByText('选择探索者')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-character-confirm')).toHaveTextContent('确认');
    });

    it('能渲染终局屏', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2']);
        core.phase = 'endgame';
        core.endgameResult = {
            hauntId: 'the-hunger',
            hauntTitle: '饥饿',
            outcome: 'survivors',
            winners: ['0', '1'],
            traitorPlayerId: '2',
            survivorsEscaped: ['0', '1'],
            reward: { stars: 4, omens: 2, logs: 1 },
            stats: { roomsExplored: 7, omensDrawn: 2, itemsDrawn: 1, eventsDrawn: 1 },
        };

        render(
            <Board
                G={{
                    core,
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                ]}
                isConnected
            />,
        );

        expect(screen.getByTestId('betrayal-endgame-screen')).toBeInTheDocument();
        expect(screen.getAllByText('幸存者逃脱').length).toBeGreaterThan(0);
        expect(screen.getAllByText('饥饿').length).toBeGreaterThan(0);
    });

    it('能渲染当前回合、房间主视区和牌堆计数', () => {
        render(
            <Board
                G={{
                    core: createBetrayalFoundationCore(['0', '1', '2', '3']),
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                    { id: 3, name: '队友三', isConnected: true },
                ]}
                isConnected
            />,
        );

        expect(screen.getByTestId('betrayal-board')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-status-chip')).toBeInTheDocument();
        expect(screen.getByText('当前回合：测试玩家')).toBeInTheDocument();
        expect(screen.getAllByText('推荐动作：探索').length).toBeGreaterThan(0);
        expect(screen.getAllByText('测试玩家').length).toBeGreaterThan(0);
        expect(screen.getByTestId('betrayal-action-cue')).toHaveTextContent('现在：点探索翻一层');
        expect(screen.getByTestId('betrayal-room-grid')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-grid')).toHaveClass('overflow-auto');
        expect(screen.getByTestId('betrayal-room-canvas')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-shell-grand-staircase')).toHaveStyle({
            width: '190px',
            height: '190px',
        });
        expect(screen.getByTestId('betrayal-room-preview-grand-staircase')).toBeInTheDocument();
        const roomTileSources = Array.from(screen.getByTestId('betrayal-room-grid').querySelectorAll('img'))
            .map((img) => img.getAttribute('data-src'));
        expect(roomTileSources.some((src) => src?.startsWith('betrayal/rooms/'))).toBe(true);
        const roomTileImages = Array.from(screen.getByTestId('betrayal-room-grid').querySelectorAll('img'));
        expect(roomTileImages.some((img) => img.className.includes('object-contain'))).toBe(true);
        expect(screen.getAllByText('当前房间').length).toBeGreaterThan(0);
        expect(screen.queryByText('可点击预演')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-mobile-dock-explore')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-mobile-selected-card')).toHaveTextContent('绳索');
        expect(screen.getByTestId('betrayal-mobile-action-cue')).toHaveTextContent('现在：点探索翻一层');
        expect(screen.getByTestId('betrayal-mobile-use-status')).toHaveTextContent('使用：移动 +1');
        expect(screen.getByTestId('betrayal-mobile-trade-status')).toHaveTextContent('当前没有同房间队友');
        expect(screen.getByTestId('betrayal-mobile-jump-inventory')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-mobile-jump-decks')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('等待第一步');
        expect(screen.getByTestId('betrayal-open-reference')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-open-scenario')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-open-active-room-preview')).toBeInTheDocument();
        expect(screen.queryByText('下一块会翻到 一层')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-connector-grand-staircase-upper-landing')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-connector-grand-staircase-entrance-hall')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-connector-upper-landing-grand-staircase')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-trade-status')).toHaveTextContent('当前没有同房间队友');
        expect(screen.getByTestId('betrayal-use-status')).toHaveTextContent('使用：移动 +1');
        expect(screen.getByTestId('betrayal-action-trade')).toBeDisabled();

        const deckSection = document.getElementById('betrayal-decks-section');
        expect(deckSection).not.toBeNull();
        expect(within(deckSection as HTMLElement).getByText('预兆牌堆')).toBeInTheDocument();
        expect(within(deckSection as HTMLElement).getByText('13')).toBeInTheDocument();
        expect(within(deckSection as HTMLElement).getByText('15')).toBeInTheDocument();
        expect(within(deckSection as HTMLElement).getByText('17')).toBeInTheDocument();

        expect(screen.queryByText('恶兆前探索')).not.toBeInTheDocument();
        expect(screen.queryByText('优先 探索')).not.toBeInTheDocument();
    });

    it('能通过预演交互切换房间、探索并结束回合', () => {
        render(
            <Board
                G={{
                    core: createBetrayalFoundationCore(['0', '1', '2', '3']),
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                    { id: 3, name: '队友三', isConnected: true },
                ]}
                isConnected
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-room-upper-landing'));
        expect(screen.getAllByText('测试玩家移动到二层平台').length).toBeGreaterThan(0);
        expect(screen.getByText('剩余移动 2')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('测试玩家移动到二层平台');
        expect(screen.getByTestId('betrayal-room-identity-upper-landing')).toHaveTextContent('起始');
        expect(within(screen.getByTestId('betrayal-room-upper-landing')).getAllByText('起始')).toHaveLength(1);
        expect(screen.getByTestId('betrayal-activity-list')).toHaveTextContent('前面还没有动作');

        fireEvent.click(screen.getByTestId('betrayal-action-explore'));
        expect(screen.getAllByText('测试玩家探索到长廊，事件：回廊顺风（移动 +1）').length).toBeGreaterThan(0);
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('测试玩家探索到长廊，事件：回廊顺风（移动 +1）');
        expect(screen.getByTestId('betrayal-activity-list')).toHaveTextContent('测试玩家移动到二层平台');
        expect(screen.getByTestId('betrayal-discovery-panel')).toHaveTextContent('探索结果');
        expect(screen.getByTestId('betrayal-discovery-panel')).toHaveTextContent('回廊顺风');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('移动 +1');
        expect(screen.getByText('剩余移动 3')).toBeInTheDocument();
        expect(screen.getAllByText('长廊').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        fireEvent.click(screen.getByTestId('betrayal-room-move-target-upper-landing'));
        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        fireEvent.click(screen.getByTestId('betrayal-room-move-target-grand-staircase'));
        fireEvent.click(screen.getByTestId('betrayal-action-explore'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('测试玩家探索到餐厅，拿到了狩猎短刀');
        expect(screen.getByTestId('betrayal-discovery-panel')).toHaveTextContent('狩猎短刀');
        expect(screen.getByTestId('betrayal-discovery-panel')).toHaveTextContent('已选中，可直接使用');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('力量 +1');
        expect(screen.getByTestId('betrayal-room-identity-ground-east')).toHaveTextContent('物品');
        expect(screen.getByTestId('betrayal-action-cue')).toHaveTextContent('现在：点使用');
        expect(screen.getByTestId('betrayal-mobile-selected-card')).toHaveTextContent('狩猎短刀');
        expect(screen.getByTestId('betrayal-mobile-action-cue')).toHaveTextContent('现在：点使用');
        expect(screen.getByTestId('betrayal-use-status')).toHaveTextContent('使用：力量 +1');

        fireEvent.click(screen.getByTestId('betrayal-action-endTurn'));
        expect(screen.getAllByText('轮到队友一，可前往长廊 / 大楼梯').length).toBeGreaterThan(0);
        expect(screen.getByText('当前回合：队友一')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('轮到队友一，可前往长廊 / 大楼梯');
        expect(screen.getByTestId('betrayal-turn-hint')).toHaveTextContent('可前往：长廊 / 大楼梯');
        expect(screen.queryByTestId('betrayal-discovery-panel')).not.toBeInTheDocument();
    });

    it('移动按钮会进入选目标模式，而不是直接跳到下一个房间', () => {
        render(
            <Board
                G={{
                    core: createBetrayalFoundationCore(['0', '1', '2', '3']),
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                    { id: 3, name: '队友三', isConnected: true },
                ]}
                isConnected
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('选择一个已发现房间完成移动');
        expect(screen.getByTestId('betrayal-room-move-target-upper-landing')).toBeInTheDocument();
        expect(screen.queryByText('可移动到此')).not.toBeInTheDocument();
        expect(screen.getAllByText('取消移动').length).toBeGreaterThan(0);
        expect(screen.getByTestId('betrayal-action-cue')).toHaveTextContent('现在：点绿色房间');

        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('已退出移动选目标');
        expect(screen.getByText('当前回合：测试玩家')).toBeInTheDocument();
    });

    it('移动模式只高亮当前房间相邻的已发现房间', () => {
        render(
            <Board
                G={{
                    core: createBetrayalFoundationCore(['0', '1', '2', '3']),
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                    { id: 3, name: '队友三', isConnected: true },
                ]}
                isConnected
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-room-upper-landing'));
        fireEvent.click(screen.getByTestId('betrayal-action-move'));

        expect(screen.getByTestId('betrayal-room-move-target-grand-staircase')).toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-room-move-target-entrance-hall')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-room-move-target-basement-landing')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('选择一个已发现房间完成移动');
    });

    it('交易只允许同房间队友，并可切换交易对象', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.otherExplorers[0]!.roomId = 'grand-staircase';
        core.otherExplorers[1]!.roomId = 'grand-staircase';

        render(
            <Board
                G={{
                    core,
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                    { id: 3, name: '队友三', isConnected: true },
                ]}
                isConnected
            />,
        );

        expect(screen.getByTestId('betrayal-action-trade')).toBeEnabled();
        expect(screen.getByTestId('betrayal-trade-status')).toHaveTextContent('可交易给：队友一');
        expect(screen.queryByTestId('betrayal-room-trade-shortcut')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-trade-target-2'));
        expect(screen.getByTestId('betrayal-trade-status')).toHaveTextContent('可交易给：队友二');

        fireEvent.click(screen.getByTestId('betrayal-action-trade'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('测试玩家把绳索交给了队友二');
        expect(screen.getByTestId('betrayal-trade-status')).toHaveTextContent('可交易给：队友二');
        expect(screen.getByTestId('betrayal-mobile-selected-card')).toHaveTextContent('手电筒');
        expect(screen.getByTestId('betrayal-mobile-trade-status')).toHaveTextContent('可交易给：队友二');
        expect(within(screen.getByTestId('betrayal-trade-target-2')).getByText('持有 4')).toBeInTheDocument();
        expect(within(screen.getByTestId('betrayal-trade-target-1')).getByText('持有 3')).toBeInTheDocument();
    });

    it('单一同房间队友会在主视区提供交易快捷入口', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.otherExplorers[0]!.roomId = 'grand-staircase';

        render(
            <Board
                G={{
                    core,
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                    { id: 3, name: '队友三', isConnected: true },
                ]}
                isConnected
            />,
        );

        expect(screen.getByTestId('betrayal-action-cue')).toHaveTextContent('现在：点探索翻一层');
        expect(screen.getByTestId('betrayal-room-trade-shortcut')).toHaveTextContent('交易给：队友一');

        fireEvent.click(screen.getByTestId('betrayal-room-trade-shortcut'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('测试玩家把绳索交给了队友一');
        expect(screen.getByTestId('betrayal-mobile-selected-card')).toHaveTextContent('手电筒');
        expect(screen.getByTestId('betrayal-trade-status')).toHaveTextContent('可交易给：队友一');
        expect(within(screen.getByTestId('betrayal-trade-target-1')).getByText('持有 4')).toBeInTheDocument();
    });

    it('探索拿到可用手牌后，主视区会提供使用快捷入口', () => {
        render(
            <Board
                G={{
                    core: createBetrayalFoundationCore(['0', '1', '2', '3']),
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                    { id: 3, name: '队友三', isConnected: true },
                ]}
                isConnected
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-room-upper-landing'));
        fireEvent.click(screen.getByTestId('betrayal-action-explore'));
        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        fireEvent.click(screen.getByTestId('betrayal-room-move-target-upper-landing'));
        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        fireEvent.click(screen.getByTestId('betrayal-room-move-target-grand-staircase'));
        fireEvent.click(screen.getByTestId('betrayal-action-explore'));

        expect(screen.getByTestId('betrayal-action-cue')).toHaveTextContent('现在：点使用狩猎短刀');
        expect(screen.getByTestId('betrayal-mobile-action-cue')).toHaveTextContent('现在：点使用狩猎短刀');
        expect(screen.getByTestId('betrayal-room-focus-target')).toHaveTextContent('使用：狩猎短刀');

        fireEvent.click(screen.getByTestId('betrayal-room-focus-target'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('测试玩家用狩猎短刀调整状态，力量 +1');
        expect(screen.getByTestId('betrayal-use-status')).toHaveTextContent('本回合已用');
        expect(screen.getByTestId('betrayal-room-focus-target')).toHaveTextContent('下一站：大楼梯');
    });

    it('使用会触发具体效果，并在本回合内锁定该卡', () => {
        render(
            <Board
                G={{
                    core: createBetrayalFoundationCore(['0', '1', '2', '3']),
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                    { id: 3, name: '队友三', isConnected: true },
                ]}
                isConnected
            />,
        );

        expect(screen.getByText('剩余移动 3')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-use-status')).toHaveTextContent('使用：移动 +1');

        fireEvent.click(screen.getByTestId('betrayal-action-use'));

        expect(screen.getByText('剩余移动 4')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('测试玩家用绳索稳住路线，额外获得 1 点移动');
        expect(screen.getByTestId('betrayal-use-status')).toHaveTextContent('本回合已用');
        expect(screen.getByTestId('betrayal-mobile-use-status')).toHaveTextContent('本回合已用');
        expect(screen.getByTestId('betrayal-action-use')).toBeDisabled();
        expect(screen.getByText('已用')).toBeInTheDocument();
        expect(screen.getAllByText('推荐动作：移动').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByTestId('betrayal-action-endTurn'));
        expect(screen.getByTestId('betrayal-use-status')).not.toHaveTextContent('本回合已用');
    });

    it('队友在长廊使用预兆后，会按当前局面改为推荐移动', () => {
        render(
            <Board
                G={{
                    core: createBetrayalFoundationCore(['0', '1', '2', '3']),
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                    { id: 3, name: '队友三', isConnected: true },
                ]}
                isConnected
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-room-upper-landing'));
        fireEvent.click(screen.getByTestId('betrayal-action-explore'));
        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        fireEvent.click(screen.getByTestId('betrayal-room-move-target-upper-landing'));
        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        fireEvent.click(screen.getByTestId('betrayal-room-move-target-grand-staircase'));
        fireEvent.click(screen.getByTestId('betrayal-action-explore'));
        fireEvent.click(screen.getByTestId('betrayal-action-endTurn'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('轮到队友一，可前往长廊 / 大楼梯');
        fireEvent.click(screen.getByTestId('betrayal-action-explore'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('队友一探索到长廊，拿到了碎镜片');
        expect(screen.getByTestId('betrayal-use-status')).toHaveTextContent('使用：知识 +1');

        fireEvent.click(screen.getByTestId('betrayal-action-use'));
        expect(screen.getAllByText('推荐动作：移动').length).toBeGreaterThan(0);
        expect(screen.getByTestId('betrayal-turn-hint')).toHaveTextContent('可前往：二层平台');
        expect(screen.getByTestId('betrayal-room-focus-target')).toHaveTextContent('下一站：二层平台');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('队友一用碎镜片调整状态，知识 +1');

        fireEvent.click(screen.getByTestId('betrayal-room-focus-target'));

        expect(screen.getAllByText('推荐动作：移动').length).toBeGreaterThan(0);
        expect(screen.getByTestId('betrayal-action-explore')).toBeDisabled();
        expect(screen.getByTestId('betrayal-turn-hint').textContent).toBe('可前往：长廊 / 大楼梯');
        expect(screen.queryByTestId('betrayal-room-focus-target')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('队友一移动到二层平台');
        expect(screen.getByTestId('betrayal-room-ground-east')).toHaveTextContent('餐厅');
        expect(screen.getByTestId('betrayal-room-ground-east')).toBeDisabled();
    });

    it('能按需打开并翻面参考卡', () => {
        render(
            <Board
                G={{
                    core: createBetrayalFoundationCore(['0', '1', '2', '3']),
                    sys: {} as MatchState<unknown>['sys'],
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '队友一', isConnected: true },
                    { id: 2, name: '队友二', isConnected: true },
                    { id: 3, name: '队友三', isConnected: true },
                ]}
                isConnected
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-open-reference'));
        expect(screen.getByTestId('betrayal-reference-overlay')).toBeInTheDocument();
        expect(screen.getByAltText('玩家参考卡正面')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-reference-toggle'));
        expect(screen.getByAltText('玩家参考卡背面')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-reference-close'));
        expect(screen.queryByTestId('betrayal-reference-overlay')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-room-preview-grand-staircase'));
        expect(screen.getByTestId('betrayal-room-preview-overlay')).toBeInTheDocument();
        expect(screen.getByAltText('大楼梯')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-room-preview-close'));
        expect(screen.queryByTestId('betrayal-room-preview-overlay')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-open-scenario'));
        expect(screen.getByTestId('betrayal-scenario-overlay')).toBeInTheDocument();
        expect(screen.getByText('首剧本查阅')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-scenario-close'));
        expect(screen.queryByTestId('betrayal-scenario-overlay')).not.toBeInTheDocument();
    });
});
