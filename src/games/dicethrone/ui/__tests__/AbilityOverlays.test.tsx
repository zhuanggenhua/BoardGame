import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AbilityOverlays } from '../AbilityOverlays';
import { getAbilitySlotLayoutForCharacter, getPlayerBoardLayoutVersion } from '../abilitySlotLayout';
import { getUpgradeCardForAbilityLevel } from '../abilityOverlayHelpers';
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

        const fistSlot = container.querySelector('[data-ability-slot="calm"]');
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

        const fistSlot = container.querySelector('[data-ability-slot="calm"]');
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

        const fistSlot = container.querySelector('[data-ability-slot="calm"]');
        expect(fistSlot).not.toBeNull();

        fireEvent.click(getByTestId('dt-upgrade-magnify-button-calm'));

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

        const fistSlot = container.querySelector('[data-ability-slot="calm"]');
        expect(fistSlot).not.toBeNull();
        expect(fistSlot).toHaveAttribute('data-should-highlight', 'true');

        fireEvent.click(fistSlot!);

        expect(onHighlightedAbilityClick).toHaveBeenCalledTimes(1);
        expect(onMagnifyCard).not.toHaveBeenCalled();
    });

    it('高亮壳层保留统一描边结构，并为角色注入对应颜色', () => {
        const { getByTestId } = renderAbilityOverlays({
            availableAbilityIds: ['fist-technique'],
            canHighlight: true,
        });

        const highlight = getByTestId('dt-ability-highlight-calm');
        expect(highlight.className).toContain('inset-0');
        expect(highlight.className).toContain('rounded-lg');
        expect(highlight.className).toContain('animate-pulse');
        expect(highlight.style.borderWidth).toBe('2px');
        expect(highlight.style.borderColor).toBe('rgb(245, 158, 11)');
        expect(highlight.style.boxShadow).toContain('rgba(245,158,11,0.92)');
    });

    it('选中态描边会沿用角色色并比普通高亮更强一档', () => {
        const { getByTestId } = renderAbilityOverlays({
            availableAbilityIds: ['fist-technique'],
            canHighlight: true,
            selectedAbilityId: 'fist-technique',
        });

        const selected = getByTestId('dt-ability-selected-calm');
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
        expect(highlight.style.borderColor).toBe('rgb(34, 211, 238)');
        expect(highlight.style.boxShadow).toContain('rgba(34,211,238,0.94)');
    });

    it('旧英雄切到 v2 玩家面板后，技能点击和升级叠图应按重新录入的技能槽位同源', () => {
        const cases = [
            {
                characterId: 'monk',
                slotId: 'calm',
                baseAbilityId: 'fist-technique',
                resolvedAbilityId: 'fist-technique-2-3',
                abilityLevels: { 'fist-technique': 2 },
                upgradeCardId: 'card-thrust-punch-2',
                previewIndex: 12,
            },
            {
                characterId: 'barbarian',
                slotId: 'meditate',
                baseAbilityId: 'slap',
                resolvedAbilityId: 'slap-2-3',
                abilityLevels: { slap: 2 },
                upgradeCardId: 'card-slap-2',
                previewIndex: 14,
            },
            {
                characterId: 'pyromancer',
                slotId: 'combo',
                baseAbilityId: 'fireball',
                resolvedAbilityId: 'fireball-2-3',
                abilityLevels: { fireball: 2 },
                upgradeCardId: 'card-fireball-2',
                previewIndex: 6,
            },
            {
                characterId: 'moon_elf',
                slotId: 'meditate',
                baseAbilityId: 'longbow',
                resolvedAbilityId: 'longbow-3-2',
                abilityLevels: { longbow: 2 },
                upgradeCardId: 'upgrade-longbow-2',
                previewIndex: 14,
            },
            {
                characterId: 'shadow_thief',
                slotId: 'lotus',
                baseAbilityId: 'dagger-strike',
                resolvedAbilityId: 'dagger-strike-3-2',
                abilityLevels: { 'dagger-strike': 2 },
                upgradeCardId: 'upgrade-dagger-strike-2',
                previewIndex: 7,
            },
            {
                characterId: 'paladin',
                slotId: 'chi',
                baseAbilityId: 'holy-light',
                resolvedAbilityId: 'holy-light',
                abilityLevels: { 'holy-light': 2 },
                upgradeCardId: 'card-holy-light-2',
                previewIndex: 7,
            },
        ];

        for (const entry of cases) {
            const upgradeCard = getUpgradeCardForAbilityLevel(entry.characterId, entry.baseAbilityId, 2);
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
            expect(slot).toHaveAttribute('data-can-click', 'true');
            expect(slot?.querySelector('[data-testid="mock-card-preview"]')).toHaveAttribute(
                'data-atlas-id',
                `dicethrone:${entry.characterId}-cards`,
            );
            expect(slot?.querySelector('[data-testid="mock-card-preview"]')).toHaveAttribute(
                'data-preview-index',
                String(entry.previewIndex),
            );

            fireEvent.click(slot!);
            expect(onSelectAbility).toHaveBeenCalledWith(entry.resolvedAbilityId);
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
            { characterId: 'monk', abilityId: 'fist-technique', slotId: 'calm' },
            { characterId: 'barbarian', abilityId: 'slap', slotId: 'meditate' },
            { characterId: 'pyromancer', abilityId: 'fireball', slotId: 'combo' },
            { characterId: 'moon_elf', abilityId: 'longbow', slotId: 'meditate' },
            { characterId: 'shadow_thief', abilityId: 'dagger-strike', slotId: 'lotus' },
            { characterId: 'paladin', abilityId: 'holy-light', slotId: 'chi' },
            { characterId: 'zhanshujia', abilityId: 'strategic-shift', slotId: 'calm' },
            { characterId: 'artificer', abilityId: 'overclock', slotId: 'lightning' },
        ];

        for (const entry of cases) {
            expect(
                getAbilitySlotIdForCharacter(entry.characterId, entry.abilityId),
                `${entry.characterId} 的 ${entry.abilityId} 应落在 ${entry.slotId}`,
            ).toBe(entry.slotId);
        }
    });

    it('技能槽 DOM 应区分主面板和放大预览，避免升级卡飞错目标', () => {
        const { container, rerender } = renderAbilityOverlays();
        expect(container.querySelector('[data-ability-slot="calm"]')).toHaveAttribute(
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

        expect(container.querySelector('[data-ability-slot="calm"]')).toHaveAttribute(
            'data-ability-slot-scope',
            'magnified-preview',
        );
    });

});
