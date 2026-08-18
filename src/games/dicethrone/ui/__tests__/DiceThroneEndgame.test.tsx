/**
 * DiceThroneEndgameContent 单元测试
 *
 * 覆盖正确性属性：
 * - Property 1: 终局胜负画面内容完整性
 * - Property 2: 胜负视觉区分
 * - Property 3: 标题颜色匹配结果类型
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { DiceThroneEndgameContent } from '../DiceThroneEndgame';
import type { HeroState } from '../../domain/types';
import { RESOURCE_IDS } from '../../domain/resources';

// Mock react-i18next：identity 函数，返回 key 本身（带插值替换）
vi.mock('react-i18next', () => ({
    useTranslation: (ns?: string) => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            if (opts) {
                let result = key;
                for (const [k, v] of Object.entries(opts)) {
                    result = result.replace(`{{${k}}}`, String(v));
                }
                return result;
            }
            return `${ns ? ns + ':' : ''}${key}`;
        },
    }),
}));

// Mock framer-motion：渲染为普通 DOM 元素
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...filterDomProps(props)}>{children}</div>,
        h2: ({ children, ...props }: any) => <h2 {...filterDomProps(props)}>{children}</h2>,
    },
}));

// Mock getPortraitStyle
vi.mock('../assets', () => ({
    getPortraitStyle: () => ({ backgroundImage: 'url(test.png)', backgroundPosition: '0 0' }),
}));

/** 过滤 framer-motion 专用 props，只保留合法 DOM 属性 */
function filterDomProps(props: Record<string, any>) {
    const { initial, animate, transition, ...rest } = props;
    return rest;
}

// ============================================================================
// 测试数据生成器
// ============================================================================

/** 角色 ID 生成器 */
const arbCharacterId = fc.constantFrom('barbarian', 'monk', 'paladin', 'pyromancer', 'shadow_thief', 'moon_elf');

/** Token 生成器：0-5 个非零 Token */
const arbTokens = fc.dictionary(
    fc.constantFrom('dodge', 'chi', 'purify', 'fire_mastery', 'shadow', 'evasive'),
    fc.integer({ min: 1, max: 5 }),
);

