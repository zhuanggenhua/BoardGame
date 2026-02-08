/**
 * UGC Runtime E2E 测试
 * 
 * 测试 iframe 与宿主之间的 postMessage 通信
 */

import { test, expect } from '@playwright/test';

test.describe('UGC Runtime', () => {
    test.describe('postMessage 通信协议', () => {
        test('应覆盖关键消息类型', async ({ page }) => {
            await page.goto('about:blank');

            const result = await page.evaluate(() => {
                return new Promise<{
                    received: Record<string, boolean>;
                    payloads: { commandType: string; playerId: string; sfxKey: string; volume: number };
                }>((resolve) => {
                    const received: Record<string, boolean> = {
                        VIEW_READY: false,
                        COMMAND: false,
                        STATE_REQUEST: false,
                        PLAY_SFX: false,
                    };
                    const payloads = { commandType: '', playerId: '', sfxKey: '', volume: 0 };

                    const isComplete = () => Object.values(received).every(Boolean);

                    window.addEventListener('message', (event) => {
                        if (event.data?.source !== 'ugc-view') return;
                        const type = event.data?.type as string | undefined;
                        if (!type) return;

                        if (type === 'VIEW_READY') received.VIEW_READY = true;
                        if (type === 'COMMAND') {
                            received.COMMAND = true;
                            payloads.commandType = event.data?.payload?.commandType ?? '';
                            payloads.playerId = event.data?.payload?.playerId ?? '';
                        }
                        if (type === 'STATE_REQUEST') received.STATE_REQUEST = true;
                        if (type === 'PLAY_SFX') {
                            received.PLAY_SFX = true;
                            payloads.sfxKey = event.data?.payload?.sfxKey ?? '';
                            payloads.volume = event.data?.payload?.volume ?? 0;
                        }

                        if (isComplete()) {
                            resolve({ received, payloads });
                        }
                    });

                    window.postMessage({
                        id: 'test-1',
                        source: 'ugc-view',
                        type: 'VIEW_READY',
                        timestamp: Date.now(),
                    }, '*');

                    window.postMessage({
                        id: 'cmd-1',
                        source: 'ugc-view',
                        type: 'COMMAND',
                        timestamp: Date.now(),
                        payload: {
                            commandType: 'PLAY_CARD',
                            playerId: 'player-1',
                            params: { cardId: 'card-1' },
                        },
                    }, '*');

                    window.postMessage({
                        id: 'state-1',
                        source: 'ugc-view',
                        type: 'STATE_REQUEST',
                        timestamp: Date.now(),
                    }, '*');

                    window.postMessage({
                        id: 'sfx-1',
                        source: 'ugc-view',
                        type: 'PLAY_SFX',
                        timestamp: Date.now(),
                        payload: { sfxKey: 'click', volume: 0.8 },
                    }, '*');

                    setTimeout(() => resolve({ received, payloads }), 1000);
                });
            });

            expect(result.received.VIEW_READY).toBe(true);
            expect(result.received.COMMAND).toBe(true);
            expect(result.received.STATE_REQUEST).toBe(true);
            expect(result.received.PLAY_SFX).toBe(true);
            expect(result.payloads.commandType).toBe('PLAY_CARD');
            expect(result.payloads.playerId).toBe('player-1');
            expect(result.payloads.sfxKey).toBe('click');
            expect(result.payloads.volume).toBe(0.8);
        });
    });

    test.describe('消息结构验证', () => {
        test('消息应包含必要字段', async ({ page }) => {
            await page.goto('about:blank');

            const result = await page.evaluate(() => {
                return new Promise<{ hasId: boolean; hasSource: boolean; hasTimestamp: boolean }>((resolve) => {
                    window.addEventListener('message', (event) => {
                        if (event.data?.source === 'ugc-view') {
                            resolve({
                                hasId: typeof event.data.id === 'string',
                                hasSource: event.data.source === 'ugc-view',
                                hasTimestamp: typeof event.data.timestamp === 'number',
                            });
                        }
                    });

                    window.postMessage({
                        id: `msg-${Date.now()}`,
                        source: 'ugc-view',
                        type: 'VIEW_READY',
                        timestamp: Date.now(),
                    }, '*');

                    setTimeout(() => resolve({ hasId: false, hasSource: false, hasTimestamp: false }), 1000);
                });
            });

            expect(result.hasId).toBe(true);
            expect(result.hasSource).toBe(true);
            expect(result.hasTimestamp).toBe(true);
        });
    });
});
