/**
 * AI 模块导出
 */

export { PromptGenerator, createEmptyContext } from './PromptGenerator';
export type { GameContext } from './PromptGenerator';

// 统一提示词工具
export { 
  generateUnifiedPrompt, 
  getSchemaFieldsInfo, 
  getTagsUsageInfo, 
  getGameContext,
  TECH_STACK,
  OUTPUT_RULES,
  CODE_STYLE_RULES
} from './promptUtils';
export type { PromptType } from './promptUtils';

// Context 集成的提示词生成器（通用）
export { usePromptGenerator } from './usePromptGenerator';

// 按组件职责分离的提示词 hooks
export { useRenderPrompt, useHandAreaPrompt, useDataPrompt } from './hooks';
