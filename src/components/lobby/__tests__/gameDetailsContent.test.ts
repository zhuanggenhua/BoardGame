/* @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameDetailsChangelogSection } from '../GameDetailsChangelogSection';
import {
    DEFAULT_AUTHOR_NAME,
    resolveGameAuthorName,
    resolveGameDescription,
    resolveGameDisplayName,
} from '../gameDetailsContent';

const mockLoggerError = vi.fn();
const mockFetch = vi.fn();

vi.mock('../../../lib/logger', () => ({
    logger: {
        error: (...args: unknown[]) => mockLoggerError(...args),
    },
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => {
            const translations: Record<string, string> = {
                'leaderboard.changelogEmpty': '暂无日志',
                'changelog.loading': '加载更新日志中...',
                'changelog.error': '更新日志加载失败',
                'changelog.pinned': '置顶',
            };

            return translations[key] ?? options?.defaultValue ?? key;
        },
        i18n: { language: 'zh-CN' },
    }),
}));

beforeEach(() => {
    mockFetch.mockReset();
    mockLoggerError.mockReset();
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('resolveGameAuthorName', () => {
    it('优先返回 manifest 中声明的作者名', () => {
        expect(resolveGameAuthorName({ authorName: '  桌游作者  ' })).toBe('桌游作者');
    });

    it('缺少作者名时回退到默认值或传入的 fallback', () => {
        expect(resolveGameAuthorName(undefined)).toBe(DEFAULT_AUTHOR_NAME);
        expect(resolveGameAuthorName({ authorName: '   ' }, 'Unknown')).toBe('Unknown');
    });
});

describe('game manifest text resolver', () => {
    const t = (key: string, options?: { defaultValue?: string }) => {
        const translations: Record<string, string> = {
            'games.smashup.title': '大杀四方',
            'games.smashup.description': '卡牌对战',
        };
        return translations[key] ?? options?.defaultValue ?? key;
    };

    it('优先解析 manifest titleKey 的翻译', () => {
        expect(resolveGameDisplayName({
            id: 'smashup',
            titleKey: 'games.smashup.title',
        }, t)).toBe('大杀四方');
    });

    it('缺少翻译时不再泄露 key，而是回退到 game id', () => {
        expect(resolveGameDisplayName({
            id: 'cardia',
            titleKey: 'games.cardia.title',
        }, t)).toBe('cardia');
    });

    it('UGC 或字面文本直接返回原文', () => {
        expect(resolveGameDisplayName({
            id: 'ugc-demo',
            titleKey: 'My UGC Deck',
        }, t)).toBe('My UGC Deck');
    });

    it('description 缺少翻译时回退空字符串', () => {
        expect(resolveGameDescription({
            descriptionKey: 'games.cardia.description',
        }, t)).toBe('');
    });
});

describe('GameDetailsChangelogSection', () => {
    it('会渲染公开接口返回的更新日志内容', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                changelogs: [
                    {
                        id: 'cl-1',
                        gameId: 'dicethrone',
                        title: '平衡调整',
                        versionLabel: 'v0.1.3',
                        content: '火法燃烧提示已与已发布规则一致。',
                        published: true,
                        pinned: true,
                        publishedAt: '2026-03-12T00:00:00.000Z',
                        createdAt: '2026-03-12T00:00:00.000Z',
                        updatedAt: '2026-03-12T00:00:00.000Z',
                    },
                ],
            }),
        });

        render(createElement(GameDetailsChangelogSection, { gameId: 'dicethrone' }));

        await waitFor(() => {
            expect(screen.getByText('平衡调整')).toBeTruthy();
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0]?.[0]).toBe('/game-changelogs/dicethrone');
        expect(screen.getByText('v0.1.3')).toBeTruthy();
        expect(screen.getByText('置顶')).toBeTruthy();
        expect(screen.getByText('火法燃烧提示已与已发布规则一致。')).toBeTruthy();
    });

    it('接口失败时显示错误状态并记录日志', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({}),
        });

        render(createElement(GameDetailsChangelogSection, { gameId: 'dicethrone' }));

        await waitFor(() => {
            expect(screen.getByText('更新日志加载失败')).toBeTruthy();
        });

        expect(mockLoggerError).toHaveBeenCalledTimes(1);
        expect(mockLoggerError.mock.calls[0]?.[0]).toBe('[GameDetailsChangelogSection] 获取更新日志失败');
    });
});
