import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, waitFor, fireEvent } from '@testing-library/react';

import { DICETHRONE_STATUS_ATLAS_IDS, TOKEN_IDS } from '../domain/ids';
import { registerDiceDefinition } from '../domain/diceRegistry';
import { moonElfDiceDefinition } from '../heroes/moon_elf/diceConfig';
import { GUNSLINGER_SFX_BOUNTY } from '../heroes/gunslinger/abilities';
import { getVisualMetaById } from '../domain/statusEffects';
import { Dice3D } from '../ui/Dice3D';
import {
    buildSpriteBackgroundImage,
    DICE_BG_SIZE,
    getDiceSpriteAssetPath,
    getDiceSpritePosition,
    getDiceSpriteUrls,
    resolveSpriteAssetUrls,
} from '../ui/assets';
import {
    TokenBadge,
    __resetStatusEffectImageCachesForTests,
    getStatusEffectIconNode,
    loadStatusAtlases,
    type StatusIconAtlasConfig,
} from '../ui/statusEffects';
import {
    clearGameAssetBaseOverrides,
    getAssetsBaseUrl,
    markImageLoaded,
    setAssetsBaseUrl,
    setGameAssetBaseOverride,
} from '../../../core';
import { setAssetHashesForTesting } from '../../../core/AssetLoader';

registerDiceDefinition(moonElfDiceDefinition);

