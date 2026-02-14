/**
 * 单位操作面板（主动技能按钮）
 *
 * 数据驱动：从 AbilityDef.ui 配置自动渲染按钮，
 * 不再逐技能 if 硬编码。新增技能只需在 AbilityDef 中配置 ui 字段。
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SummonerWarsCore } from '../domain';
import { SW_COMMANDS, SummonerWarsDomain } from '../domain';
import type { PlayerId } from '../domain/types';
import { abilityRegistry } from '../domain/abilities';
import type { AbilityDef, AbilityUIContext } from '../domain/abilities';
import { getUnitAbilities } from '../domain/helpers';
import { GameButton } from './GameButton';

interface AbilityMode {
  abilityId: string;
  step: string;
  sourceUnitId: string;
  context?: string;
  selectedCardIds?: string[];
  targetPosition?: unknown;
}

interface Props {
  core: SummonerWarsCore;
  currentPhase: string;
  isMyTurn: boolean;
  myPlayerId: string;
  myHand: Array<{ cardType: string; name: string; id: string }>;
  abilityMode: AbilityMode | null;
  bloodSummonMode: unknown;
  eventTargetMode: unknown;
  moves: Record<string, (payload?: unknown) => void>;
  setAbilityMode: (mode: AbilityMode | null) => void;
  setWithdrawMode: (mode: { sourceUnitId: string; step: string } | null) => void;
}

export const AbilityButtonsPanel: React.FC<Props> = ({
  core, currentPhase, isMyTurn, myPlayerId, myHand,
  abilityMode, bloodSummonMode, eventTargetMode,
  moves, setAbilityMode, setWithdrawMode,
}) => {
  const { t } = useTranslation('game-summonerwars');

  // 前置条件：无其他模式激活、有选中单位、是自己的回合
  if (abilityMode || bloodSummonMode || eventTargetMode || !core.selectedUnit || !isMyTurn) return null;

  const cell = core.board[core.selectedUnit.row]?.[core.selectedUnit.col];
  const unit = cell?.unit;
  if (!unit || unit.owner !== myPlayerId) return null;

  const abilities = getUnitAbilities(unit, core);
  const playerId = myPlayerId as PlayerId;

  // 构建 UI 上下文
  const uiCtx: AbilityUIContext = { core, unit, playerId, myHand };

  // 收集需要渲染的按钮
  const buttons: React.ReactNode[] = [];

  for (const abilityId of abilities) {
    const def = abilityRegistry.get(abilityId);
    if (!def?.ui?.requiresButton) continue;

    const { ui } = def;

    // 阶段匹配
    if (ui.buttonPhase && ui.buttonPhase !== currentPhase) continue;

    // 额外前置条件
    if (ui.extraCondition && !ui.extraCondition(uiCtx)) continue;

    // 快速可用性检查
    if (ui.quickCheck && !ui.quickCheck(uiCtx)) continue;

    // 按钮点击处理
    const handleClick = () => {
      if (ui.activationType === 'directExecute') {
        moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({ abilityId, sourceUnitId: unit.cardId });
      } else if (ui.activationType === 'withdrawMode') {
        setWithdrawMode({ sourceUnitId: unit.cardId, step: 'selectCost' });
      } else {
        // 默认：进入 abilityMode
        setAbilityMode({
          abilityId,
          step: ui.activationStep ?? 'selectUnit',
          sourceUnitId: unit.cardId,
          context: ui.activationContext,
          selectedCardIds: ui.activationStep === 'selectCards' ? [] : undefined,
        });
      }
    };

    // validate 控制 disabled 状态
    let disabled = false;
    let title: string | undefined;
    if (ui.useValidateForDisabled) {
      const result = SummonerWarsDomain.validate(
        { core, sys: {} as never },
        { type: SW_COMMANDS.ACTIVATE_ABILITY, payload: { abilityId, sourceUnitId: unit.cardId }, playerId: myPlayerId, timestamp: Date.now() },
      );
      disabled = !result.valid;
      title = result.valid ? undefined : result.error;
    }

    buttons.push(
      <GameButton
        key={abilityId}
        onClick={handleClick}
        variant={ui.buttonVariant ?? 'secondary'}
        size="md"
        disabled={disabled}
        title={title}
      >
        {t(ui.buttonLabel ?? `abilities.${abilityId}.name`)}
      </GameButton>,
    );
  }

  if (buttons.length === 0) return null;
  return <div className="absolute bottom-[14vw] left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex gap-2">{buttons}</div>;
};
