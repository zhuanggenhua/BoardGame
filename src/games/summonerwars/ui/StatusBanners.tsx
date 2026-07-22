/**
 * 召唤师战争 - 顶部状态横幅
 * 
 * 显示当前交互模式的提示信息和操作按钮
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GamePhase, CellCoord } from '../domain/types';
import { normalizeUnitBoosts } from '../domain/helpers';
import { GameButton } from './GameButton';
import { ActionBanner } from './ActionBanner';
import type { AbilityModeState, SoulTransferModeState, MindCaptureModeState, AfterAttackAbilityModeState } from './useGameEvents';
import { getAbilityModeBannerFallbackText } from './statusBannerText';
import type {
  MindControlModeState,
  StunModeState,
  HypnoticLureModeState,
  ChantEntanglementModeState,
  MoguSymbioticSelfHealingModeState,
  MoguReleaseSporesModeState,
  SneakModeState,
  GlacialShiftModeState,
  WithdrawModeState,
  TelekinesisTargetModeState,
} from './modeTypes';

// ============================================================================
// 类型定义
// ============================================================================

/** 血契召唤模式状态 */
export interface BloodSummonModeState {
  step: 'selectTarget' | 'selectCard' | 'selectPosition' | 'confirm';
  cardId?: string;
  targetPosition?: CellCoord;
  summonCardId?: string;
  completedCount?: number;
}

/** 除灭模式状态 */
export interface AnnihilateModeState {
  step: 'selectTargets' | 'selectDamageTarget' | 'confirm';
  cardId: string;
  selectedTargets: CellCoord[];
  currentTargetIndex: number;
  damageTargets: (CellCoord | null)[];
}

/** 殉葬火堆模式状态 */
export interface FuneralPyreModeState {
  cardId: string;
  charges: number;
}

// ============================================================================
// Props
// ============================================================================

interface StatusBannersProps {
  currentPhase: GamePhase;
  isMyTurn: boolean;
  core: import('../domain/types').SummonerWarsCore; // 添加 core 用于检查单位状态
  // 模式状态
  abilityMode: AbilityModeState | null;
  fireSacrificeSummonMode: { handCardId: string } | null;
  onCancelFireSacrifice: () => void;
  bloodSummonMode: BloodSummonModeState | null;
  annihilateMode: AnnihilateModeState | null;
  soulTransferMode: SoulTransferModeState | null;
  funeralPyreMode: FuneralPyreModeState | null;
  mindControlMode: MindControlModeState | null;
  chantEntanglementMode: ChantEntanglementModeState | null;
  moguSymbioticSelfHealingMode: MoguSymbioticSelfHealingModeState | null;
  moguReleaseSporesMode: MoguReleaseSporesModeState | null;
  sneakMode: SneakModeState | null;
  glacialShiftMode: GlacialShiftModeState | null;
  withdrawMode: WithdrawModeState | null;
  stunMode: StunModeState | null;
  hypnoticLureMode: HypnoticLureModeState | null;
  mindCaptureMode: MindCaptureModeState | null;
  afterAttackAbilityMode: AfterAttackAbilityModeState | null;
  rapidFireMode: import('./modeTypes').RapidFireModeState | null;
  telekinesisTargetMode: TelekinesisTargetModeState | null;
  magicEventChoiceMode: { cardId: string } | null;
  eventTargetMode: { cardId: string } | null;
  systemGrabFollowMode: boolean;
  systemFeedBeastMode: boolean;
  systemMoguParasiteMode: boolean;
  // 回调
  onCancelAbility: () => void;
  onConfirmBeforeAttackCards: () => void;
  onConfirmBloodRune: (choice: 'damage' | 'charge') => void;
  onSkipGrabFollow: () => void;
  onConfirmFeedBeastSelfDestroy: () => void;
  onConfirmMoguParasite: (choice: 'consume_charge' | 'take_damage') => void;
  onCancelBeforeAttack: () => void;
  onCancelBloodSummon: () => void;
  onContinueBloodSummon: () => void;
  onCancelAnnihilate: () => void;
  onConfirmAnnihilateTargets: () => void;
  onSkipAnnihilateDamage: () => void;
  onConfirmSoulTransfer: () => void;
  onSkipSoulTransfer: () => void;
  onSkipFuneralPyre: () => void;
  onConfirmMindControl: () => void;
  onCancelMindControl: () => void;
  onConfirmEntanglement: () => void;
  onCancelEntanglement: () => void;
  onConfirmMoguSymbioticSelfHealing: () => void;
  onSkipMoguSymbioticSelfHealing: () => void;
  onConfirmMoguReleaseSpores: () => void;
  onSkipMoguReleaseSpores: () => void;
  onConfirmSneak: () => void;
  onCancelSneak: () => void;
  onConfirmGlacialShift: () => void;
  onCancelGlacialShift: () => void;
  onWithdrawCostSelect: (costType: 'charge' | 'magic') => void;
  onCancelWithdraw: () => void;
  onCancelStun: () => void;
  onCancelHypnoticLure: () => void;
  onConfirmMindCapture: (choice: 'control' | 'damage') => void;
  onCancelAfterAttackAbility: () => void;
  onConfirmRapidFire: () => void;
  onCancelRapidFire: () => void;
  onCancelTelekinesis: () => void;
  onAfterMoveSelfCharge: () => void;
  onSystemAbilityChoice: (choice: string) => void;
  onPlayMagicEvent: () => void;
  onDiscardMagicEvent: () => void;
  onCancelMagicEventChoice: () => void;
  onCancelEventTargetInteraction: () => void;
}

