/**
 * 单位操作面板（主动技能按钮）
 *
 * 数据驱动：从 AbilityDef.ui 配置自动渲染按钮，
 * 不再逐技能 if 硬编码。新增技能只需在 AbilityDef 中配置 ui 字段。
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SummonerWarsCore } from '../domain';
import { SW_COMMANDS, SummonerWarsDomain } from '../domain';
import type { PlayerId } from '../domain/types';
import { abilityRegistry } from '../domain/abilities';
import type { AbilityUIContext } from '../domain/abilities';
import { getUnitAbilities } from '../domain/helpers';
import { canActivateAbility } from '../domain/abilityHelpers';
import { GameButton } from './GameButton';
import type { AbilityModeState } from './useGameEvents';
import { BOARD_SHELL_REFERENCE_WIDTH } from './layoutConstants';

interface Props {
  core: SummonerWarsCore;
  currentPhase: string;
  isMyTurn: boolean;
  myPlayerId: string;
  myHand: Array<{ cardType: string; name: string; id: string }>;
  abilityMode: AbilityModeState | null;
  bloodSummonMode: unknown;
  eventTargetMode: unknown;
  dispatch: (type: string, payload?: unknown) => void;
}

export const AbilityButtonsPanel: React.FC<Props> = ({
  core, currentPhase, isMyTurn, myPlayerId, myHand,
  abilityMode, bloodSummonMode, eventTargetMode,
  dispatch,
}) => {
  const { t } = useTranslation('game-summonerwars');
  const validationTimestamp = 0;

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

    const canActivate = canActivateAbility(core, unit, abilityId, playerId);
    if (!canActivate && !ui.useValidateForDisabled) continue;

    // 按钮点击处理
    const handleClick = () => {
      if (ui.activationType === 'directExecute') {
        dispatch(SW_COMMANDS.ACTIVATE_ABILITY, { abilityId, sourceUnitId: unit.instanceId });
      } else {
        // 交给 domain 决定是直接执行还是先进入 InteractionSystem。
        dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
          abilityId,
          sourceUnitId: unit.instanceId,
        });
      }
    };

    // validate 控制 disabled 状态
    let disabled = false;
    let title: string | undefined;
    if (ui.useValidateForDisabled) {
      const result = SummonerWarsDomain.validate(
        { core, sys: {} as never },
        { type: SW_COMMANDS.ACTIVATE_ABILITY, payload: { abilityId, sourceUnitId: unit.instanceId }, playerId: myPlayerId, timestamp: validationTimestamp },
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
  return (
    <div
      className="absolute left-1/2 z-30 flex -translate-x-1/2 gap-2 pointer-events-auto"
      style={{ bottom: `calc(${BOARD_SHELL_REFERENCE_WIDTH} * 0.14)` }}
    >
      {buttons}
    </div>
  );
};
