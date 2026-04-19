/**
 * 效果交互提示词 Hook
 * 
 * 生成完整的效果执行流程提示词，包括：
 * - 目标选择
 * - UI区域控制
 * - 状态变更
 * - moves调用
 */

import { useCallback } from 'react';
import { usePromptContext } from '../../context';
import { 
  TECH_STACK, 
  OUTPUT_RULES, 
  GAME_STATE_STRUCTURE, 
  CTX_STRUCTURE, 
  AVAILABLE_MOVES 
} from '../promptUtils';

interface EffectPromptOptions {
  effectDescription: string;
  effectType?: 'damage' | 'heal' | 'draw' | 'discard' | 'moveCard' | 'custom';
  targetType?: 'self' | 'opponent' | 'selected' | 'all';
}

/**
 * 效果交互提示词生成器
 * 
 * 职责：生成完整的效果执行代码提示词
 */
export function useEffectPrompt() {
  const ctx = usePromptContext();

  /** 生成效果执行提示词 */
  const generateEffect = useCallback((options: EffectPromptOptions) => {
    const schemas = ctx.schemasSummary?.join('\n- ') || '无';
    
    return `你是一个桌游效果代码生成专家。请根据效果描述生成完整的交互代码。

${TECH_STACK}

## 游戏: ${ctx.gameName || '未命名游戏'}
${ctx.gameDescription || ''}

## 可用数据结构 (Schema)
- ${schemas}

## 效果描述
${options.effectDescription}

## 效果类型: ${options.effectType || 'custom'}
## 目标类型: ${options.targetType || 'selected'}

${GAME_STATE_STRUCTURE}

${CTX_STRUCTURE}

${AVAILABLE_MOVES}

## 输出要求
请生成一个完整的效果执行函数，包含：
1. 目标选择逻辑（如果需要）
2. UI交互流程（显示特写区域等）
3. 状态变更（调用moves）
4. 错误处理

## 输出格式
\`\`\`typescript
// 效果: ${options.effectDescription}
function executeEffect(
  G: GameState,
  ctx: Ctx,
  moves: Moves,
  selectedTargetId?: string
): void {
  // 实现效果逻辑
}

// UI组件（如果需要选择目标）
function EffectUI({ G, ctx, moves }: Props) {
  // 渲染选择界面
}
\`\`\`

${OUTPUT_RULES}`;
  }, [ctx]);

  /** 示例：生成通用的资源/对象转移流程 */
  const generateStealCardEffect = useCallback(() => {
    return generateEffect({
      effectDescription: `资源转移流程示例：
1. 选择一个目标实体
2. 展示目标实体的可选对象列表（特写区域）
3. 从列表中选择一项
4. 将选中的对象转移到当前实体
5. 关闭特写区域`,
      effectType: 'moveCard',
      targetType: 'opponent',
    });
  }, [generateEffect]);

  return { generateEffect, generateStealCardEffect };
}
