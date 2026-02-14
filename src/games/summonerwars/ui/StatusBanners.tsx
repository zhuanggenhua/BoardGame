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
import type { MindControlModeState, StunModeState, HypnoticLureModeState, ChantEntanglementModeState, SneakModeState, GlacialShiftModeState, WithdrawModeState } from './modeTypes';

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
  core: import('../domain/types').SummonerWarsCore; // 添加 core 用于检查单位状态
  // 模式状态
  abilityMode: AbilityModeState | null;
  pendingBeforeAttack: PendingBeforeAttack | null;
  bloodSummonMode: BloodSummonModeState | null;
  annihilateMode: AnnihilateModeState | null;
  soulTransferMode: SoulTransferModeState | null;
  funeralPyreMode: FuneralPyreModeState | null;
  mindControlMode: MindControlModeState | null;
  chantEntanglementMode: ChantEntanglementModeState | null;
  sneakMode: SneakModeState | null;
  glacialShiftMode: GlacialShiftModeState | null;
  withdrawMode: WithdrawModeState | null;
  stunMode: StunModeState | null;
  hypnoticLureMode: HypnoticLureModeState | null;
  mindCaptureMode: MindCaptureModeState | null;
  afterAttackAbilityMode: AfterAttackAbilityModeState | null;
  rapidFireMode: import('./modeTypes').RapidFireModeState | null;
  telekinesisTargetMode: { abilityId: string; targetPosition: CellCoord } | null;
  // 回调
  onCancelAbility: () => void;
  onConfirmBeforeAttackCards: () => void;
  onConfirmBloodRune: (choice: 'damage' | 'charge') => void;
  onConfirmIceShards: () => void;
  onConfirmFeedBeastSelfDestroy: () => void;
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
  onConfirmSneak: () => void;
  onCancelSneak: () => void;
  onConfirmGlacialShift: () => void;
  onCancelGlacialShift: () => void;
  onWithdrawCostSelect: (costType: 'charge' | 'magic') => void;
  onCancelWithdraw: () => void;
  onConfirmStun: (direction: 'push' | 'pull', distance: number) => void;
  onCancelStun: () => void;
  onCancelHypnoticLure: () => void;
  onConfirmMindCapture: (choice: 'control' | 'damage') => void;
  onCancelAfterAttackAbility: () => void;
  onConfirmRapidFire: () => void;
  onCancelRapidFire: () => void;
  onConfirmTelekinesis: (direction: 'push' | 'pull') => void;
  onCancelTelekinesis: () => void;
  onAfterMoveSelfCharge: () => void;
  onFrostAxeAttach?: () => void;
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
      <div className="bg-yellow-900/95 px-4 py-2 rounded-lg border border-yellow-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-yellow-200 text-sm font-bold">
          {t('statusBanners.stun.selectTarget')}
        </span>
        <GameButton onClick={onCancelStun} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  // selectDirection 步骤
  return (
    <div className="bg-yellow-900/95 px-4 py-2 rounded-lg border border-yellow-500/40 flex items-center gap-3 shadow-lg">
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
  currentPhase, isMyTurn, core,
  abilityMode, pendingBeforeAttack, bloodSummonMode, annihilateMode, soulTransferMode, funeralPyreMode,
  mindControlMode, chantEntanglementMode, sneakMode, glacialShiftMode, withdrawMode, stunMode, hypnoticLureMode,
  mindCaptureMode, afterAttackAbilityMode, rapidFireMode, telekinesisTargetMode,
  onCancelAbility, onConfirmBeforeAttackCards, onConfirmBloodRune, onConfirmIceShards, onConfirmFeedBeastSelfDestroy,
  onCancelBeforeAttack, onCancelBloodSummon, onContinueBloodSummon,
  onCancelAnnihilate, onConfirmAnnihilateTargets, onSkipAnnihilateDamage,
  onConfirmSoulTransfer, onSkipSoulTransfer, onSkipFuneralPyre,
  onConfirmMindControl, onCancelMindControl,
  onConfirmEntanglement, onCancelEntanglement,
  onConfirmSneak, onCancelSneak,
  onConfirmGlacialShift, onCancelGlacialShift,
  onWithdrawCostSelect, onCancelWithdraw,
  onConfirmStun, onCancelStun,
  onCancelHypnoticLure,
  onConfirmMindCapture, onCancelAfterAttackAbility,
  onConfirmRapidFire, onCancelRapidFire,
  onConfirmTelekinesis, onCancelTelekinesis,
  onAfterMoveSelfCharge,
  onFrostAxeAttach,
}) => {
  const { t } = useTranslation('game-summonerwars');

  // 获取源单位的充能数（用于检查按钮是否应该禁用）
  let sourceUnitBoosts = 0;
  if (abilityMode?.sourceUnitId && core.board) {
    outerLoop: for (let row = 0; row < core.board.length; row++) {
      for (let col = 0; col < (core.board[0]?.length ?? 0); col++) {
        const unit = core.board[row]?.[col]?.unit;
        if (unit && unit.cardId === abilityMode.sourceUnitId) {
          sourceUnitBoosts = unit.boosts ?? 0;
          break outerLoop;
        }
      }
    }
  }

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
          {abilityMode.abilityId === 'illusion' && t('statusBanners.ability.illusion')}
          {abilityMode.abilityId === 'blood_rune' && t('statusBanners.ability.bloodRune')}
          {abilityMode.abilityId === 'ice_shards' && t('statusBanners.ability.iceShards')}
          {abilityMode.abilityId === 'feed_beast' && t('statusBanners.ability.feedBeast')}
          {abilityMode.abilityId === 'spirit_bond' && t('statusBanners.ability.spiritBond')}
          {abilityMode.abilityId === 'ancestral_bond' && t('statusBanners.ability.ancestralBond')}
          {abilityMode.abilityId === 'structure_shift' && t('statusBanners.ability.structureShift')}
          {abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectUnit' && t('statusBanners.ability.iceRamSelectTarget', '寒冰冲撞：选择建筑相邻的一个单位')}
          {abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection' && t('statusBanners.ability.iceRamSelectPush', '寒冰冲撞：选择推拉方向（或跳过）')}
          {abilityMode.abilityId === 'frost_axe' && abilityMode.step !== 'selectAttachTarget' && t('statusBanners.ability.frostAxe')}
          {abilityMode.abilityId === 'frost_axe' && abilityMode.step === 'selectAttachTarget' && t('statusBanners.ability.frostAxeSelectTarget')}
          {abilityMode.abilityId === 'vanish' && t('statusBanners.ability.vanish')}
        </span>
        {abilityMode.step === 'selectCards' && (
          <GameButton onClick={onConfirmBeforeAttackCards} variant="primary" size="sm">{t('actions.confirmDiscard')}</GameButton>
        )}
        {abilityMode.abilityId === 'blood_rune' && (
          <>
            <GameButton onClick={() => onConfirmBloodRune('damage')} variant="secondary" size="sm">{t('actions.bloodRuneDamage')}</GameButton>
            <GameButton 
              onClick={() => onConfirmBloodRune('charge')} 
              variant="primary" 
              size="sm"
              disabled={core.players[core.currentPlayer].magic < 1}
              title={core.players[core.currentPlayer].magic < 1 ? '魔力不足' : undefined}
            >
              {t('actions.bloodRuneCharge')}
            </GameButton>
          </>
        )}
        {abilityMode.abilityId === 'ice_shards' && (
          <>
            <GameButton 
              onClick={onConfirmIceShards} 
              variant="primary" 
              size="sm"
              disabled={sourceUnitBoosts < 1}
              title={sourceUnitBoosts < 1 ? '需要至少1点充能' : undefined}
            >
              {t('actions.confirm')}
            </GameButton>
            <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
          </>
        )}
        {abilityMode.abilityId === 'feed_beast' && (
          <GameButton onClick={onConfirmFeedBeastSelfDestroy} variant="secondary" size="sm">{t('actions.feedBeastSelfDestroy')}</GameButton>
        )}
        {(abilityMode.abilityId === 'spirit_bond' || (abilityMode.abilityId === 'frost_axe' && abilityMode.step !== 'selectAttachTarget')) && (
          <GameButton onClick={onAfterMoveSelfCharge} variant="primary" size="sm">{t('actions.chargeSelf')}</GameButton>
        )}
        {abilityMode.abilityId === 'frost_axe' && abilityMode.step !== 'selectAttachTarget' && (
          <GameButton 
            onClick={onFrostAxeAttach} 
            variant="primary" 
            size="sm"
            disabled={sourceUnitBoosts < 1}
            title={sourceUnitBoosts < 1 ? '需要至少1点充能' : undefined}
          >
            {t('actions.attachToSoldier')}
          </GameButton>
        )}
        {['spirit_bond', 'ancestral_bond', 'structure_shift'].includes(abilityMode.abilityId) && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
        )}
        {abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectUnit' && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
        )}
        {abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection' && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.skipPush', '跳过推拉')}</GameButton>
        )}
        {abilityMode.abilityId === 'frost_axe' && abilityMode.step !== 'selectAttachTarget' && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
        )}
        {abilityMode.abilityId === 'frost_axe' && abilityMode.step === 'selectAttachTarget' && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
        )}
        {!['blood_rune', 'ice_shards', 'feed_beast', 'spirit_bond', 'ancestral_bond', 'structure_shift', 'frost_axe', 'vanish', 'ice_ram'].includes(abilityMode.abilityId) && (
          <GameButton onClick={onCancelAbility} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
        )}
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
      <div className="bg-rose-900/95 px-4 py-2 rounded-lg border border-rose-500/40 flex items-center gap-3 shadow-lg">
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
      <div className="bg-purple-900/95 px-4 py-2 rounded-lg border border-purple-500/40 flex items-center gap-3 shadow-lg">
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
      <div className="bg-cyan-900/95 px-4 py-2 rounded-lg border border-cyan-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-cyan-200 text-sm font-bold">{t('statusBanners.soulTransfer.message')}</span>
        <GameButton onClick={onConfirmSoulTransfer} variant="primary" size="sm">{t('actions.confirmMove')}</GameButton>
        <GameButton onClick={onSkipSoulTransfer} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  if (funeralPyreMode) {
    return (
      <div className="bg-orange-900/95 px-4 py-2 rounded-lg border border-orange-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-orange-200 text-sm font-bold">
          {t('statusBanners.funeralPyre.message', { charges: funeralPyreMode.charges })}
        </span>
        <GameButton onClick={onSkipFuneralPyre} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  if (mindControlMode) {
    return (
      <div className="bg-cyan-900/95 px-4 py-2 rounded-lg border border-cyan-500/40 flex items-center gap-3 shadow-lg">
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
      <div className="bg-emerald-900/95 px-4 py-2 rounded-lg border border-emerald-500/40 flex items-center gap-3 shadow-lg">
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

  if (sneakMode) {
    return (
      <div className="bg-lime-900/95 px-4 py-2 rounded-lg border border-lime-500/40 flex items-center gap-3 shadow-lg">
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
      <div className="bg-sky-900/95 px-4 py-2 rounded-lg border border-sky-500/40 flex items-center gap-3 shadow-lg">
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
        if (unit && unit.cardId === withdrawMode.sourceUnitId) {
          withdrawUnitBoosts = unit.boosts ?? 0;
          break withdrawSearch;
        }
      }
    }
    const playerMagic = core.players[core.currentPlayer].magic;

    return (
      <div className="bg-amber-900/95 px-4 py-2 rounded-lg border border-amber-500/40 flex items-center gap-3 shadow-lg">
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
              title={withdrawUnitBoosts < 1 ? '需要至少1点充能' : undefined}
            >
              {t('actions.withdrawCharge')}
            </GameButton>
            <GameButton 
              onClick={() => onWithdrawCostSelect('magic')} 
              variant="secondary" 
              size="sm"
              disabled={playerMagic < 1}
              title={playerMagic < 1 ? '魔力不足' : undefined}
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
        onConfirmStun={onConfirmStun}
        onCancelStun={onCancelStun}
      />
    );
  }

  if (hypnoticLureMode) {
    return (
      <div className="bg-pink-900/95 px-4 py-2 rounded-lg border border-pink-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-pink-200 text-sm font-bold">
          {t('statusBanners.hypnoticLure.message')}
        </span>
        <GameButton onClick={onCancelHypnoticLure} variant="secondary" size="sm">{t('actions.cancel')}</GameButton>
      </div>
    );
  }

  if (mindCaptureMode) {
    return (
      <div className="bg-indigo-900/95 px-4 py-2 rounded-lg border border-indigo-500/40 flex items-center gap-3 shadow-lg">
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
      <div className="bg-teal-900/95 px-4 py-2 rounded-lg border border-teal-500/40 flex items-center gap-3 shadow-lg">
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
      <div className="bg-teal-900/90 px-4 py-2 rounded-lg border border-teal-500/40 flex items-center gap-3 shadow-lg">
        <span className="text-teal-200 text-sm font-bold">
          {t('statusBanners.afterAttack.message', { ability: abilityName })}
        </span>
        <GameButton onClick={onCancelAfterAttackAbility} variant="secondary" size="sm">{t('actions.skip')}</GameButton>
      </div>
    );
  }

  if (rapidFireMode) {
    return (
      <div className="bg-orange-900/90 px-4 py-2 rounded-lg border border-orange-500/40 flex items-center gap-3 shadow-lg">
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
