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