// ============================================================================
// 震慑方向选择子组件
// ============================================================================

const StunBanner: React.FC<{
  stunMode: StunModeState;
  onCancelStun: () => void;
}> = ({ stunMode, onCancelStun }) => {
  const { t } = useTranslation('game-summonerwars');

  if (stunMode.step === 'selectTarget') {
    return (
      <div data-testid="sw-ability-prompt" className="bg-yellow-900/95 px-4 py-2 rounded-lg border border-yellow-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-yellow-200 text-sm font-bold">
          {t('statusBanners.stun.selectTarget')}
        </span>
        <GameButton onClick={onCancelStun} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  // selectDestination 步骤：提示选择终点
  return (
    <div data-testid="sw-ability-prompt" className="bg-yellow-900/95 px-4 py-2 rounded-lg border border-yellow-500/40 flex items-center gap-3 shadow-lg">
      <span className="text-yellow-200 text-sm font-bold">{t('statusBanners.stun.selectDestination')}</span>
      <GameButton onClick={onCancelStun} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
    </div>
  );
};

const YONGHENG_BUTTON_CHOICE_ABILITIES = [
  'yongheng_draw',
  'yongheng_continuance',
] as const;

const YONGHENG_DIRECT_HAND_CARD_ABILITIES = [
  'yongheng_warning',
  'yongheng_application',
  'yongheng_arouse_fear',
  'yongheng_punish',
] as const;

const YONGHENG_SYSTEM_ABILITY_IDS = [
  ...YONGHENG_BUTTON_CHOICE_ABILITIES,
  'yongheng_mental_invasion',
  'yongheng_collision',
  ...YONGHENG_DIRECT_HAND_CARD_ABILITIES,
] as const;

// ============================================================================
// 组件
// ============================================================================

export const StatusBanners: React.FC<StatusBannersProps> = ({
  currentPhase, isMyTurn, core,
  abilityMode, fireSacrificeSummonMode, onCancelFireSacrifice, bloodSummonMode, annihilateMode, soulTransferMode, funeralPyreMode,
  mindControlMode, chantEntanglementMode, moguSymbioticSelfHealingMode, moguReleaseSporesMode, sneakMode, glacialShiftMode, withdrawMode, stunMode, hypnoticLureMode,
  mindCaptureMode, afterAttackAbilityMode, rapidFireMode, telekinesisTargetMode, magicEventChoiceMode,
  eventTargetMode,
  systemGrabFollowMode, systemFeedBeastMode, systemMoguParasiteMode,
  onCancelAbility, onConfirmBeforeAttackCards, onConfirmBloodRune, onSkipGrabFollow, onConfirmFeedBeastSelfDestroy, onConfirmMoguParasite,
  onCancelBeforeAttack, onCancelBloodSummon, onContinueBloodSummon,
  onCancelAnnihilate, onConfirmAnnihilateTargets, onSkipAnnihilateDamage,
  onConfirmSoulTransfer, onSkipSoulTransfer, onSkipFuneralPyre,
  onConfirmMindControl, onCancelMindControl,
  onConfirmEntanglement, onCancelEntanglement,
  onConfirmMoguSymbioticSelfHealing, onSkipMoguSymbioticSelfHealing,
  onConfirmMoguReleaseSpores, onSkipMoguReleaseSpores,
  onConfirmSneak, onCancelSneak,
  onConfirmGlacialShift, onCancelGlacialShift,
  onWithdrawCostSelect, onCancelWithdraw,
  onCancelStun,
  onCancelHypnoticLure,
  onConfirmMindCapture, onCancelAfterAttackAbility,
  onConfirmRapidFire, onCancelRapidFire,
  onCancelTelekinesis,
  onAfterMoveSelfCharge,
  onSystemAbilityChoice,
  onPlayMagicEvent, onDiscardMagicEvent, onCancelMagicEventChoice,
  onCancelEventTargetInteraction,
}) => {
  const { t } = useTranslation('game-summonerwars');

  // 魔力阶段事件卡选择模式优先级最高
  if (magicEventChoiceMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-purple-900/95 px-4 py-2 rounded-lg border border-purple-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-purple-200 text-sm font-bold">
          {t('statusBanners.magicEventChoice.message')}
        </span>
        <GameButton onClick={onPlayMagicEvent} variant="primary" size="sm">{t('actions.playEvent')}</GameButton>
        <GameButton onClick={onDiscardMagicEvent} variant="secondary" size="sm">{t('actions.discardForMagic')}</GameButton>
        <GameButton onClick={onCancelMagicEventChoice} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (eventTargetMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-purple-900/95 px-4 py-2 rounded-lg border border-purple-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-purple-200 text-sm font-bold">
          {t('statusBanners.eventTarget.message')}
        </span>
        <GameButton onClick={onCancelEventTargetInteraction} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (systemGrabFollowMode) {
    return (
      <div
        data-testid="sw-ability-prompt"
        className="bg-amber-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-amber-500/40 flex items-center gap-3 shadow-lg"
      >
        <span className="text-amber-200 text-sm font-bold">
          {t('interaction.sw.grabFollow')}
        </span>
        <GameButton onClick={onSkipGrabFollow} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  // 获取源单位的充能数（用于检查按钮是否应该禁用）
  let sourceUnitBoosts = 0;
  if (abilityMode?.sourceUnitId && core.board) {
    outerLoop: for (let row = 0; row < core.board.length; row++) {
      for (let col = 0; col < (core.board[0]?.length ?? 0); col++) {
        const unit = core.board[row]?.[col]?.unit;
        if (unit && unit.instanceId === abilityMode.sourceUnitId) {
          sourceUnitBoosts = normalizeUnitBoosts(unit.boosts);
          break outerLoop;
        }
      }
    }
  }

  if (fireSacrificeSummonMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-red-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-red-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-red-200 text-sm font-bold">
          {t('statusBanners.ability.fireSacrificeSummon')}
        </span>
        <GameButton onClick={onCancelFireSacrifice} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (abilityMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-amber-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-amber-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-amber-200 text-sm font-bold">
          {abilityMode.abilityId === 'revive_undead' && abilityMode.step === 'selectCard' && t('statusBanners.ability.reviveUndead.selectCard')}
          {abilityMode.abilityId === 'revive_undead' && abilityMode.step === 'selectPosition' && t('statusBanners.ability.reviveUndead.selectPosition')}
          {abilityMode.abilityId === 'life_drain' && t('statusBanners.ability.lifeDrain')}
          {abilityMode.abilityId === 'holy_arrow' && abilityMode.step === 'selectCards' && t('statusBanners.ability.holyArrow.selectCards')}
          {abilityMode.abilityId === 'healing' && abilityMode.step === 'selectCards' && t('statusBanners.ability.healing.selectCards')}
          {abilityMode.abilityId === 'illusion' && t('statusBanners.ability.illusion')}
          {abilityMode.abilityId === 'blood_rune' && t('statusBanners.ability.bloodRune')}
          {abilityMode.abilityId === 'spirit_bond' && (
            sourceUnitBoosts < 1
              ? t('statusBanners.ability.spiritBondChargeOnly')
              : t('statusBanners.ability.spiritBond')
          )}
          {abilityMode.abilityId === 'ancestral_bond' && t('statusBanners.ability.ancestralBond')}
          {abilityMode.abilityId === 'structure_shift' && t('statusBanners.ability.structureShift')}
          {abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectUnit' && t('statusBanners.ability.iceRamSelectTarget')}
          {abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection' && t('statusBanners.ability.iceRamSelectPush')}
          {abilityMode.abilityId === 'frost_axe' && (
            sourceUnitBoosts < 1
              ? t('statusBanners.ability.frostAxeChargeOnly')
              : t('statusBanners.ability.frostAxe')
          )}
          {abilityMode.abilityId === 'mogu_transmission' && t('statusBanners.ability.moguTransmission')}
          {abilityMode.abilityId === 'mogu_fanatical_fungus' && t('statusBanners.ability.moguFanaticalFungus')}
          {getAbilityModeBannerFallbackText(t, abilityMode)}
          {abilityMode.abilityId === 'vanish' && t('statusBanners.ability.vanish')}
        </span>
        {abilityMode.step === 'selectCards' && !YONGHENG_DIRECT_HAND_CARD_ABILITIES.includes(abilityMode.abilityId as never) && (
          <>
            <GameButton
              onClick={onConfirmBeforeAttackCards}
              variant="primary"
              size="sm"
              disabled={!abilityMode.selectedCardIds || abilityMode.selectedCardIds.length === 0}
            >
              {t('actions.confirmDiscard')}
            </GameButton>
            {abilityMode.context === 'beforeAttack' && (
              <GameButton onClick={onCancelBeforeAttack} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
            )}
          </>
        )}
        {abilityMode.step === 'selectChoice' && YONGHENG_BUTTON_CHOICE_ABILITIES.includes(abilityMode.abilityId as never) && (
          <>
            {(abilityMode.systemChoiceOptions ?? []).map((option) => (
              <GameButton
                key={option.id}
                onClick={() => onSystemAbilityChoice(option.id)}
                variant={option.id === 'confirm' ? 'primary' : 'secondary'}
                size="sm"
              >
                {option.labelKey ? t(option.labelKey) : option.label ?? option.id}
              </GameButton>
            ))}
          </>
        )}
        {abilityMode.abilityId === 'blood_rune' && (
          <>
            <GameButton onClick={() => onConfirmBloodRune('damage')} variant="secondary" size="sm">{t('actions.bloodRuneDamage')}</GameButton>
            <GameButton 
              onClick={() => onConfirmBloodRune('charge')} 
              variant="primary" 
              size="sm"
              disabled={core.players[core.currentPlayer].magic < 1}
              title={core.players[core.currentPlayer].magic < 1 ? t('statusBanners.insufficientMagic') : undefined}
            >
              {t('actions.bloodRuneCharge')}
            </GameButton>
          </>
        )}
        {(abilityMode.abilityId === 'spirit_bond' || abilityMode.abilityId === 'frost_axe') && (
          <GameButton onClick={onAfterMoveSelfCharge} variant="primary" size="sm">{t('actions.chargeSelf')}</GameButton>
        )}
        {abilityMode.abilityId === 'mogu_transmission' && abilityMode.systemStep === 'selectMode' && (
          <>
            {(abilityMode.systemChoiceOptions ?? [])
              .filter((option) => option.id === 'self_to_target' || option.id === 'target_to_target')
              .map((option, index) => (
                <GameButton key={option.id} onClick={() => onSystemAbilityChoice(option.id)} variant={index === 0 ? 'primary' : 'secondary'} size="sm">
                  {option.labelKey ? t(option.labelKey) : option.label ?? option.id}
                </GameButton>
              ))}
          </>
        )}
        {abilityMode.abilityId === 'mogu_transmission' && abilityMode.systemStep === 'selectAmount' && (
          <>
            {(abilityMode.systemChoiceOptions ?? [])
              .filter((option) => option.id.startsWith('amount:'))
              .map((option) => (
              <GameButton key={option.id} onClick={() => onSystemAbilityChoice(option.id)} variant="primary" size="sm">
                {option.labelKey ? t(option.labelKey) : option.label ?? option.id.replace('amount:', '')}
              </GameButton>
            ))}
          </>
        )}
        {abilityMode.abilityId === 'mogu_fanatical_fungus' && (
          <>
            {(abilityMode.systemChoiceOptions ?? [])
              .filter((option) => option.id === 'stay')
              .map((option) => (
                <GameButton key={option.id} onClick={() => onSystemAbilityChoice(option.id)} variant="primary" size="sm">
                  {option.labelKey ? t(option.labelKey) : option.label ?? option.id}
                </GameButton>
              ))}
          </>
        )}
        {[
          'spirit_bond',
          'ancestral_bond',
          'structure_shift',
          'frost_axe',
          'mogu_transmission',
          'mogu_fanatical_fungus',
          'huijin_call_guards',
          'huijin_ram',
          'huijin_quick_shot',
          'shouren_bloody_rush',
          'shouren_berserk',
          'shouren_brute_impact',
          'shouren_primal_fury',
          'yongheng_mental_invasion',
          'yongheng_collision',
          'yongheng_warning',
          'yongheng_application',
          'yongheng_arouse_fear',
          'yongheng_punish',
        ].includes(abilityMode.abilityId) && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
        )}
        {abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectUnit' && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
        )}
        {abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection' && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.skipPush')}</GameButton>
        )}
        {/* life_drain 在 beforeAttack 上下文中显示"跳过"按钮 */}
        {abilityMode.abilityId === 'life_drain' && abilityMode.context === 'beforeAttack' && abilityMode.step === 'selectUnit' && (
          <GameButton onClick={onCancelBeforeAttack} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
        )}
        {![
          'blood_rune',
          'spirit_bond',
          'ancestral_bond',
          'structure_shift',
          'frost_axe',
          'mogu_transmission',
          'mogu_fanatical_fungus',
          'huijin_call_guards',
          'huijin_ram',
          'huijin_quick_shot',
          'shouren_bloody_rush',
          'shouren_berserk',
          'shouren_brute_impact',
          'shouren_primal_fury',
          'vanish',
          'ice_ram',
          'life_drain',
          ...YONGHENG_SYSTEM_ABILITY_IDS,
        ].includes(abilityMode.abilityId) && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
        )}
        {/* life_drain 在非 beforeAttack 上下文中显示"取消"按钮 */}
        {abilityMode.abilityId === 'life_drain' && abilityMode.context !== 'beforeAttack' && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
        )}
      </div>
    );
  }

  if (systemFeedBeastMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-amber-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-amber-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-amber-200 text-sm font-bold">
          {t('statusBanners.ability.feedBeast')}
        </span>
        <GameButton onClick={onConfirmFeedBeastSelfDestroy} variant="secondary" size="sm">{t('actions.feedBeastSelfDestroy')}</GameButton>
      </div>
    );
  }

  if (systemMoguParasiteMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-amber-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-amber-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-amber-200 text-sm font-bold">
          {t('statusBanners.ability.moguParasite')}
        </span>
        <GameButton onClick={() => onConfirmMoguParasite('consume_charge')} variant="primary" size="sm">{t('actions.moguParasiteConsumeCharge')}</GameButton>
        <GameButton onClick={() => onConfirmMoguParasite('take_damage')} variant="secondary" size="sm">{t('actions.moguParasiteTakeDamage')}</GameButton>
      </div>
    );
  }

  if (bloodSummonMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-rose-900/95 px-4 py-2 rounded-lg border border-rose-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-rose-200 text-sm font-bold">
          {bloodSummonMode.step === 'selectTarget' && t('statusBanners.bloodSummon.selectTarget')}
          {bloodSummonMode.step === 'selectCard' && t('statusBanners.bloodSummon.selectCard')}
          {bloodSummonMode.step === 'selectPosition' && t('statusBanners.bloodSummon.selectPosition')}
          {bloodSummonMode.step === 'confirm' && t('statusBanners.bloodSummon.confirm', { count: bloodSummonMode.completedCount ?? 1 })}
        </span>
        {bloodSummonMode.step === 'confirm' ? (
          <>
            <GameButton onClick={onContinueBloodSummon} variant="primary" size="sm">{t('actions.continue')}</GameButton>
            <GameButton onClick={onCancelBloodSummon} variant="secondary" size="sm">{t('actions.finish')}</GameButton>
          </>
        ) : (
          <GameButton onClick={onCancelBloodSummon} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
        )}
      </div>
    );
  }

  if (annihilateMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-purple-900/95 px-4 py-2 rounded-lg border border-purple-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-purple-200 text-sm font-bold">
          {annihilateMode.step === 'selectTargets' && t('statusBanners.annihilate.selectTargets', { count: annihilateMode.selectedTargets.length })}
          {annihilateMode.step === 'selectDamageTarget' && t('statusBanners.annihilate.selectDamageTarget', { index: annihilateMode.currentTargetIndex + 1 })}
        </span>
        {annihilateMode.step === 'selectTargets' && annihilateMode.selectedTargets.length > 0 && (
          <GameButton onClick={onConfirmAnnihilateTargets} variant="primary" size="sm">{t('actions.confirmSelection')}</GameButton>
        )}
        {annihilateMode.step === 'selectDamageTarget' && (
          <GameButton onClick={onSkipAnnihilateDamage} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
        )}
        <GameButton onClick={onCancelAnnihilate} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (soulTransferMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-cyan-900/95 px-4 py-2 rounded-lg border border-cyan-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-cyan-200 text-sm font-bold">{t('statusBanners.soulTransfer.message')}</span>
        <GameButton onClick={onConfirmSoulTransfer} variant="primary" size="sm">{t('actions.confirmMove')}</GameButton>
        <GameButton onClick={onSkipSoulTransfer} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  if (funeralPyreMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-orange-900/95 px-4 py-2 rounded-lg border border-orange-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-orange-200 text-sm font-bold">
          {t('statusBanners.funeralPyre.message', { charges: funeralPyreMode.charges })}
        </span>
        <GameButton onClick={onSkipFuneralPyre} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  if (mindControlMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-cyan-900/95 px-4 py-2 rounded-lg border border-cyan-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-cyan-200 text-sm font-bold">
          {t('statusBanners.mindControl.message', { count: mindControlMode.selectedTargets.length })}
        </span>
        {mindControlMode.selectedTargets.length > 0 && (
          <GameButton onClick={onConfirmMindControl} variant="primary" size="sm">{t('actions.confirmControl')}</GameButton>
        )}
        <GameButton onClick={onCancelMindControl} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (chantEntanglementMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-emerald-900/95 px-4 py-2 rounded-lg border border-emerald-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-emerald-200 text-sm font-bold">
          {t('statusBanners.entanglement.message', { count: chantEntanglementMode.selectedTargets.length })}
        </span>
        {chantEntanglementMode.selectedTargets.length >= 2 && (
          <GameButton onClick={onConfirmEntanglement} variant="primary" size="sm">{t('actions.confirmSelection')}</GameButton>
        )}
        <GameButton onClick={onCancelEntanglement} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (moguSymbioticSelfHealingMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-fuchsia-950/95 px-4 py-2 rounded-lg border border-fuchsia-400/40 flex items-center gap-3 shadow-lg">
        <span className="text-fuchsia-100 text-sm font-bold">
          {t('statusBanners.moguSymbioticSelfHealing.message', { count: moguSymbioticSelfHealingMode.selectedTargets.length })}
        </span>
        {moguSymbioticSelfHealingMode.selectedTargets.length > 0 && (
          <GameButton onClick={onConfirmMoguSymbioticSelfHealing} variant="primary" size="sm">{t('actions.confirmSelection')}</GameButton>
        )}
        <GameButton onClick={onSkipMoguSymbioticSelfHealing} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  if (moguReleaseSporesMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-lime-950/95 px-4 py-2 rounded-lg border border-lime-400/40 flex items-center gap-3 shadow-lg">
        <span className="text-lime-100 text-sm font-bold">
          {t('statusBanners.moguReleaseSpores.message', { count: moguReleaseSporesMode.selectedTargets.length })}
        </span>
        {moguReleaseSporesMode.selectedTargets.length > 0 && (
          <GameButton onClick={onConfirmMoguReleaseSpores} variant="primary" size="sm">{t('actions.confirmSelection')}</GameButton>
        )}
        <GameButton onClick={onSkipMoguReleaseSpores} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  if (sneakMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-lime-900/95 px-4 py-2 rounded-lg border border-lime-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-lime-200 text-sm font-bold">
          {sneakMode.step === 'selectUnit'
            ? t('statusBanners.sneak.selectUnit', { count: sneakMode.recorded.length })
            : t('statusBanners.sneak.selectDirection')}
        </span>
        {sneakMode.recorded.length > 0 && sneakMode.step === 'selectUnit' && (
          <GameButton onClick={onConfirmSneak} variant="primary" size="sm">{t('actions.confirmSelection')}</GameButton>
        )}
        <GameButton onClick={onCancelSneak} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (glacialShiftMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-sky-900/95 px-4 py-2 rounded-lg border border-sky-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-sky-200 text-sm font-bold">
          {glacialShiftMode.step === 'selectBuilding'
            ? t('statusBanners.glacialShift.selectBuilding', { count: glacialShiftMode.recorded.length })
            : t('statusBanners.glacialShift.selectDestination')}
        </span>
        {glacialShiftMode.recorded.length > 0 && glacialShiftMode.step === 'selectBuilding' && (
          <GameButton onClick={onConfirmGlacialShift} variant="primary" size="sm">{t('actions.confirmSelection')}</GameButton>
        )}
        <GameButton onClick={onCancelGlacialShift} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (withdrawMode) {
    // 获取源单位的充能数和玩家魔力
    let withdrawUnitBoosts = 0;
    withdrawSearch: for (let row = 0; row < core.board.length; row++) {
      for (let col = 0; col < (core.board[0]?.length ?? 0); col++) {
        const unit = core.board[row]?.[col]?.unit;
        if (unit && unit.instanceId === withdrawMode.sourceUnitId) {
          withdrawUnitBoosts = normalizeUnitBoosts(unit.boosts);
          break withdrawSearch;
        }
      }
    }
    const playerMagic = core.players[core.currentPlayer].magic;

    return (
      <div
        data-testid="sw-ability-prompt"
        className="bg-amber-900/95 px-4 py-2 rounded-lg border border-amber-500/40 flex items-center gap-3 shadow-lg"
      >
        <span className="text-amber-200 text-sm font-bold">
          {withdrawMode.step === 'selectCost'
            ? t('statusBanners.withdraw.selectCost')
            : t('statusBanners.withdraw.selectPosition')}
        </span>
        {withdrawMode.step === 'selectCost' && (
          <>
            <GameButton 
              onClick={() => onWithdrawCostSelect('charge')} 
              variant="primary" 
              size="sm"
              disabled={withdrawUnitBoosts < 1}
              title={withdrawUnitBoosts < 1 ? t('statusBanners.insufficientCharge') : undefined}
            >
              {t('actions.withdrawCharge')}
            </GameButton>
            <GameButton 
              onClick={() => onWithdrawCostSelect('magic')} 
              variant="secondary" 
              size="sm"
              disabled={playerMagic < 1}
              title={playerMagic < 1 ? t('statusBanners.insufficientMagic') : undefined}
            >
              {t('actions.withdrawMagic')}
            </GameButton>
          </>
        )}
        <GameButton onClick={onCancelWithdraw} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (stunMode) {
    return (
      <StunBanner
        stunMode={stunMode}
        onCancelStun={onCancelStun}
      />
    );
  }

  if (hypnoticLureMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-pink-900/95 px-4 py-2 rounded-lg border border-pink-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-pink-200 text-sm font-bold">
          {t('statusBanners.hypnoticLure.message')}
        </span>
        <GameButton onClick={onCancelHypnoticLure} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (mindCaptureMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-indigo-900/95 px-4 py-2 rounded-lg border border-indigo-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-indigo-200 text-sm font-bold">
          {t('statusBanners.mindCapture.message', { hits: mindCaptureMode.hits })}
        </span>
        <GameButton onClick={() => onConfirmMindCapture('control')} variant="primary" size="sm">{t('actions.control')}</GameButton>
        <GameButton onClick={() => onConfirmMindCapture('damage')} variant="secondary" size="sm">{t('actions.damage')}</GameButton>
      </div>
    );
  }

  if (telekinesisTargetMode) {
    const abilityName = t(`statusBanners.abilityNames.${telekinesisTargetMode.abilityId}`);
    return (
      <div data-testid="sw-ability-prompt" className="bg-teal-900/95 px-4 py-2 rounded-lg border border-teal-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-teal-200 text-sm font-bold">
          {t('statusBanners.telekinesis.selectDestination', { ability: abilityName })}
        </span>
        <GameButton onClick={onCancelTelekinesis} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (afterAttackAbilityMode) {
    const abilityName = t(`statusBanners.abilityNames.${afterAttackAbilityMode.abilityId}`);
    return (
      <div data-testid="sw-ability-prompt" className="bg-teal-900/90 px-4 py-2 rounded-lg border border-teal-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-teal-200 text-sm font-bold">
          {t('statusBanners.afterAttack.message', { ability: abilityName })}
        </span>
        <GameButton onClick={onCancelAfterAttackAbility} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  if (rapidFireMode) {
    return (
      <div data-testid="sw-ability-prompt" className="bg-orange-900/90 px-4 py-2 rounded-lg border border-orange-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-orange-200 text-sm font-bold">
          {t('statusBanners.rapidFire.message')}
        </span>
        <GameButton onClick={onConfirmRapidFire} variant="primary" size="sm">{t('statusBanners.rapidFire.confirm')}</GameButton>
        <GameButton onClick={onCancelRapidFire} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  return <ActionBanner phase={currentPhase} isMyTurn={isMyTurn} />;
};