/** 创建最小化 HeroState */
function createTestHero(overrides: Partial<HeroState> = {}): HeroState {
    return {
        id: overrides.id ?? '0',
        characterId: overrides.characterId ?? 'barbarian',
        resources: overrides.resources ?? { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
        tokens: overrides.tokens ?? {},
        statusEffects: {},
        dice: [],
        rollCount: 0,
        rollLimit: 3,
        hand: [],
        deck: [],
        discard: [],
        damageShields: [],
        abilities: [],
        abilityLevels: {},
        upgradeCardByAbilityId: {},
        passiveAbilities: [],
    } as HeroState;
}

// ============================================================================
// Property 1: 终局胜负画面内容完整性
// ============================================================================

// Feature: dicethrone-game-over-screen, Property 1: 终局胜负画面内容完整性
describe('Property 1: 终局胜负画面内容完整性', () => {
    it('对任意游戏结束状态，面板应包含双方英雄肖像、名称、HP、CP 和非零 Token', () => {
        fc.assert(
            fc.property(
                arbCharacterId,
                arbCharacterId,
                fc.integer({ min: 0, max: 50 }),
                fc.integer({ min: 0, max: 50 }),
                fc.integer({ min: 0, max: 15 }),
                fc.integer({ min: 0, max: 15 }),
                arbTokens,
                arbTokens,
                fc.boolean(), // isDraw
                (char1, char2, hp1, hp2, cp1, cp2, tokens1, tokens2, isDraw) => {
                    const players: Record<string, HeroState> = {
                        '0': createTestHero({
                            id: '0',
                            characterId: char1,
                            resources: { [RESOURCE_IDS.HP]: hp1, [RESOURCE_IDS.CP]: cp1 },
                            tokens: tokens1,
                        }),
                        '1': createTestHero({
                            id: '1',
                            characterId: char2,
                            resources: { [RESOURCE_IDS.HP]: hp2, [RESOURCE_IDS.CP]: cp2 },
                            tokens: tokens2,
                        }),
                    };

                    const result = isDraw
                        ? { draw: true }
                        : { winner: '0' };

                    const { container, unmount } = render(
                        <DiceThroneEndgameContent
                            result={result}
                            playerID="0"
                            players={players}
                            myPlayerId="0"
                            locale="zh-CN"
                        />,
                    );

                    const text = container.textContent ?? '';

                    // 双方角色名称
                    expect(text).toContain(`characters.${char1}`);
                    expect(text).toContain(`characters.${char2}`);

                    // 双方 HP 值
                    expect(text).toContain(`HP ${hp1}`);
                    expect(text).toContain(`HP ${hp2}`);

                    // 双方 CP 值
                    expect(text).toContain(`CP ${cp1}`);
                    expect(text).toContain(`CP ${cp2}`);

                    // 所有非零 Token
                    for (const [tokenId, count] of Object.entries(tokens1)) {
                        if (count > 0) {
                            expect(text).toContain(`tokens.${tokenId}.name`);
                            expect(text).toContain(`×${count}`);
                        }
                    }
                    for (const [tokenId, count] of Object.entries(tokens2)) {
                        if (count > 0) {
                            expect(text).toContain(`tokens.${tokenId}.name`);
                            expect(text).toContain(`×${count}`);
                        }
                    }

                    unmount();
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 2: 胜负视觉区分
// ============================================================================

// Feature: dicethrone-game-over-screen, Property 2: 胜负视觉区分
describe('Property 2: 胜负视觉区分', () => {
    it('存在胜者时，胜者肖像 scale-110，败者 scale-90 + grayscale', () => {
        fc.assert(
            fc.property(
                arbCharacterId,
                arbCharacterId,
                fc.constantFrom('0', '1'),
                (char1, char2, winnerId) => {
                    const players: Record<string, HeroState> = {
                        '0': createTestHero({ id: '0', characterId: char1 }),
                        '1': createTestHero({ id: '1', characterId: char2 }),
                    };

                    const { container, unmount } = render(
                        <DiceThroneEndgameContent
                            result={{ winner: winnerId }}
                            playerID="0"
                            players={players}
                            myPlayerId="0"
                            locale="zh-CN"
                        />,
                    );

                    // 查找肖像容器（w-20 h-28 的 div）
                    const portraits = container.querySelectorAll('.w-20.h-28');
                    expect(portraits.length).toBe(2);

                    // 按玩家 ID 排序（'0' 在前，'1' 在后）
                    const p0Classes = portraits[0].className;
                    const p1Classes = portraits[1].className;

                    if (winnerId === '0') {
                        expect(p0Classes).toContain('scale-110');
                        expect(p1Classes).toContain('scale-90');
                        expect(p1Classes).toContain('grayscale');
                    } else {
                        expect(p1Classes).toContain('scale-110');
                        expect(p0Classes).toContain('scale-90');
                        expect(p0Classes).toContain('grayscale');
                    }

                    unmount();
                },
            ),
            { numRuns: 100 },
        );
    });

    it('平局时，双方肖像具有相同的视觉处理（scale-100）', () => {
        fc.assert(
            fc.property(
                arbCharacterId,
                arbCharacterId,
                (char1, char2) => {
                    const players: Record<string, HeroState> = {
                        '0': createTestHero({ id: '0', characterId: char1 }),
                        '1': createTestHero({ id: '1', characterId: char2 }),
                    };

                    const { container, unmount } = render(
                        <DiceThroneEndgameContent
                            result={{ draw: true }}
                            playerID="0"
                            players={players}
                            myPlayerId="0"
                            locale="zh-CN"
                        />,
                    );

                    const portraits = container.querySelectorAll('.w-20.h-28');
                    expect(portraits.length).toBe(2);

                    // 平局：双方都是 scale-100，无 grayscale
                    for (const portrait of portraits) {
                        expect(portrait.className).toContain('scale-100');
                        expect(portrait.className).not.toContain('scale-110');
                        expect(portrait.className).not.toContain('scale-90');
                        expect(portrait.className).not.toContain('grayscale');
                    }

                    unmount();
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 3: 标题颜色匹配结果类型
// ============================================================================

// Feature: dicethrone-game-over-screen, Property 3: 标题颜色匹配结果类型
describe('Property 3: 标题颜色匹配结果类型', () => {
    it('胜利视角使用琥珀金色系（amber）', () => {
        const players: Record<string, HeroState> = {
            '0': createTestHero({ id: '0' }),
            '1': createTestHero({ id: '1' }),
        };

        const { unmount } = render(
            <DiceThroneEndgameContent
                result={{ winner: '0' }}
                playerID="0"
                players={players}
                myPlayerId="0"
                locale="zh-CN"
            />,
        );

        const title = screen.getByTestId('dt-endgame-title');
        expect(title).toHaveAttribute('data-result', 'victory');
        expect(title.className).toContain('amber');
        expect(title.className).not.toContain('red');

        unmount();
    });

    it('失败视角使用红色系（red）', () => {
        const players: Record<string, HeroState> = {
            '0': createTestHero({ id: '0' }),
            '1': createTestHero({ id: '1' }),
        };

        const { unmount } = render(
            <DiceThroneEndgameContent
                result={{ winner: '1' }}
                playerID="0"
                players={players}
                myPlayerId="0"
                locale="zh-CN"
            />,
        );

        const title = screen.getByTestId('dt-endgame-title');
        expect(title).toHaveAttribute('data-result', 'defeat');
        expect(title.className).toContain('red');
        expect(title.className).not.toContain('amber');

        unmount();
    });

    it('2v2 winners 数组包含当前玩家时应显示胜利视角', () => {
        const players: Record<string, HeroState> = {
            '0': createTestHero({ id: '0' }),
            '1': createTestHero({ id: '1' }),
            '2': createTestHero({ id: '2' }),
            '3': createTestHero({ id: '3' }),
        };

        const { unmount } = render(
            <DiceThroneEndgameContent
                result={{ winner: '0', winners: ['0', '2'] }}
                playerID="2"
                players={players}
                myPlayerId="2"
                locale="zh-CN"
            />,
        );

        const title = screen.getByTestId('dt-endgame-title');
        expect(title).toHaveAttribute('data-result', 'victory');
        expect(title.className).toContain('amber');

        unmount();
    });

    it('平局使用白银色系（white/slate）', () => {
        const players: Record<string, HeroState> = {
            '0': createTestHero({ id: '0' }),
            '1': createTestHero({ id: '1' }),
        };

        const { unmount } = render(
            <DiceThroneEndgameContent
                result={{ draw: true }}
                playerID="0"
                players={players}
                myPlayerId="0"
                locale="zh-CN"
            />,
        );

        const title = screen.getByTestId('dt-endgame-title');
        expect(title).toHaveAttribute('data-result', 'draw');
        expect(title.className).toContain('white');
        expect(title.className).not.toContain('amber');
        expect(title.className).not.toContain('red');

        unmount();
    });

    // 属性测试：对任意结果和视角，标题颜色类与结果类型一致
    it('对任意结果和视角，标题颜色类与结果类型匹配', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('0', '1'),  // winnerId
                fc.constantFrom('0', '1'),  // myPlayerId
                fc.boolean(),               // isDraw
                (winnerId, myPid, isDraw) => {
                    const players: Record<string, HeroState> = {
                        '0': createTestHero({ id: '0' }),
                        '1': createTestHero({ id: '1' }),
                    };

                    const result = isDraw ? { draw: true } : { winner: winnerId };

                    const { container, unmount } = render(
                        <DiceThroneEndgameContent
                            result={result}
                            playerID={myPid}
                            players={players}
                            myPlayerId={myPid}
                            locale="zh-CN"
                        />,
                    );

                    const title = container.querySelector('[data-testid="dt-endgame-title"]');
                    expect(title).not.toBeNull();
                    const cls = title!.className;
                    const dataResult = title!.getAttribute('data-result');

                    if (isDraw) {
                        expect(dataResult).toBe('draw');
                        expect(cls).toContain('white');
                    } else if (winnerId === myPid) {
                        expect(dataResult).toBe('victory');
                        expect(cls).toContain('amber');
                    } else {
                        expect(dataResult).toBe('defeat');
                        expect(cls).toContain('red');
                    }

                    unmount();
                },
            ),
            { numRuns: 100 },
        );
    });
});
