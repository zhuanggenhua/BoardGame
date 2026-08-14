import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AbilityOverlays } from '../AbilityOverlays';
import { getAbilitySlotLayoutForCharacter, getPlayerBoardLayoutVersion } from '../abilitySlotLayout';
import { HERO_CARDS_MAP, getSlotAbilityId, getUpgradeCardForAbilityLevel } from '../abilityOverlayHelpers';
import { getAbilitySlotIdForCharacter } from '../abilitySlotMapping';


const mockUseCoarsePointer = vi.fn(() => false);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ previewRef, className }: { previewRef?: { atlasId?: string; index?: number }; className?: string }) => (
        <div
            data-testid="mock-card-preview"
            data-atlas-id={previewRef?.atlasId ?? ''}
            data-preview-index={previewRef?.index ?? -1}
            className={className}
        />
    ),
}));

vi.mock('../../../hooks/ui/useCoarsePointer', () => ({
    useCoarsePointer: () => mockUseCoarsePointer(),
}));

describe('AbilityOverlays', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        mockUseCoarsePointer.mockReturnValue(false);
    });

    const renderAbilityOverlays = (overrides: Partial<React.ComponentProps<typeof AbilityOverlays>> = {}) => {
        return render(
            <div style={{ position: 'relative', width: 1200, height: 900 }}>
                <AbilityOverlays
                    isEditing={false}
                    availableAbilityIds={[]}
                    canSelect={false}
                    canHighlight={false}
                    onSelectAbility={vi.fn()}
                    selectedAbilityId={undefined}
                    activatingAbilityId={undefined}
                    abilityLevels={{ 'fist-technique': 2 }}
                    characterId="monk"
                    locale="zh-CN"
                    onMagnifyCard={vi.fn()}
                    {...overrides}
                />
            </div>
        );
    };

    it('已放置升级卡在无主点击语义时可直接点击放大', () => {
        const onMagnifyCard = vi.fn();
        const { container } = renderAbilityOverlays({ onMagnifyCard });

        const fistSlot = container.querySelector('[data-ability-slot="fist"]');
        expect(fistSlot).not.toBeNull();

        fireEvent.click(fistSlot!);

        expect(onMagnifyCard).toHaveBeenCalledTimes(1);
        expect(onMagnifyCard.mock.calls[0]?.[0]).toMatchObject({ id: 'card-thrust-punch-2' });
    });

    it('可选技能槽位点击仍优先走选中逻辑', () => {
        const onSelectAbility = vi.fn();
        const onMagnifyCard = vi.fn();
        const { container } = renderAbilityOverlays({
            availableAbilityIds: ['fist-technique'],
            canSelect: true,
            onSelectAbility,
            onMagnifyCard,
        });

        const fistSlot = container.querySelector('[data-ability-slot="fist"]');
        expect(fistSlot).not.toBeNull();

        fireEvent.click(fistSlot!);

        expect(onSelectAbility).toHaveBeenCalledWith('fist-technique');
        expect(onMagnifyCard).not.toHaveBeenCalled();
    });

    it('桌面端可选升级槽位提供独立放大按钮，不抢占选中点击', () => {
        const onSelectAbility = vi.fn();
        const onMagnifyCard = vi.fn();
        const { container, getByTestId } = renderAbilityOverlays({
            availableAbilityIds: ['fist-technique'],
            canSelect: true,
            onSelectAbility,
            onMagnifyCard,
        });

        const fistSlot = container.querySelector('[data-ability-slot="fist"]');
        expect(fistSlot).not.toBeNull();

        fireEvent.click(getByTestId('dt-upgrade-magnify-button-fist'));

        expect(onMagnifyCard).toHaveBeenCalledTimes(1);
        expect(onMagnifyCard.mock.calls[0]?.[0]).toMatchObject({ id: 'card-thrust-punch-2' });
        expect(onSelectAbility).not.toHaveBeenCalled();
    });

    it('高亮但不可选时点击仍保留原提示逻辑，不会被放大吞掉', () => {
        const onHighlightedAbilityClick = vi.fn();
        const onMagnifyCard = vi.fn();
        const { container } = renderAbilityOverlays({
            availableAbilityIds: ['fist-technique'],
            canSelect: false,
            canHighlight: true,
            onHighlightedAbilityClick,
            onMagnifyCard,
        });

        const fistSlot = container.querySelector('[data-ability-slot="fist"]');
        expect(fistSlot).not.toBeNull();
        expect(fistSlot).toHaveAttribute('data-should-highlight', 'true');

        fireEvent.click(fistSlot!);

        expect(onHighlightedAbilityClick).toHaveBeenCalledTimes(1);
        expect(onMagnifyCard).not.toHaveBeenCalled();
    });

    it('高亮壳层保留统一描边结构，并用角色主题色的互补色提示可选技能', () => {
        const { getByTestId } = renderAbilityOverlays({
            availableAbilityIds: ['fist-technique'],
            canHighlight: true,
        });

        const highlight = getByTestId('dt-ability-highlight-fist');
        expect(highlight.className).toContain('inset-0');
        expect(highlight.className).toContain('rounded-lg');
        expect(highlight.className).toContain('animate-pulse');
        expect(highlight.style.borderWidth).toBe('2px');
        expect(highlight.style.borderColor).toBe('rgb(11, 98, 245)');
        expect(highlight.style.boxShadow).toContain('rgba(11,98,245,0.9)');
        expect(highlight.style.boxShadow).toContain('rgba(11,98,245,0.56)');
    });

    it('选中态描边会沿用角色色并比普通高亮更强一档', () => {
        const { getByTestId } = renderAbilityOverlays({
            availableAbilityIds: ['fist-technique'],
            canHighlight: true,
            selectedAbilityId: 'fist-technique',
        });

        const selected = getByTestId('dt-ability-selected-fist');
        expect(selected.className).toContain('rounded-lg');
        expect(selected.style.borderWidth).toBe('2.5px');
        expect(selected.style.borderColor).toBe('rgb(251, 191, 36)');
        expect(selected.style.boxShadow).toContain('rgba(251,191,36,0.96)');
    });

    it('咒缚海盗高亮改用撞色描边，避免与面板暖色混在一起', () => {
        const { getByTestId } = renderAbilityOverlays({
            characterId: 'cursed_pirate',
            playerBoardFace: 'normal',
            availableAbilityIds: ['merciless-plunder'],
            canHighlight: true,
            abilityLevels: {},
        });

        const highlight = getByTestId('dt-ability-highlight-ultimate');
        expect(highlight.className).toContain('rounded-lg');
        expect(highlight.style.borderWidth).toBe('2px');
        expect(highlight.style.borderColor).toBe('rgb(238, 61, 34)');
        expect(highlight.style.boxShadow).toContain('rgba(238,61,34,0.9)');
        expect(highlight.style.boxShadow).toContain('rgba(238,61,34,0.56)');
    });

    it('旧英雄切到 v2 玩家面板后，技能点击和升级叠图应按底图物理槽位录入', () => {
        const cases = [
            {
                characterId: 'monk',
                slotId: 'fist',
                baseAbilityId: 'fist-technique',
                resolvedAbilityId: 'fist-technique-2-3',
                abilityLevels: { 'fist-technique': 2 },
                upgradeCardId: 'card-thrust-punch-2',
                previewIndex: 12,
            },
            {
                characterId: 'monk',
                slotId: 'sky',
                baseAbilityId: 'taiji-combo',
                resolvedAbilityId: 'taiji-combo',
                abilityLevels: { 'taiji-combo': 2 },
                upgradeCardId: 'card-combo-punch-2',
                previewIndex: 9,
            },
            {
                characterId: 'monk',
                slotId: 'combo',
                baseAbilityId: 'harmony',
                resolvedAbilityId: 'harmony',
                abilityLevels: { harmony: 2 },
                upgradeCardId: 'card-mahayana-2',
                previewIndex: 11,
            },
            {
                characterId: 'monk',
                slotId: 'lightning',
                baseAbilityId: 'lotus-palm',
                resolvedAbilityId: 'lotus-palm',
                abilityLevels: { 'lotus-palm': 2 },
                upgradeCardId: 'card-lotus-bloom-2',
                previewIndex: 10,
            },
            {
                characterId: 'barbarian',
                slotId: 'lotus',
                baseAbilityId: 'suppress',
                resolvedAbilityId: 'suppress',
                abilityLevels: { suppress: 2 },
                upgradeCardId: 'card-suppress-2',
                previewIndex: 7,
            },
            {
                characterId: 'barbarian',
                slotId: 'lightning',
                baseAbilityId: 'violent-assault',
                resolvedAbilityId: 'violent-assault',
                abilityLevels: { 'violent-assault': 2 },
                upgradeCardId: 'card-violent-assault-2',
                previewIndex: 9,
            },
            {
                characterId: 'pyromancer',
                slotId: 'fist',
                baseAbilityId: 'fireball',
                resolvedAbilityId: 'fireball-2-3',
                abilityLevels: { fireball: 2 },
                upgradeCardId: 'card-fireball-2',
                previewIndex: 6,
            },
            {
                characterId: 'pyromancer',
                slotId: 'sky',
                baseAbilityId: 'pyro-blast',
                resolvedAbilityId: 'pyro-blast',
                abilityLevels: { 'pyro-blast': 2 },
                upgradeCardId: 'card-pyro-blast-2',
                previewIndex: 3,
            },
            {
                characterId: 'pyromancer',
                slotId: 'combo',
                baseAbilityId: 'fiery-combo',
                resolvedAbilityId: 'fiery-combo',
                abilityLevels: { 'fiery-combo': 2 },
                upgradeCardId: 'card-hot-streak-2',
                previewIndex: 14,
            },
            {
                characterId: 'pyromancer',
                slotId: 'lightning',
                baseAbilityId: 'meteor',
                resolvedAbilityId: 'meteor',
                abilityLevels: { meteor: 2 },
                upgradeCardId: 'card-meteor-2',
                previewIndex: 5,
            },
            {
                characterId: 'pyromancer',
                slotId: 'meditate',
                baseAbilityId: 'magma-armor',
                resolvedAbilityId: 'magma-armor',
                abilityLevels: { 'magma-armor': 2 },
                upgradeCardId: 'card-magma-armor-2',
                previewIndex: 0,
            },
            {
                characterId: 'moon_elf',
                slotId: 'sky',
                baseAbilityId: 'covering-fire',
                resolvedAbilityId: 'covering-fire',
                abilityLevels: { 'covering-fire': 2 },
                upgradeCardId: 'upgrade-covering-fire-2',
                previewIndex: 11,
            },
            {
                characterId: 'moon_elf',
                slotId: 'combo',
                baseAbilityId: 'entangling-shot',
                resolvedAbilityId: 'entangling-shot',
                abilityLevels: { 'entangling-shot': 2 },
                upgradeCardId: 'upgrade-entangling-shot-2',
                previewIndex: 8,
            },
            {
                characterId: 'shadow_thief',
                slotId: 'sky',
                baseAbilityId: 'steal',
                resolvedAbilityId: 'steal',
                abilityLevels: { steal: 2 },
                upgradeCardId: 'upgrade-steal-2',
                previewIndex: 11,
            },
            {
                characterId: 'shadow_thief',
                slotId: 'lightning',
                baseAbilityId: 'shadow-defense',
                resolvedAbilityId: 'shadow-defense',
                abilityLevels: { 'shadow-defense': 2 },
                upgradeCardId: 'upgrade-shadow-defense-2',
                previewIndex: 4,
            },
            {
                characterId: 'gunslinger',
                slotId: 'fist',
                baseAbilityId: 'revolver',
                resolvedAbilityId: 'revolver',
                abilityLevels: { revolver: 2 },
                upgradeCardId: 'upgrade-revolver-2',
                previewIndex: 18,
            },
            {
                characterId: 'gunslinger',
                slotId: 'chi',
                baseAbilityId: 'bounty-hunter',
                resolvedAbilityId: 'bounty-hunter',
                abilityLevels: { 'bounty-hunter': 2 },
                upgradeCardId: 'upgrade-bounty-hunter-2',
                previewIndex: 19,
            },
            {
                characterId: 'gunslinger',
                slotId: 'sky',
                baseAbilityId: 'showdown',
                resolvedAbilityId: 'showdown',
                abilityLevels: { showdown: 2 },
                upgradeCardId: 'upgrade-showdown-2',
                previewIndex: 20,
            },
            {
                characterId: 'gunslinger',
                slotId: 'sky',
                baseAbilityId: 'showdown',
                resolvedAbilityId: 'showdown',
                abilityLevels: { showdown: 3 },
                upgradeCardId: 'upgrade-showdown-3',
                previewIndex: 21,
                upgradeLevel: 3,
            },
            {
                characterId: 'gunslinger',
                slotId: 'combo',
                baseAbilityId: 'fan-the-hammer',
                resolvedAbilityId: 'fan-the-hammer',
                abilityLevels: { 'fan-the-hammer': 2 },
                upgradeCardId: 'upgrade-fan-the-hammer-2',
                previewIndex: 22,
            },
            {
                characterId: 'gunslinger',
                slotId: 'calm',
                baseAbilityId: 'take-cover',
                resolvedAbilityId: 'take-cover',
                abilityLevels: { 'take-cover': 2 },
                upgradeCardId: 'upgrade-take-cover-2',
                previewIndex: 23,
            },
            {
                characterId: 'gunslinger',
                slotId: 'lightning',
                baseAbilityId: 'deadeye',
                resolvedAbilityId: 'deadeye',
                abilityLevels: { deadeye: 2 },
                upgradeCardId: 'upgrade-deadeye-2',
                previewIndex: 24,
            },
            {
                characterId: 'gunslinger',
                slotId: 'meditate',
                baseAbilityId: 'duel',
                resolvedAbilityId: 'duel',
                abilityLevels: { duel: 2 },
                upgradeCardId: 'upgrade-duel-2',
                previewIndex: 25,
            },
            {
                characterId: 'gunslinger',
                slotId: 'lotus',
                baseAbilityId: 'quick-draw',
                resolvedAbilityId: 'quick-draw',
                abilityLevels: { 'quick-draw': 2 },
                upgradeCardId: 'upgrade-quick-draw',
                previewIndex: 26,
            },
            {
                characterId: 'paladin',
                slotId: 'fist',
                baseAbilityId: 'tithes',
                resolvedAbilityId: 'tithes',
                abilityLevels: { tithes: 2 },
                upgradeCardId: 'card-tithes-2',
                previewIndex: 6,
                canClick: false,
            },
            {
                characterId: 'paladin',
                slotId: 'meditate',
                baseAbilityId: 'holy-defense',
                resolvedAbilityId: 'holy-defense',
                abilityLevels: { 'holy-defense': 2 },
                upgradeCardId: 'card-holy-defense-2',
                previewIndex: 5,
            },
        ];

        for (const entry of cases) {
            const upgradeLevel = 'upgradeLevel' in entry ? entry.upgradeLevel : 2;
            const upgradeCard = getUpgradeCardForAbilityLevel(
                entry.characterId,
                entry.baseAbilityId,
                upgradeLevel,
            );
            expect(upgradeCard?.id, `${entry.characterId} 的升级牌应来自真实卡牌数据`).toBe(entry.upgradeCardId);
            expect(upgradeCard?.previewRef).toMatchObject({
                type: 'atlas',
                atlasId: `dicethrone:${entry.characterId}-cards`,
                index: entry.previewIndex,
            });

            const onSelectAbility = vi.fn();
            const { container, unmount } = renderAbilityOverlays({
                characterId: entry.characterId,
                availableAbilityIds: [entry.resolvedAbilityId],
                canSelect: true,
                onSelectAbility,
                abilityLevels: entry.abilityLevels,
            });

            const slot = container.querySelector(`[data-ability-slot="${entry.slotId}"]`);
            expect(slot, `${entry.characterId} 的 ${entry.baseAbilityId} 应落在 ${entry.slotId}`).not.toBeNull();
            expect(slot).toHaveAttribute('data-base-ability-id', entry.baseAbilityId);
            expect(slot).toHaveAttribute('data-resolved-ability-id', entry.resolvedAbilityId);
            const expectCanClick = entry.canClick ?? true;
            expect(slot).toHaveAttribute('data-can-click', expectCanClick ? 'true' : 'false');
            expect(slot?.querySelector('[data-testid="mock-card-preview"]')).toHaveAttribute(
                'data-atlas-id',
                `dicethrone:${entry.characterId}-cards`,
            );
            expect(slot?.querySelector('[data-testid="mock-card-preview"]')).toHaveAttribute(
                'data-preview-index',
                String(entry.previewIndex),
            );

            fireEvent.click(slot!);
            if (expectCanClick) {
                expect(onSelectAbility).toHaveBeenCalledWith(entry.resolvedAbilityId);
            } else {
                expect(onSelectAbility).not.toHaveBeenCalled();
            }
            unmount();
        }
    });

    it('旧英雄 v2 玩家面板应复用新英雄分栏坐标，只通过技能槽录入区分技能位置', () => {
        expect(getPlayerBoardLayoutVersion('pyromancer')).toBe('v2');
        expect(getPlayerBoardLayoutVersion('gunslinger')).toBe('v2');

        const oldHeroSlots = getAbilitySlotLayoutForCharacter('pyromancer');
        const fireballSlot = oldHeroSlots.find(slot => slot.id === 'combo');
        expect(fireballSlot).toMatchObject({ x: 67.67, y: 21.41, w: 16.02, h: 38.33 });

        const rightTopSlot = oldHeroSlots.find(slot => slot.id === 'sky');
        expect(rightTopSlot).toMatchObject({ x: 0.57, y: 59.55, w: 15.54, h: 38.57 });
    });

    it('Ninja v2 中间两列应把 shadow-step / smoke-screen 落到正确视觉槽位', () => {
        const { container } = renderAbilityOverlays({
            characterId: 'ninja',
            availableAbilityIds: ['shadow-step', 'smoke-screen'],
            canHighlight: true,
            abilityLevels: {},
        });

        const lotusSlot = container.querySelector('[data-ability-slot="lotus"]');
        const lightningSlot = container.querySelector('[data-ability-slot="lightning"]');

        expect(lotusSlot).toHaveAttribute('data-base-ability-id', 'smoke-screen');
        expect(lotusSlot).toHaveAttribute('data-resolved-ability-id', 'smoke-screen');
        expect(lightningSlot).toHaveAttribute('data-base-ability-id', 'shadow-step');
        expect(lightningSlot).toHaveAttribute('data-resolved-ability-id', 'shadow-step');
    });

    it('Ninja v2 只有烟雾阵时不应错误点亮暗影步槽', () => {
        const { container } = renderAbilityOverlays({
            characterId: 'ninja',
            availableAbilityIds: ['smoke-screen'],
            canHighlight: true,
            abilityLevels: {},
        });

        const lotusSlot = container.querySelector('[data-ability-slot="lotus"]');
        const lightningSlot = container.querySelector('[data-ability-slot="lightning"]');

        expect(lotusSlot).toHaveAttribute('data-resolved-ability-id', 'smoke-screen');
        expect(lightningSlot).toHaveAttribute('data-resolved-ability-id', '');
    });

    it('Ninja v2 只有暗影步时不应错误点亮烟雾阵槽', () => {
        const { container } = renderAbilityOverlays({
            characterId: 'ninja',
            availableAbilityIds: ['shadow-step'],
            canHighlight: true,
            abilityLevels: {},
        });

        const lotusSlot = container.querySelector('[data-ability-slot="lotus"]');
        const lightningSlot = container.querySelector('[data-ability-slot="lightning"]');

        expect(lotusSlot).toHaveAttribute('data-resolved-ability-id', '');
        expect(lightningSlot).toHaveAttribute('data-resolved-ability-id', 'shadow-step');
    });

    it('Ninja v2 升级暗影步分支应仍落在暗影步槽且可点击', () => {
        const onSelectAbility = vi.fn();
        const { container } = renderAbilityOverlays({
            characterId: 'ninja',
            availableAbilityIds: ['shadow-step-2-main', 'shadow-step-2-strangle'],
            canSelect: true,
            onSelectAbility,
            abilityLevels: { 'shadow-step': 2 },
        });

        const lightningSlot = container.querySelector('[data-ability-slot="lightning"]');
        expect(lightningSlot).toHaveAttribute('data-base-ability-id', 'shadow-step');
        expect(lightningSlot).toHaveAttribute('data-resolved-ability-id', 'shadow-step-2-main');
        expect(lightningSlot).toHaveAttribute('data-can-click', 'true');

        fireEvent.click(lightningSlot!);

        expect(onSelectAbility).toHaveBeenCalledWith('shadow-step-2-main');
    });

    it('咒缚海盗人类面应按 human 槽位映射解析技能', () => {
        const { container } = renderAbilityOverlays({
            characterId: 'cursed_pirate',
            playerBoardFace: 'normal',
            availableAbilityIds: ['light-the-fuse-small', 'verdict-command', 'merciless-plunder'],
            canHighlight: true,
            abilityLevels: {},
        });

        const comboSlot = container.querySelector('[data-ability-slot="combo"]');
        const lightningSlot = container.querySelector('[data-ability-slot="lightning"]');
        const ultimateSlot = container.querySelector('[data-ability-slot="ultimate"]');

        expect(comboSlot).toHaveAttribute('data-base-ability-id', 'light-the-fuse');
        expect(comboSlot).toHaveAttribute('data-resolved-ability-id', 'light-the-fuse-small');
        expect(lightningSlot).toHaveAttribute('data-base-ability-id', 'verdict-command');
        expect(lightningSlot).toHaveAttribute('data-resolved-ability-id', 'verdict-command');
        expect(ultimateSlot).toHaveAttribute('data-base-ability-id', 'merciless-plunder');
        expect(ultimateSlot).toHaveAttribute('data-resolved-ability-id', 'merciless-plunder');
        expect(ultimateSlot).toHaveAttribute('data-should-highlight', 'true');
    });

    it('咒缚海盗槽位查找应按当前面板面向区分人类面和诅咒面', () => {
        expect(getAbilitySlotIdForCharacter('cursed_pirate', 'verdict-command', 'normal')).toBe('lightning');
        expect(getAbilitySlotIdForCharacter('cursed_pirate', 'verdict-command', 'cursed')).toBeNull();
        expect(getAbilitySlotIdForCharacter('cursed_pirate', 'soul-command', 'normal')).toBeNull();
        expect(getAbilitySlotIdForCharacter('cursed_pirate', 'soul-command', 'cursed')).toBe('lightning');
    });

    it('旧英雄和新英雄槽位查找应与面板覆盖层使用同一物理槽位', () => {
        const cases = [
            { characterId: 'monk', abilityId: 'fist-technique', slotId: 'fist' },
            { characterId: 'monk', abilityId: 'taiji-combo', slotId: 'sky' },
            { characterId: 'monk', abilityId: 'harmony', slotId: 'combo' },
            { characterId: 'monk', abilityId: 'lotus-palm', slotId: 'lightning' },
            { characterId: 'barbarian', abilityId: 'slap', slotId: 'fist' },
            { characterId: 'barbarian', abilityId: 'suppress', slotId: 'lotus' },
            { characterId: 'barbarian', abilityId: 'violent-assault', slotId: 'lightning' },
            { characterId: 'pyromancer', abilityId: 'fireball', slotId: 'fist' },
            { characterId: 'pyromancer', abilityId: 'pyro-blast', slotId: 'sky' },
            { characterId: 'pyromancer', abilityId: 'fiery-combo', slotId: 'combo' },
            { characterId: 'pyromancer', abilityId: 'burn-down', slotId: 'lotus' },
            { characterId: 'pyromancer', abilityId: 'meteor', slotId: 'lightning' },
            { characterId: 'pyromancer', abilityId: 'magma-armor', slotId: 'meditate' },
            { characterId: 'moon_elf', abilityId: 'longbow', slotId: 'fist' },
            { characterId: 'moon_elf', abilityId: 'covering-fire', slotId: 'sky' },
            { characterId: 'moon_elf', abilityId: 'entangling-shot', slotId: 'combo' },
            { characterId: 'shadow_thief', abilityId: 'dagger-strike', slotId: 'fist' },
            { characterId: 'shadow_thief', abilityId: 'steal', slotId: 'sky' },
            { characterId: 'shadow_thief', abilityId: 'shadow-defense', slotId: 'lightning' },
            { characterId: 'gunslinger', abilityId: 'deadeye', slotId: 'lightning' },
            { characterId: 'gunslinger', abilityId: 'take-cover', slotId: 'calm' },
            { characterId: 'gunslinger', abilityId: 'fan-the-hammer', slotId: 'combo' },
            { characterId: 'paladin', abilityId: 'tithes', slotId: 'fist' },
            { characterId: 'paladin', abilityId: 'holy-light', slotId: 'calm' },
            { characterId: 'paladin', abilityId: 'holy-defense', slotId: 'meditate' },
            { characterId: 'treant', abilityId: 'wild-growth', slotId: 'lotus' },
            { characterId: 'treant', abilityId: 'vengeful-vines', slotId: 'combo' },
            { characterId: 'treant', abilityId: 'nature-touch', slotId: 'lightning' },
            { characterId: 'treant', abilityId: 'wild-roar', slotId: 'calm' },
            { characterId: 'zhanshujia', abilityId: 'strategic-shift', slotId: 'lightning' },
            { characterId: 'zhanshujia', abilityId: 'expand-battlefield', slotId: 'calm' },
            { characterId: 'artificer', abilityId: 'overclock', slotId: 'lightning' },
        ];

        for (const entry of cases) {
            expect(
                getAbilitySlotIdForCharacter(entry.characterId, entry.abilityId),
                `${entry.characterId} 的 ${entry.abilityId} 应落在 ${entry.slotId}`,
            ).toBe(entry.slotId);
        }
    });

    it('全部替换型升级牌应按玩家板图面合同覆盖同一物理槽位', () => {
        let checkedUpgradeCount = 0;
        for (const [characterId, cards] of Object.entries(HERO_CARDS_MAP)) {
            for (const card of cards) {
                if (card.type !== 'upgrade') continue;
                for (const effect of card.effects ?? []) {
                    const action = effect.action;
                    if (action?.type !== 'replaceAbility') continue;

                    const abilityId = action.targetAbilityId;
                    const expectedSlotId = getAbilitySlotIdForCharacter(characterId, abilityId);
                    expect(
                        expectedSlotId,
                        `${characterId} 的升级牌 ${card.id} -> ${abilityId} 必须命中玩家板图面物理槽`,
                    ).toBeTruthy();
                    expect(
                        getSlotAbilityId(characterId, expectedSlotId!),
                        `${characterId} 的升级牌 ${card.id} 应覆盖 ${expectedSlotId} 物理槽`,
                    ).toBe(abilityId);
                    expect(
                        getAbilitySlotIdForCharacter(characterId, abilityId),
                        `${characterId} 的升级牌 ${card.id} 点击/高亮反查应回到同一物理槽`,
                    ).toBe(expectedSlotId);
                    checkedUpgradeCount += 1;
                }
            }
        }
        expect(checkedUpgradeCount).toBe(118);
    });

    it('技能槽 DOM 应区分主面板和放大预览，避免升级卡飞错目标', () => {
        const { container, rerender } = renderAbilityOverlays();
        expect(container.querySelector('[data-ability-slot="fist"]')).toHaveAttribute(
            'data-ability-slot-scope',
            'main-board',
        );

        rerender(
            <div style={{ position: 'relative', width: 1200, height: 900 }}>
                <AbilityOverlays
                    isEditing={false}
                    availableAbilityIds={[]}
                    canSelect={false}
                    canHighlight={false}
                    onSelectAbility={vi.fn()}
                    abilityLevels={{ 'fist-technique': 2 }}
                    characterId="monk"
                    locale="zh-CN"
                    onMagnifyCard={vi.fn()}
                    slotScope="magnified-preview"
                />
            </div>
        );

        expect(container.querySelector('[data-ability-slot="fist"]')).toHaveAttribute(
            'data-ability-slot-scope',
            'magnified-preview',
        );
    });

});
