/**
 * 手牌区提示词 Hook
 * 
 * 仅处理手牌区相关的提示词生成（布局、选中、排序、过滤）
 */

import { useCallback } from 'react';
import { usePromptContext } from '../../context';
import { TECH_STACK, OUTPUT_RULES } from '../promptUtils';

interface HandAreaPromptOptions {
  requirement?: string;
}

/**
 * 手牌区提示词生成器
 * 
 * 职责：生成布局代码、选中效果、排序、过滤提示词
 */
export function useHandAreaPrompt() {
  const ctx = usePromptContext();

  /** 生成布局代码提示词 */
  const generateLayout = useCallback((options: HandAreaPromptOptions = {}) => {
    return `你是一个卡牌布局代码生成器。

${TECH_STACK}

## 游戏: ${ctx.gameName}

## 需求
${options.requirement || '顺序排开'}

## 函数签名
(index: number, total: number) => React.CSSProperties

## 参数说明
- \`index\`: 当前卡牌在手牌中的索引（0开始）
- \`total\`: 手牌总数

## 常用布局效果
1. **扇形展开**: 每张牌旋转一定角度
2. **堆叠**: 每张牌向左偏移形成堆叠效果
3. **居中展开**: 以中心为基准两侧展开

## 使用示例
\`\`\`tsx
// 扇形展开 + 堆叠效果
(index, total) => ({
  marginLeft: index === 0 ? 0 : -30,
  transform: \`rotate(\${(index - total/2) * 5}deg)\`,
  zIndex: index,
  transition: 'all 0.2s ease',
})
\`\`\`

${OUTPUT_RULES}`;
  }, [ctx.gameName]);

  /** 生成选中效果代码提示词 */
  const generateSelectEffect = useCallback((options: HandAreaPromptOptions = {}) => {
    return `你是一个选中效果代码生成器。

${TECH_STACK}

## 游戏: ${ctx.gameName}

## 需求
${options.requirement || '抬高一点'}

## 函数签名
(isSelected: boolean) => React.CSSProperties

## 参数说明
- \`isSelected\`: 卡牌是否被选中

## 常用选中效果
1. **抬高**: translateY(-20px)
2. **发光**: boxShadow 或 ring
3. **放大**: scale(1.1)
4. **边框高亮**: border 颜色变化

## 使用示例
\`\`\`tsx
// 抬高 + 发光效果
(isSelected) => isSelected 
  ? { 
      transform: 'translateY(-20px) scale(1.05)', 
      boxShadow: '0 0 20px rgba(255,215,0,0.5)',
      zIndex: 100,
    } 
  : {}
\`\`\`

${OUTPUT_RULES}`;
  }, [ctx.gameName]);

  /** 生成排序函数提示词 */
  const generateSort = useCallback((options: HandAreaPromptOptions = {}) => {
    return `你是一个手牌排序函数生成器。

${TECH_STACK}

## 游戏: ${ctx.gameName}

## 需求
${options.requirement || '排序手牌'}

## 函数签名
(
  a: Card,
  b: Card
) => number

## 参数说明
- \`a\` / \`b\`: 参与比较的卡牌

## 使用示例
\`\`\`tsx
// 按名称排序
(a, b) => (a.name as string).localeCompare(b.name as string)

// 按标签优先级排序
(a, b) => {
  const aHas = (a.tags as string[])?.includes('优先');
  const bHas = (b.tags as string[])?.includes('优先');
  return aHas === bHas ? 0 : aHas ? -1 : 1;
}
\`\`\`

${OUTPUT_RULES}`;
  }, [ctx.gameName]);

  /** 生成过滤函数提示词 */
  const generateFilter = useCallback((options: HandAreaPromptOptions = {}) => {
    return `你是一个手牌过滤函数生成器。

${TECH_STACK}

## 游戏: ${ctx.gameName}

## 需求
${options.requirement || '过滤手牌'}

## 函数签名
(
  item: Card,
  ctx: {
    playerIds: string[];
    currentPlayerId: string | null;
    currentPlayerIndex: number;
    resolvedPlayerId: string | null;
    resolvedPlayerIndex: number;
    bindEntity?: string;
    zoneField?: string;
    zoneValue?: string;
  }
) => boolean

## 参数说明
- \`item\`: 当前卡牌
- \`ctx\`: 过滤上下文（hand-zone 注入）

## 使用示例
\`\`\`tsx
// 按标签过滤
(item) => (item.tags as string[])?.includes('可出')

// 组合条件
(item) => (item.tags as string[])?.some(t => ['条件1', '条件2'].includes(t))
\`\`\`

${OUTPUT_RULES}`;
  }, [ctx.gameName]);

  return { generateLayout, generateSelectEffect, generateSort, generateFilter };
}
