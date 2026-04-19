import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadUgcRuntimeConfig } from '../client/loader';
import { createUgcClientGame } from '../client/game';

const createJsonResponse = (data: unknown) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => data,
});

const createTextResponse = (text: string) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null),
    },
    text: async () => text,
});

const demoRulesCode = `const domain = {
  gameId: 'demo-ugc',
  setup(playerIds) {
    const players = Object.fromEntries(playerIds.map(id => [id, {
      resources: {},
      handCount: 0,
      deckCount: 0,
      discardCount: 0,
      statusEffects: {},
    }]));
    return {
      phase: 'init',
      activePlayerId: playerIds[0] || 'player-1',
      turnNumber: 0,
      players,
      publicZones: {},
    };
  },
  validate() { return { valid: true }; },
  execute() { return []; },
  reduce(state) { return state; },
};`;

describe('UGC 客户端加载器', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    it('应解析 entryPoints 并拼接默认资源基址', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(createJsonResponse({
            manifest: {
                entryPoints: {
                    rules: 'ugc/demo/domain.js',
                    view: 'ugc/demo/index.html',
                },
                metadata: { playerOptions: [2, 4] },
                commandTypes: ['MOVE'],
            },
        })));

        const config = await loadUgcRuntimeConfig('demo');

        expect(config.rulesUrl).toBe('/assets/ugc/demo/domain.js');
        expect(config.viewUrl).toBe('/assets/ugc/demo/index.html');
        expect(config.commandTypes).toEqual(['MOVE']);
        expect(config.minPlayers).toBe(2);
        expect(config.maxPlayers).toBe(4);
    });

    it('应完成 UGC Client Game 构建', async () => {
        fetchMock.mockImplementation((url: string | URL) => {
            const requestUrl = String(url);
            if (requestUrl.includes('/manifest')) {
                return Promise.resolve(createJsonResponse({
                    manifest: {
                        entryPoints: {
                            rules: 'ugc/demo/domain.js',
                        },
                        metadata: { playerOptions: [2, 3] },
                        commandTypes: ['PLAY'],
                    },
                }));
            }
            return Promise.resolve(createTextResponse(demoRulesCode));
        });

        const result = await createUgcClientGame('demo');

        expect(result.engineConfig).toBeDefined();
        expect(result.config.commandTypes).toEqual(['PLAY']);
        expect(result.rulesCode).toContain('const domain');
    });
});