describe('StatusEffectsIcons', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
        setAssetHashesForTesting({});
        clearGameAssetBaseOverrides();
        __resetStatusEffectImageCachesForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('网页默认状态图集应指向服务器压缩 atlas 资源', () => {
        const atlas: StatusIconAtlasConfig = {
            imageW: 1314,
            imageH: 400,
            frames: {
                purify: { x: 0, y: 0, w: 400, h: 400 },
            },
            imagePath: 'dicethrone/images/monk/status-icons-atlas.png',
        };

        const html = renderToStaticMarkup(
            getStatusEffectIconNode(
                { frameId: 'purify', atlasId: DICETHRONE_STATUS_ATLAS_IDS.MONK },
                undefined,
                'normal',
                { [DICETHRONE_STATUS_ATLAS_IDS.MONK]: atlas }
            )
        );

        expect(html).toContain('https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/monk/compressed/status-icons-atlas.webp');
        expect(html).toContain('<img');
    });

    it('状态图集裁片应按图像自身比例定位，避免只露出数量角标', () => {
        const atlas: StatusIconAtlasConfig = {
            imageW: 800,
            imageH: 400,
            frames: {
                bounty: { x: 402, y: 0, w: 400, h: 400 },
            },
            imagePath: 'dicethrone/images/gunslinger/status-icons-atlas.png',
        };

        const html = renderToStaticMarkup(
            getStatusEffectIconNode(
                { frameId: TOKEN_IDS.BOUNTY, atlasId: DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER },
                'zh-CN',
                'normal',
                { [DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER]: atlas }
            )
        );

        expect(html).toContain('width:200%');
        expect(html).toContain('left:0');
        expect(html).toMatch(/translate\(-50\.2\d+%, 0%\)/);
        expect(html).toContain('transform-origin:top left');
    });

    it('官方远端状态图集首帧应保留官方来源且不强制 crossorigin', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        const atlas: StatusIconAtlasConfig = {
            imageW: 800,
            imageH: 400,
            frames: {
                loaded: { x: 0, y: 0, w: 400, h: 400 },
                bounty: { x: 402, y: 0, w: 400, h: 400 },
            },
            imagePath: 'dicethrone/images/gunslinger/status-icons-atlas.png',
        };

        const html = renderToStaticMarkup(
            getStatusEffectIconNode(
                { frameId: TOKEN_IDS.LOADED, atlasId: DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER },
                'zh-CN',
                'normal',
                { [DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER]: atlas }
            )
        );

        expect(html).toContain('https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/gunslinger/compressed/status-icons-atlas.webp');
        expect(html).not.toContain('crossorigin="anonymous"');
    });

    it('官方远端状态图集应保留官方直链渲染并复用探测结果', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        const atlas: StatusIconAtlasConfig = {
            imageW: 800,
            imageH: 400,
            frames: {
                loaded: { x: 0, y: 0, w: 400, h: 400 },
                bounty: { x: 402, y: 0, w: 400, h: 400 },
            },
            imagePath: 'dicethrone/images/gunslinger/status-icons-atlas.png',
        };
        const sourceUrl = 'https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/gunslinger/compressed/status-icons-atlas.webp';
        const fetchMock = vi.fn(async () => ({
            ok: true,
            blob: async () => new Blob(['webp'], { type: 'image/webp' }),
        }));
        const RealURL = URL;
        class MockURL extends RealURL {
            static createObjectURL = vi.fn(() => 'blob:status-atlas');
            static revokeObjectURL = vi.fn();
        }
        class MockImage {
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            naturalWidth = 0;
            naturalHeight = 0;
            currentSrc = '';
            crossOrigin: string | null = null;
            private _src = '';

            get src() {
                return this._src;
            }

            set src(value: string) {
                this._src = value;
                this.currentSrc = value;
                if (value === 'blob:status-atlas') {
                    this.naturalWidth = 800;
                    this.naturalHeight = 400;
                    queueMicrotask(() => this.onload?.());
                    return;
                }
                queueMicrotask(() => this.onerror?.());
            }
        }
        vi.stubGlobal('URL', MockURL as unknown as typeof URL);
        vi.stubGlobal('Image', MockImage as unknown as typeof Image);
        vi.stubGlobal('fetch', fetchMock);

        const first = render(
            getStatusEffectIconNode(
                { frameId: TOKEN_IDS.LOADED, atlasId: DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER },
                'zh-CN',
                'normal',
                { [DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER]: atlas },
            ),
        );

        await waitFor(() => {
            const img = first.container.querySelector('img');
            expect(img?.getAttribute('src')).toBe(sourceUrl);
            expect(img?.getAttribute('data-status-source-url')).toBe(sourceUrl);
            expect(fetchMock).toHaveBeenCalledWith(sourceUrl, { mode: 'cors', credentials: 'omit' });
        });

        const second = render(
            getStatusEffectIconNode(
                { frameId: TOKEN_IDS.BOUNTY, atlasId: DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER },
                'zh-CN',
                'normal',
                { [DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER]: atlas },
            ),
        );

        await waitFor(() => {
            const img = second.container.querySelector('img');
            expect(img?.getAttribute('src')).toBe(sourceUrl);
            expect(img?.getAttribute('data-status-source-url')).toBe(sourceUrl);
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('普通 /assets 可能返回 HTML 时状态图集应优先渲染官方 WebP', async () => {
        const atlasId = 'test-status-atlas';
        const sourcePath = 'dicethrone/images/test_status/status-icons-atlas.png';
        const localUrl = '/assets/i18n/zh-CN/dicethrone/images/test_status/compressed/status-icons-atlas.webp';
        const remoteUrl = 'https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/test_status/compressed/status-icons-atlas.webp';
        const atlas: StatusIconAtlasConfig = {
            imageW: 800,
            imageH: 400,
            frames: {
                loaded: { x: 0, y: 0, w: 400, h: 400 },
            },
            imagePath: sourcePath,
        };
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === localUrl) {
                return {
                    ok: true,
                    blob: async () => new Blob(['<!doctype html>'], { type: 'text/html' }),
                };
            }
            if (url === remoteUrl) {
                return {
                    ok: true,
                    blob: async () => new Blob(['webp'], { type: 'image/webp' }),
                };
            }
            return {
                ok: false,
                blob: async () => new Blob([]),
            };
        });
        const RealURL = URL;
        class MockURL extends RealURL {
            static createObjectURL = vi.fn(() => 'blob:remote-status-atlas');
            static revokeObjectURL = vi.fn();
        }
        class MockImage {
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            naturalWidth = 0;
            naturalHeight = 0;
            currentSrc = '';
            private _src = '';

            get src() {
                return this._src;
            }

            set src(value: string) {
                this._src = value;
                this.currentSrc = value;
                if (value === 'blob:remote-status-atlas') {
                    this.naturalWidth = 800;
                    this.naturalHeight = 400;
                    queueMicrotask(() => this.onload?.());
                    return;
                }
                queueMicrotask(() => this.onerror?.());
            }
        }
        vi.stubGlobal('URL', MockURL as unknown as typeof URL);
        vi.stubGlobal('Image', MockImage as unknown as typeof Image);
        vi.stubGlobal('fetch', fetchMock);

        const { container } = render(
            getStatusEffectIconNode(
                { frameId: TOKEN_IDS.LOADED, atlasId },
                'zh-CN',
                'normal',
                { [atlasId]: atlas },
            ),
        );

        await waitFor(() => {
            const img = container.querySelector('img');
            expect(img?.getAttribute('src')).toBe(remoteUrl);
            expect(img?.getAttribute('data-status-source-url')).toBe(remoteUrl);
            expect(fetchMock).toHaveBeenCalledWith(remoteUrl, { mode: 'cors', credentials: 'omit' });
        });
        expect(fetchMock).not.toHaveBeenCalledWith(localUrl, { mode: 'cors', credentials: 'omit' });
    });

    it('token 展示查询 debuff token 时应回退到对应视觉元数据', () => {
        const meta = getVisualMetaById(TOKEN_IDS.BOUNTY);

        expect(meta?.frameId).toBe(TOKEN_IDS.BOUNTY);
        expect(meta?.iconPath).toBe('dicethrone/images/gunslinger/icons/赏金');
        expect(meta?.sfxKey).toBe(GUNSLINGER_SFX_BOUNTY);
    });

    it('武士 token 视觉元数据应暴露专属 sfxKey，供动画冲击音优先使用', () => {
        const honor = getVisualMetaById(TOKEN_IDS.HONOR);
        const shame = getVisualMetaById(TOKEN_IDS.SHAME);
        const retribution = getVisualMetaById(TOKEN_IDS.SAMURAI_RETRIBUTION);

        expect(honor?.sfxKey).toBe('magic.general.simple_magic_sound_fx_pack_vol.light.heavenly_flame');
        expect(shame?.sfxKey).toBe('fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.pot_explosion');
        expect(retribution?.sfxKey).toBe('fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_power_up_lightning');
    });

    it('无 atlas 时应回退到单图 iconPath', () => {
        const html = renderToStaticMarkup(
            getStatusEffectIconNode(
                { iconPath: 'dicethrone/images/samurai/icons/荣誉' },
                'zh-CN',
                'normal',
                null
            )
        );

        expect(html).toContain('/assets/i18n/zh-CN/dicethrone/images/samurai/icons/compressed/荣誉.webp');
        expect(html).toContain('object-contain');
    });

    it('players.tokens 中的 debuff token 应复用视觉元数据，不再误显示加载态', () => {
        const html = renderToStaticMarkup(
            <TokenBadge
                tokenId={TOKEN_IDS.BOUNTY}
                amount={1}
                locale="zh-CN"
                atlas={{
                    [DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER]: {
                        imageW: 800,
                        imageH: 400,
                        imagePath: 'dicethrone/images/gunslinger/status-icons-atlas.png',
                        frames: {
                            loaded: { x: 0, y: 0, w: 400, h: 400 },
                            bounty: { x: 402, y: 0, w: 400, h: 400 },
                        },
                    },
                }}
            />
        );

        expect(html).toContain('https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/gunslinger/compressed/status-icons-atlas.webp');
        expect(html).not.toContain('atlas-shimmer');
    });

    it('会把 game-data 骰图路径折算成 dice-sprite 资源 key', () => {
        expect(getDiceSpriteAssetPath('moon_elf-dice', 'moon_elf')).toBe('dicethrone/images/moon_elf/dice');
    });

    it('game-data 骰图直链应保留为最终回退候选，避免压缩资源缺失时整块空白', () => {
        const urls = resolveSpriteAssetUrls('/game-data/dicethrone/monk/dice-sprite.png', 'zh-CN');
        expect(urls.at(-1)).toBe('/game-data/dicethrone/monk/dice-sprite.png');
    });

    it('渲染骰图背景时应指向 dice-sprite 的压缩资源', () => {
        const backgroundImage = buildSpriteBackgroundImage('/game-data/dicethrone/monk/dice-sprite.png');
        expect(backgroundImage).toContain('dicethrone/images/monk/compressed/dice.webp');
    });

    it('本地资源模式下，骰图候选 URL 应保留 /assets 前缀', () => {
        const urls = getDiceSpriteUrls('moon_elf-dice', 'moon_elf', 'zh-CN');
        expect(urls.some(url => url.includes('/dice.webp'))).toBe(true);
        expect(urls.some(url => url.startsWith('/assets/i18n/zh-CN/dicethrone/images/moon_elf/compressed/dice.webp'))).toBe(true);
    });

    it('远程资源模式下，骰图候选 URL 应走官方资源域名', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        const urls = getDiceSpriteUrls('moon_elf-dice', 'moon_elf', 'zh-CN');
        const base = getAssetsBaseUrl();
        expect(urls.some(url => url.includes('/dice.webp'))).toBe(true);
        expect(urls.every(url => url.startsWith(`${base}/`))).toBe(true);
    });

    it('远端骰图探测应通过 Image 加载，不应依赖跨域 fetch 成功', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        class MockImage {
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            naturalWidth = 256;
            complete = false;
            decoding = 'auto';

            set src(_value: string) {
                queueMicrotask(() => {
                    this.complete = true;
                    this.onload?.();
                });
            }
        }

        const fetchMock = vi.fn(async () => {
            throw new Error('remote fetch should not be used for dice sprite probing');
        });

        vi.stubGlobal('Image', MockImage as unknown as typeof Image);
        vi.stubGlobal('fetch', fetchMock);

        const { getByTestId, container } = render(
            <Dice3D
                value={6}
                isRolling={false}
                size="48px"
                locale="zh-CN"
                characterId="moon_elf"
                definitionId="moon_elf-dice"
            />
        );

        const sprite = container.querySelector('img');
        if (sprite) {
            fireEvent.load(sprite);
        }
        await waitFor(() => {
            expect(getByTestId('dice-3d').getAttribute('data-sprite-ready')).toBe('true');
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('本地骰图应直接使用 AssetLoader 候选 URL，并在 Image onload 后标记就绪', async () => {
        class MockImage {
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            naturalWidth = 256;
            complete = false;
            decoding = 'auto';

            set src(_value: string) {
                queueMicrotask(() => {
                    this.complete = true;
                    this.onload?.();
                });
            }
        }

        const fetchMock = vi.fn(async () => {
            throw new Error('local dice sprite should not fetch/blob in this path');
        });

        vi.stubGlobal('Image', MockImage as unknown as typeof Image);
        vi.stubGlobal('fetch', fetchMock);

        const { getByTestId } = render(
            <Dice3D
                value={6}
                isRolling={false}
                size="48px"
                locale="zh-CN"
                characterId="moon_elf"
                definitionId="moon_elf-dice"
            />
        );

        await waitFor(() => {
            expect(getByTestId('dice-3d').getAttribute('data-sprite-ready')).toBe('true');
        });
        expect(fetchMock).not.toHaveBeenCalled();
        const expectedUrl = getDiceSpriteUrls('moon_elf-dice', 'moon_elf', 'zh-CN')[0];
        if (expectedUrl) {
            expect(getByTestId('dice-3d').getAttribute('data-sprite-url')).toBe(expectedUrl);
        } else {
            expect(getByTestId('dice-3d').getAttribute('data-sprite-url')).toBe('');
        }
    });

    it('同一骰图并发渲染时应复用 in-flight 加载请求', async () => {
        const expectedUrl = getDiceSpriteUrls('moon_elf-dice', 'moon_elf', 'zh-CN')[0];
        let primaryRequestCount = 0;

        class MockImage {
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            naturalWidth = 256;
            naturalHeight = 256;
            currentSrc = '';
            private _src = '';

            get src() {
                return this._src;
            }

            set src(value: string) {
                this._src = value;
                this.currentSrc = value;
                if (value === expectedUrl) {
                    primaryRequestCount += 1;
                }
                queueMicrotask(() => {
                    this.onload?.();
                });
            }
        }

        vi.stubGlobal('Image', MockImage as unknown as typeof Image);

        const { getAllByTestId } = render(
            <div>
                <Dice3D value={1} isRolling={false} locale="zh-CN" characterId="moon_elf" definitionId="moon_elf-dice" />
                <Dice3D value={2} isRolling={false} locale="zh-CN" characterId="moon_elf" definitionId="moon_elf-dice" />
            </div>
        );

        await waitFor(() => {
            const nodes = getAllByTestId('dice-3d');
            expect(nodes.every((node) => node.getAttribute('data-sprite-ready') === 'true')).toBe(true);
        });

        if (expectedUrl) {
            expect(primaryRequestCount).toBe(1);
        }
    });

    it('候选 URL 变化但 source 缓存已命中时应直接复用 currentSrc', () => {
        const spriteAssetPath = getDiceSpriteAssetPath('moon_elf-dice', 'moon_elf');
        if (!spriteAssetPath) {
            throw new Error('expected moon_elf dice sprite asset path');
        }

        const img = new Image();
        Object.defineProperty(img, 'naturalWidth', { value: 256, configurable: true });
        Object.defineProperty(img, 'naturalHeight', { value: 256, configurable: true });
        Object.defineProperty(img, 'src', {
            value: 'https://old-cdn.example.com/i18n/zh-CN/dicethrone/images/moon_elf/compressed/dice.webp',
            configurable: true,
        });
        Object.defineProperty(img, 'currentSrc', {
            value: 'https://old-cdn.example.com/i18n/zh-CN/dicethrone/images/moon_elf/compressed/dice.webp',
            configurable: true,
        });
        markImageLoaded(spriteAssetPath, 'zh-CN', img);

        const html = renderToStaticMarkup(
            <Dice3D
                value={6}
                isRolling={false}
                size="48px"
                locale="zh-CN"
                characterId="moon_elf"
                definitionId="moon_elf-dice"
            />
        );

        expect(html).toContain('data-sprite-ready="true"');
        expect(html).toContain('https://old-cdn.example.com/i18n/zh-CN/dicethrone/images/moon_elf/compressed/dice.webp');
    });

    it('状态图集 JSON 在本地缺失时应回退服务器资源主源', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.startsWith('/assets/')) {
                return {
                    ok: false,
                    json: async () => null,
                };
            }

            return {
                ok: true,
                json: async () => ({
                    meta: { image: 'status-icons-atlas.png', size: { w: 1314, h: 400 } },
                    frames: {
                        purify: { frame: { x: 0, y: 0, w: 400, h: 400 } },
                    },
                }),
            };
        });
        vi.stubGlobal('fetch', fetchMock);

        const atlases = await loadStatusAtlases('zh-CN');

        expect(Object.keys(atlases).length).toBeGreaterThan(0);
        expect(fetchMock).toHaveBeenCalled();
        expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/assets/'))).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('https://assets.easyboardgame.top/official/i18n/zh-CN/'))).toBe(true);
    });

    it('网页 /assets 返回首页 HTML 时状态图集 JSON 应继续回退服务器资源主源', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.startsWith('/assets/')) {
                return {
                    ok: true,
                    json: async () => {
                        throw new SyntaxError('Unexpected token < in JSON at position 0');
                    },
                };
            }

            return {
                ok: true,
                json: async () => ({
                    meta: { image: 'status-icons-atlas.png', size: { w: 800, h: 400 } },
                    frames: {
                        loaded: { frame: { x: 0, y: 0, w: 400, h: 400 } },
                        bounty: { frame: { x: 402, y: 0, w: 400, h: 400 } },
                    },
                }),
            };
        });
        vi.stubGlobal('fetch', fetchMock);

        const atlases = await loadStatusAtlases('zh-CN');

        expect(atlases[DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER]?.frames.loaded).toEqual({
            x: 0,
            y: 0,
            w: 400,
            h: 400,
        });
        expect(atlases[DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER]?.frames.bounty).toEqual({
            x: 402,
            y: 0,
            w: 400,
            h: 400,
        });
        expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/assets/'))).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('https://assets.easyboardgame.top/official/i18n/zh-CN/'))).toBe(true);
    });

    it('状态图集 JSON 应按当前语言和备用语言查找本地路径', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/i18n/zh-CN/')) {
                return {
                    ok: false,
                    json: async () => null,
                };
            }
            return {
                ok: true,
                json: async () => ({
                    meta: { image: 'status-icons-atlas.png', size: { w: 1314, h: 400 } },
                    frames: {
                        purify: { frame: { x: 0, y: 0, w: 400, h: 400 } },
                    },
                }),
            };
        });
        vi.stubGlobal('fetch', fetchMock);

        const atlases = await loadStatusAtlases('zh-CN');

        expect(Object.keys(atlases).length).toBeGreaterThan(0);
        expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/assets/'))).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/i18n/en/'))).toBe(true);
    });

    it('新英雄状态图集应从本地 zh-CN JSON 加载坐标', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/i18n/zh-CN/dicethrone/images/zhanshujia/status-icons-atlas.json')) {
                return {
                    ok: true,
                    json: async () => ({
                        meta: { image: 'status-icons-atlas.png', size: { w: 512, h: 256 } },
                        frames: {
                            tactical_advantage: { frame: { x: 0, y: 0, w: 256, h: 256 } },
                            bind: { frame: { x: 256, y: 0, w: 256, h: 256 } },
                        },
                    }),
                };
            }
            if (url.includes('/i18n/zh-CN/dicethrone/images/cursed/status-icons-atlas.json')) {
                return {
                    ok: true,
                    json: async () => ({
                        meta: { image: 'status-icons-atlas.png', size: { w: 1024, h: 256 } },
                        frames: {
                            wither: { frame: { x: 0, y: 0, w: 256, h: 256 } },
                            parley: { frame: { x: 256, y: 0, w: 256, h: 256 } },
                            powder_keg: { frame: { x: 512, y: 0, w: 256, h: 256 } },
                            cursed_coin: { frame: { x: 768, y: 0, w: 256, h: 256 } },
                        },
                    }),
                };
            }
            return {
                ok: false,
                json: async () => null,
            };
        });
        vi.stubGlobal('fetch', fetchMock);

        const atlases = await loadStatusAtlases('zh-CN');

        expect(atlases[DICETHRONE_STATUS_ATLAS_IDS.ZHANSHUJIA]?.frames.tactical_advantage).toEqual({
            x: 0,
            y: 0,
            w: 256,
            h: 256,
        });
        expect(atlases[DICETHRONE_STATUS_ATLAS_IDS.ZHANSHUJIA]?.frames.bind).toEqual({
            x: 256,
            y: 0,
            w: 256,
            h: 256,
        });
        expect(atlases[DICETHRONE_STATUS_ATLAS_IDS.CURSED_PIRATE]?.frames.cursed_coin).toEqual({
            x: 768,
            y: 0,
            w: 256,
            h: 256,
        });
        expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/assets/'))).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('https://assets.easyboardgame.top/official/'))).toBe(true);
    });

    it('新英雄 atlas 不可用时应回退到单图 iconPath，避免手机端整组空白', () => {
        const tacticalHtml = renderToStaticMarkup(
            getStatusEffectIconNode(
                {
                    frameId: 'tactical_advantage',
                    atlasId: DICETHRONE_STATUS_ATLAS_IDS.ZHANSHUJIA,
                    iconPath: 'dicethrone/images/zhanshujia/status/战术优势',
                },
                'zh-CN',
                'normal',
                null,
            )
        );
        const cursedCoinHtml = renderToStaticMarkup(
            getStatusEffectIconNode(
                {
                    frameId: 'cursed_coin',
                    atlasId: DICETHRONE_STATUS_ATLAS_IDS.CURSED_PIRATE,
                    iconPath: 'dicethrone/images/cursed/status/诅咒金币',
                },
                'zh-CN',
                'normal',
                null,
            )
        );

        expect(tacticalHtml).toContain('/assets/i18n/zh-CN/dicethrone/images/zhanshujia/status/compressed/战术优势.webp');
        expect(cursedCoinHtml).toContain('/assets/i18n/zh-CN/dicethrone/images/cursed/status/compressed/诅咒金币.webp');
        expect(tacticalHtml).toContain('object-contain');
        expect(cursedCoinHtml).toContain('object-contain');
    });

    it('游戏包 override 下的状态图标首候选失败后应切到下一个 _capacitor_file_ 候选', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('dicethrone', 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets');
        setAssetHashesForTesting({
            'i18n/zh-CN/dicethrone/images/cursed/status/compressed/诅咒金币.webp': 'coin1234',
        });

        const { container } = render(
            getStatusEffectIconNode(
                {
                    iconPath: 'dicethrone/images/cursed/status/诅咒金币',
                },
                'zh-CN',
                'normal',
                null,
            ),
        );
        const img = container.querySelector('img');
        const hashedUrl = 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets/i18n/zh-CN/dicethrone/images/cursed/status/compressed/诅咒金币.webp?v=coin1234';
        const plainUrl = 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets/i18n/zh-CN/dicethrone/images/cursed/status/compressed/诅咒金币.webp';

        expect(img?.getAttribute('src')).toBe(hashedUrl);
        fireEvent.error(img!);

        await waitFor(() => {
            expect(container.querySelector('img')?.getAttribute('src')).toBe(plainUrl);
        });
    });

    it('游戏包 override 下的状态图集 JSON 应先走本地游戏包，并在 _capacitor_file_ query 失败后回退无 query URL', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('dicethrone', 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets');
        setAssetHashesForTesting({
            'i18n/zh-CN/dicethrone/images/zhanshujia/status-icons-atlas.json': 'atlas1234',
        });

        const hashedUrl = 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets/i18n/zh-CN/dicethrone/images/zhanshujia/status-icons-atlas.json?v=atlas1234';
        const plainUrl = 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets/i18n/zh-CN/dicethrone/images/zhanshujia/status-icons-atlas.json';

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === hashedUrl) {
                return {
                    ok: false,
                    json: async () => null,
                };
            }
            if (url === plainUrl) {
                return {
                    ok: true,
                    json: async () => ({
                        meta: { image: 'status-icons-atlas.png', size: { w: 512, h: 256 } },
                        frames: {
                            tactical_advantage: { frame: { x: 0, y: 0, w: 256, h: 256 } },
                        },
                    }),
                };
            }
            return {
                ok: false,
                json: async () => null,
            };
        });
        vi.stubGlobal('fetch', fetchMock);

        const atlases = await loadStatusAtlases('zh-CN');

        expect(atlases[DICETHRONE_STATUS_ATLAS_IDS.ZHANSHUJIA]?.frames.tactical_advantage).toEqual({
            x: 0,
            y: 0,
            w: 256,
            h: 256,
        });
        expect(fetchMock.mock.calls.some(([input]) => String(input) === hashedUrl)).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input) === plainUrl)).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/assets/'))).toBe(false);
    });

    it('游戏包 override 下本地状态图集 JSON 不可用时应回退服务器资源主源', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('dicethrone', 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets');
        setAssetHashesForTesting({
            'i18n/zh-CN/dicethrone/images/monk/status-icons-atlas.json': 'atlas1234',
        });

        const localHashedUrl = 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets/i18n/zh-CN/dicethrone/images/monk/status-icons-atlas.json?v=atlas1234';
        const localPlainUrl = 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets/i18n/zh-CN/dicethrone/images/monk/status-icons-atlas.json';
        const remoteUrl = 'https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/monk/status-icons-atlas.json';

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === localHashedUrl || url === localPlainUrl) {
                return {
                    ok: false,
                    json: async () => null,
                };
            }
            if (url === remoteUrl) {
                return {
                    ok: true,
                    json: async () => ({
                        meta: { image: 'status-icons-atlas.png', size: { w: 1314, h: 400 } },
                        frames: {
                            purify: { frame: { x: 0, y: 0, w: 400, h: 400 } },
                        },
                    }),
                };
            }
            return {
                ok: false,
                json: async () => null,
            };
        });
        vi.stubGlobal('fetch', fetchMock);

        const atlases = await loadStatusAtlases('zh-CN');

        expect(atlases[DICETHRONE_STATUS_ATLAS_IDS.MONK]?.frames.purify).toEqual({
            x: 0,
            y: 0,
            w: 400,
            h: 400,
        });
        expect(fetchMock.mock.calls.some(([input]) => String(input) === localHashedUrl)).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input) === localPlainUrl)).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input) === remoteUrl)).toBe(true);
    });

    it('骰图切片坐标应匹配 3x3 atlas（使用下两行）', () => {
        expect(DICE_BG_SIZE).toBe('300% 300%');
        expect(getDiceSpritePosition(2)).toEqual({ xPos: 0, yPos: 50 });
        expect(getDiceSpritePosition(5)).toEqual({ xPos: 100, yPos: 50 });
        expect(getDiceSpritePosition(6)).toEqual({ xPos: 100, yPos: 100 });
    });

    it('dice sprite 缺失时应渲染可见骰面文本兜底，避免整块空白', () => {
        const html = renderToStaticMarkup(
            <Dice3D
                value={6}
                isRolling={false}
                size="48px"
                characterId="__missing__"
            />
        );

        expect(html).toContain('data-sprite-ready="false"');
        expect(html).toContain('data-face-id="1"');
        expect(html).toContain('data-face-fallback="glyph"');
        expect(html).toContain('data-face-symbol=""');
        expect(html).toContain('>6<');
    });
});
