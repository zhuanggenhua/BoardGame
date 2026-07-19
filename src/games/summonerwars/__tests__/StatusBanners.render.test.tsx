import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RandomFn } from '../../../engine/types';
import { StatusBanners } from '../ui/StatusBanners';
import { createInitializedCore } from './test-helpers';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          'actions.moguFanaticalFungusStay': '不推拉',
          'actions.skip': '跳过',
          'statusBanners.ability.moguFanaticalFungus': '狂热菌菇：选择不推拉或推拉落点',
          'interaction.sw.shourenBloodyRushPosition': '血腥急袭：点棋盘高亮格移动该单位并受到 1 点伤害；跳过则留在原位',
          'interaction.sw.shourenBerserkPosition': '狂暴：点棋盘高亮格推拉冰苔斗士；跳过则不移动',
          'interaction.sw.shourenBruteImpact': '蛮力冲击：点棋盘高亮格把目标推离攻击者；跳过则不推',
          'interaction.sw.shourenPrimalFuryPosition': '原始狂怒：点棋盘高亮格移动格鲁纳克；跳过则不移动',
        };
        return translations[key] ?? key;
      },
    }),
  };
});

function testRandom(): RandomFn {
  return {
    shuffle: <T,>(array: T[]) => array,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max * 0.5) || 1,
    range: (min: number, max: number) => Math.floor(min + (max - min) * 0.5),
  };
}

function makeProps(
  overrides: Partial<React.ComponentProps<typeof StatusBanners>> = {},
): React.ComponentProps<typeof StatusBanners> {
  const noop = vi.fn();
  return {
    currentPhase: 'move',
    isMyTurn: true,
    core: createInitializedCore(['0', '1'], testRandom(), { faction0: 'mogu', faction1: 'necromancer' }),
    abilityMode: null,
    fireSacrificeSummonMode: null,
    onCancelFireSacrifice: noop,
    bloodSummonMode: null,
    annihilateMode: null,
    soulTransferMode: null,
    funeralPyreMode: null,
    mindControlMode: null,
    chantEntanglementMode: null,
    moguSymbioticSelfHealingMode: null,
    moguReleaseSporesMode: null,
    sneakMode: null,
    glacialShiftMode: null,
    withdrawMode: null,
    stunMode: null,
    hypnoticLureMode: null,
    mindCaptureMode: null,
    afterAttackAbilityMode: null,
    rapidFireMode: null,
    telekinesisTargetMode: null,
    magicEventChoiceMode: null,
    eventTargetMode: null,
    systemGrabFollowMode: false,
    systemFeedBeastMode: false,
    systemMoguParasiteMode: false,
    onCancelAbility: noop,
    onConfirmBeforeAttackCards: noop,
    onConfirmBloodRune: noop,
    onSkipGrabFollow: noop,
    onConfirmFeedBeastSelfDestroy: noop,
    onConfirmMoguParasite: noop,
    onCancelBeforeAttack: noop,
    onCancelBloodSummon: noop,
    onContinueBloodSummon: noop,
    onCancelAnnihilate: noop,
    onConfirmAnnihilateTargets: noop,
    onSkipAnnihilateDamage: noop,
    onConfirmSoulTransfer: noop,
    onSkipSoulTransfer: noop,
    onSkipFuneralPyre: noop,
    onConfirmMindControl: noop,
    onCancelMindControl: noop,
    onConfirmEntanglement: noop,
    onCancelEntanglement: noop,
    onConfirmMoguSymbioticSelfHealing: noop,
    onSkipMoguSymbioticSelfHealing: noop,
    onConfirmMoguReleaseSpores: noop,
    onSkipMoguReleaseSpores: noop,
    onConfirmSneak: noop,
    onCancelSneak: noop,
    onConfirmGlacialShift: noop,
    onCancelGlacialShift: noop,
    onWithdrawCostSelect: noop,
    onCancelWithdraw: noop,
    onCancelStun: noop,
    onCancelHypnoticLure: noop,
    onConfirmMindCapture: noop,
    onCancelAfterAttackAbility: noop,
    onConfirmRapidFire: noop,
    onCancelRapidFire: noop,
    onCancelTelekinesis: noop,
    onAfterMoveSelfCharge: noop,
    onSystemAbilityChoice: noop,
    onPlayMagicEvent: noop,
    onDiscardMagicEvent: noop,
    onCancelMagicEventChoice: noop,
    onCancelEventTargetInteraction: noop,
    ...overrides,
  };
}

describe('StatusBanners - 莫古狂热菌菇', () => {
  it('不推拉按钮应提交 stay，跳过按钮仍跳过整个效果', () => {
    const onSystemAbilityChoice = vi.fn();
    const onCancelAbility = vi.fn();

    render(
      <StatusBanners
        {...makeProps({
          abilityMode: {
            abilityId: 'mogu_fanatical_fungus',
            step: 'selectPosition',
            sourceUnitId: 'mogu-fungus-target-1',
            targetPosition: { row: 4, col: 3 },
            systemChoiceOptions: [
              { id: 'stay', labelKey: 'actions.moguFanaticalFungusStay' },
              { id: 'skip', labelKey: 'actions.skip' },
            ],
          },
          onSystemAbilityChoice,
          onCancelAbility,
        })}
      />,
    );

    expect(screen.getByText('狂热菌菇：选择不推拉或推拉落点')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '不推拉' }));
    expect(onSystemAbilityChoice).toHaveBeenCalledWith('stay');
    expect(onCancelAbility).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '跳过' }));
    expect(onCancelAbility).toHaveBeenCalledTimes(1);
  });
});

describe('StatusBanners - 冰苔兽人可选位移', () => {
  it.each([
    ['shouren_bloody_rush', '血腥急袭：点棋盘高亮格移动该单位并受到 1 点伤害；跳过则留在原位'],
    ['shouren_berserk', '狂暴：点棋盘高亮格推拉冰苔斗士；跳过则不移动'],
    ['shouren_brute_impact', '蛮力冲击：点棋盘高亮格把目标推离攻击者；跳过则不推'],
    ['shouren_primal_fury', '原始狂怒：点棋盘高亮格移动格鲁纳克；跳过则不移动'],
  ])('%s 应显示能力说明、点击后果和跳过按钮', (abilityId, bannerText) => {
    const onCancelAbility = vi.fn();

    render(
      <StatusBanners
        {...makeProps({
          abilityMode: {
            abilityId,
            step: 'selectPosition',
            sourceUnitId: `${abilityId}-source`,
          },
          onCancelAbility,
        })}
      />,
    );

    const prompt = screen.getByTestId('sw-ability-prompt');
    expect(screen.getByText(bannerText)).toBeInTheDocument();
    expect(prompt.textContent).toContain('跳过');
    expect(prompt.textContent).not.toBe('跳过');

    fireEvent.click(screen.getByRole('button', { name: '跳过' }));
    expect(onCancelAbility).toHaveBeenCalledTimes(1);
  });
});
