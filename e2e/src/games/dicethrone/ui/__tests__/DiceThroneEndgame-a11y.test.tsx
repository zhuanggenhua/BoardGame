/**
 * Property 6: 无障碍标注正确性
 *
 * Feature: dicethrone-game-over-screen, Property 6: 无障碍标注正确性
 *
 * 对任意游戏结果（胜利/失败/平局），结算面板应包含语义正确的
 * aria-label 属性，准确描述当前结果。
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { DiceThroneEndgameContent } from '../DiceThroneEndgame';
import type { HeroState } from '../../domain/types';
import { RESOURCE_IDS } from '../../domain/resources';

// Mock react-i18next
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

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => {
            const { initial, animate, transition, ...rest } = props;
            return <div {...rest}>{children}</div>;
        },
        h2: ({ children, ...props }: any) => {
            const { initial, animate, transition, ...rest } = props;
            return <h2 {...rest}>{children}</h2>;
        },
    },
}));

vi.mock('../assets', () => ({
    getPortraitStyle: () => ({ backgroundImage: 'url(test.png)' }),
}));

/** 创建测试用 HeroState */
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

// Feature: dicethrone-game-over-screen, Property 6: 无障碍标注正确性
describe('Property 6: 无障碍标注正确性', () => {
    it('面板容器包含描述游戏结果的 aria-label', () => {
        fc.assert(
            fc.property(
                fc.boolean(), // isDraw
                fc.constantFrom('0', '1'), // winnerId
                fc.constantFrom('0', '1'), // myPlayerId
                (isDraw, winnerId, myPid) => {
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

                    // 面板容器应有 aria-label
                    const panel = container.querySelector('[data-testid="dt-endgame-content"]');
                    expect(panel).not.toBeNull();
                    const ariaLabel = panel!.getAttribute('aria-label');
                    expect(ariaLabel).toBeTruthy();
                    // aria-label 应包含 endgame.ariaPanel key（i18n mock 返回 key）
                    expect(ariaLabel).toContain('endgame.ariaPanel');

                    unmount();
                },
            ),
            { numRuns: 100 },
        );
    });

    it('每个英雄面板包含描述英雄信息的 aria-label', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('barbarian', 'monk', 'paladin'),
                fc.constantFrom('pyromancer', 'shadow_thief', 'moon_elf'),
                fc.integer({ min: 0, max: 50 }),
                fc.integer({ min: 0, max: 50 }),
                fc.integer({ min: 0, max: 15 }),
                fc.integer({ min: 0, max: 15 }),
                (char1, char2, hp1, hp2, cp1, cp2) => {
                    const players: Record<string, HeroState> = {
                        '0': createTestHero({
                            id: '0',
                            characterId: char1,
                            resources: { [RESOURCE_IDS.HP]: hp1, [RESOURCE_IDS.CP]: cp1 },
                        }),
                        '1': createTestHero({
                            id: '1',
                            characterId: char2,
                            resources: { [RESOURCE_IDS.HP]: hp2, [RESOURCE_IDS.CP]: cp2 },
                        }),
                    };

                    const { container, unmount } = render(
                        <DiceThroneEndgameContent
                            result={{ winner: '0' }}
                            playerID="0"
                            players={players}
                            myPlayerId="0"
                            locale="zh-CN"
                        />,
                    );

                    // 查找带 aria-label 的英雄面板
                    // i18n mock: t('endgame.ariaHero', { heroName, hp, cp }) → 'endgame.ariaHero'
                    // （mock 对 key 本身做插值替换，key 中无 {{}} 模板所以保持原样）
                    const heroPanels = container.querySelectorAll('[aria-label]');
                    // 至少有 2 个英雄面板 + 1 个主面板 = 3 个带 aria-label 的元素
                    const heroPanelLabels = Array.from(heroPanels)
                        .map(el => el.getAttribute('aria-label')!)
                        .filter(label => label.includes('endgame.ariaHero'));
                    expect(heroPanelLabels.length).toBe(2);

                    // 每个英雄面板都有 aria-label
                    for (const label of heroPanelLabels) {
                        expect(label).toBeTruthy();
                        expect(label.length).toBeGreaterThan(0);
                    }

                    unmount();
                },
            ),
            { numRuns: 100 },
        );
    });

    it('胜利/失败/平局三种结果都有正确的 aria-label', () => {
        const players: Record<string, HeroState> = {
            '0': createTestHero({ id: '0' }),
            '1': createTestHero({ id: '1' }),
        };

        // i18n mock 中 t('endgame.ariaPanel', { result: ... }) 返回 'endgame.ariaPanel'
        // （key 本身不含 {{result}} 模板，所以插值不生效）
        // 验证：三种结果下面板都有 aria-label，且标题 data-result 正确区分

        // 胜利
        const { container: c1, unmount: u1 } = render(
            <DiceThroneEndgameContent
                result={{ winner: '0' }}
                playerID="0"
                players={players}
                myPlayerId="0"
                locale="zh-CN"
            />,
        );
        const panel1 = c1.querySelector('[data-testid="dt-endgame-content"]')!;
        expect(panel1.getAttribute('aria-label')).toBeTruthy();
        // 标题 data-result 区分结果类型
        const title1 = c1.querySelector('[data-testid="dt-endgame-title"]')!;
        expect(title1.getAttribute('data-result')).toBe('victory');
        u1();

        // 失败
        const { container: c2, unmount: u2 } = render(
            <DiceThroneEndgameContent
                result={{ winner: '1' }}
                playerID="0"
                players={players}
                myPlayerId="0"
                locale="zh-CN"
            />,
        );
        const panel2 = c2.querySelector('[data-testid="dt-endgame-content"]')!;
        expect(panel2.getAttribute('aria-label')).toBeTruthy();
        const title2 = c2.querySelector('[data-testid="dt-endgame-title"]')!;
        expect(title2.getAttribute('data-result')).toBe('defeat');
        u2();

        // 平局
        const { container: c3, unmount: u3 } = render(
            <DiceThroneEndgameContent
                result={{ draw: true }}
                playerID="0"
                players={players}
                myPlayerId="0"
                locale="zh-CN"
            />,
        );
        const panel3 = c3.querySelector('[data-testid="dt-endgame-content"]')!;
        expect(panel3.getAttribute('aria-label')).toBeTruthy();
        const title3 = c3.querySelector('[data-testid="dt-endgame-title"]')!;
        expect(title3.getAttribute('data-result')).toBe('draw');
        u3();
    });
});
