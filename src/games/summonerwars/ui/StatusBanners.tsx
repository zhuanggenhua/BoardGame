/**
 * 召唤师战争 - 顶部状态横幅
 * 
 * 显示当前交互模式的提示信息和操作按钮
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GamePhase, CellCoord } from '../domain/types';
import { GameButton } from './GameButton';
import { ActionBanner } from './ActionBanner';
import type { AbilityModeState, SoulTransferModeState, MindCaptureModeState, AfterAttackAbilityModeState } from './useGameEvents';
import type { MindControlModeState, StunModeState, HypnoticLureModeState } from './useCellInteraction';

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

interface PendingBeforeAttack {
  abilityId: 'life_drain' | 'holy_arrow' | 'healing';
  sourceUnitId: string;
  targetUnitId?: string;
  targetCardId?: string;
  discardCardIds?: string[];
}

// ============================================================================
// Props
// ============================================================================

interface StatusBannersProps {
  currentPhase: GamePhase;
  isMyTurn: boolean;
  // 模式状态
  abilityMode: AbilityModeState | null;
  pendingBeforeAttack: PendingBeforeAttack | null;
  bloodSummonMode: BloodSummonModeState | null;
  annihilateMode: AnnihilateModeState | null;
  soulTransferMode: SoulTransferModeState | null;
  funeralPyreMode: FuneralPyreModeState | null;
  mindControlMode: MindControlModeState | null;
  stunMode: StunModeState | null;
  hypnoticLureMode: HypnoticLureModeState | null;
  mindCaptureMode: MindCaptureModeState | null;
  afterAttackAbilityMode: AfterAttackAbilityModeState | null;
  telekinesisTargetMode: { abilityId: string; targetPosition: CellCoord } | null;
  // 回调
  onCancelAbility: () => void;
  onConfirmBeforeAttackCards: () => void;
  onCancelBeforeAttack: () => void;
  onCancelBloodSummon: () => void;
  onContinueBloodSummon: () => void;
  onCancelAnnihilate: () => void;
  onConfirmAnnihilateTargets: () => void;
  onConfirmSoulTransfer: () => void;
  onSkipSoulTransfer: () => void;
  onSkipFuneralPyre: () => void;
  onConfirmMindControl: () => void;
  onCancelMindControl: () => void;
  onConfirmStun: (direction: 'push' | 'pull', distance: number) => void;
  onCancelStun: () => void;
  onCancelHypnoticLure: () => void;
  onConfirmMindCapture: (choice: 'control' | 'damage') => void;
  onCancelAfterAttackAbility: () => void;
  onConfirmTelekinesis: (direction: 'push' | 'pull') => void;
  onCancelTelekinesis: () => void;
}

// ============================================================================
// 震慑方向选择子组件
// ============================================================================

const StunBanner: React.FC<{
  stunMode: StunModeState;
  onConfirmStun: (direction: 'push' | 'pull', distance: number) => void;
  onCancelStun: () => void;
}> = ({ stunMode, onConfirmStun, onCancelStun }) => {
  const { t } = useTranslation('game-summonerwars');
  const [direction, setDirection] = React.useState<'push' | 'pull'>('push');
  const [distance, setDistance] = React.useState(1);

  if (stunMode.step === 'selectTarget') {
    return (
      <div className="bg-yellow-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-yellow-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-yellow-200 text-sm font-bold">
          {t('statusBanners.stun.selectTarget')}
        </span>
        <GameButton onClick={onCancelStun} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  // selectDirection 步骤
  return (
    <div className="bg-yellow-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-yellow-500/40 flex items-center gap-3 shadow-lg">
      <span className="text-yellow-200 text-sm font-bold">{t('statusBanners.stun.direction')}</span>
      <div className="flex gap-1">
        <GameButton
          onClick={() => setDirection('push')}
          variant={direction === 'push' ? 'primary' : 'secondary'}
          size="sm"
        >{t('actions.push')}</GameButton>
        <GameButton
          onClick={() => setDirection('pull')}
          variant={direction === 'pull' ? 'primary' : 'secondary'}
          size="sm"
        >{t('actions.pull')}</GameButton>
      </div>
      <span className="text-yellow-200 text-sm font-bold">{t('statusBanners.stun.distance')}</span>
      <div className="flex gap-1">
        {[1, 2, 3].map(d => (
          <GameButton
            key={d}
            onClick={() => setDistance(d)}
            variant={distance === d ? 'primary' : 'secondary'}
            size="sm"
          >{d}</GameButton>
        ))}
      </div>
      <GameButton onClick={() => onConfirmStun(direction, distance)} variant="primary" size="sm">{t('actions.confirm')}</GameButton>
      <GameButton onClick={onCancelStun} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
    </div>
  );
};

// ============================================================================
// 组件
// ============================================================================

export const StatusBanners: React.FC<StatusBannersProps> = ({
  currentPhase, isMyTurn,
  abilityMode, pendingBeforeAttack, bloodSummonMode, annihilateMode, soulTransferMode, funeralPyreMode,
  mindControlMode, stunMode, hypnoticLureMode,
  mindCaptureMode, afterAttackAbilityMode, telekinesisTargetMode,
  onCancelAbility, onConfirmBeforeAttackCards, onCancelBeforeAttack, onCancelBloodSummon, onContinueBloodSummon,
  onCancelAnnihilate, onConfirmAnnihilateTargets,
  onConfirmSoulTransfer, onSkipSoulTransfer, onSkipFuneralPyre,
  onConfirmMindControl, onCancelMindControl,
  onConfirmStun, onCancelStun,
  onCancelHypnoticLure,
  onConfirmMindCapture, onCancelAfterAttackAbility,
  onConfirmTelekinesis, onCancelTelekinesis,
}) => {
  const { t } = useTranslation('game-summonerwars');
  if (abilityMode) {
    return (
      <div className="bg-amber-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-amber-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-amber-200 text-sm font-bold">
          {abilityMode.abilityId === 'revive_undead' && abilityMode.step === 'selectCard' && t('statusBanners.ability.reviveUndead.selectCard')}
          {abilityMode.abilityId === 'revive_undead' && abilityMode.step === 'selectPosition' && t('statusBanners.ability.reviveUndead.selectPosition')}
          {abilityMode.abilityId === 'fire_sacrifice_summon' && t('statusBanners.ability.fireSacrificeSummon')}
          {abilityMode.abilityId === 'life_drain' && t('statusBanners.ability.lifeDrain')}
          {abilityMode.abilityId === 'infection' && abilityMode.step === 'selectCard' && t('statusBanners.ability.infection.selectCard')}
          {abilityMode.abilityId === 'infection' && abilityMode.step === 'selectPosition' && t('statusBanners.ability.infection.selectPosition')}
          {abilityMode.abilityId === 'holy_arrow' && abilityMode.step === 'selectCards' && t('statusBanners.ability.holyArrow.selectCards')}
          {abilityMode.abilityId === 'healing' && abilityMode.step === 'selectCards' && t('statusBanners.ability.healing.selectCards')}
        </span>
        {abilityMode.step === 'selectCards' && (
          <GameButton onClick={onConfirmBeforeAttackCards} variant="primary" size="sm">{t('actions.confirmDiscard')}</GameButton>
        )}
        <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (pendingBeforeAttack) {
    return (
      <div className="bg-amber-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-amber-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-amber-200 text-sm font-bold">
          {pendingBeforeAttack.abilityId === 'life_drain' && t('statusBanners.beforeAttack.lifeDrain')}
          {pendingBeforeAttack.abilityId === 'holy_arrow' && t('statusBanners.beforeAttack.holyArrow')}
          {pendingBeforeAttack.abilityId === 'healing' && t('statusBanners.beforeAttack.healing')}
        </span>
        <GameButton onClick={onCancelBeforeAttack} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (bloodSummonMode) {
    return (
      <div className="bg-rose-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-rose-500/40 flex items-center gap-3 shadow-lg">
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
      <div className="bg-purple-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-purple-200 text-sm font-bold">
          {annihilateMode.step === 'selectTargets' && t('statusBanners.annihilate.selectTargets', { count: annihilateMode.selectedTargets.length })}
          {annihilateMode.step === 'selectDamageTarget' && t('statusBanners.annihilate.selectDamageTarget', { index: annihilateMode.currentTargetIndex + 1 })}
        </span>
        {annihilateMode.step === 'selectTargets' && annihilateMode.selectedTargets.length > 0 && (
          <GameButton onClick={onConfirmAnnihilateTargets} variant="primary" size="sm">{t('actions.confirmSelection')}</GameButton>
        )}
        <GameButton onClick={onCancelAnnihilate} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (soulTransferMode) {
    return (
      <div className="bg-cyan-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-cyan-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-cyan-200 text-sm font-bold">{t('statusBanners.soulTransfer.message')}</span>
        <GameButton onClick={onConfirmSoulTransfer} variant="primary" size="sm">{t('actions.confirmMove')}</GameButton>
        <GameButton onClick={onSkipSoulTransfer} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  if (funeralPyreMode) {
    return (
      <div className="bg-orange-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-orange-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-orange-200 text-sm font-bold">
          {t('statusBanners.funeralPyre.message', { charges: funeralPyreMode.charges })}
        </span>
        <GameButton onClick={onSkipFuneralPyre} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  if (mindControlMode) {
    return (
      <div className="bg-cyan-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-cyan-500/40 flex items-center gap-3 shadow-lg">
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

  if (stunMode) {
    return (
      <StunBanner
        stunMode={stunMode}
        onConfirmStun={onConfirmStun}
        onCancelStun={onCancelStun}
      />
    );
  }

  if (hypnoticLureMode) {
    return (
      <div className="bg-pink-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-pink-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-pink-200 text-sm font-bold">
          {t('statusBanners.hypnoticLure.message')}
        </span>
        <GameButton onClick={onCancelHypnoticLure} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (mindCaptureMode) {
    return (
      <div className="bg-indigo-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-indigo-500/40 flex items-center gap-3 shadow-lg">
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
      <div className="bg-teal-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-teal-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-teal-200 text-sm font-bold">
          {t('statusBanners.telekinesis.message', { ability: abilityName })}
        </span>
        <GameButton onClick={() => onConfirmTelekinesis('push')} variant="primary" size="sm">{t('actions.push')}</GameButton>
        <GameButton onClick={() => onConfirmTelekinesis('pull')} variant="secondary" size="sm">{t('actions.pull')}</GameButton>
        <GameButton onClick={onCancelTelekinesis} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (afterAttackAbilityMode) {
    const abilityName = t(`statusBanners.abilityNames.${afterAttackAbilityMode.abilityId}`);
    return (
      <div className="bg-teal-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-teal-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-teal-200 text-sm font-bold">
          {t('statusBanners.afterAttack.message', { ability: abilityName })}
        </span>
        <GameButton onClick={onCancelAfterAttackAbility} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  return <ActionBanner phase={currentPhase} isMyTurn={isMyTurn} />;
};
