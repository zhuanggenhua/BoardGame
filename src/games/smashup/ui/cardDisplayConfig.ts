/**
 * 大杀四方 - 卡牌展示统一配置
 * 
 * 所有弹窗、展示、选择界面的卡牌尺寸统一配置
 * 与手牌区域和场上基地保持一致
 */

export const CARD_DISPLAY_CONFIG = {
  // 行动卡/随从卡展示尺寸（与手牌一致：8.5vw）
  ACTION_CARD_WIDTH: '8.5vw',
  ACTION_CARD_ASPECT: '0.714',
  
  // 基地卡展示尺寸（与场上基地一致：14vw）
  BASE_CARD_WIDTH: '14vw',
  BASE_CARD_ASPECT: '1.43',
  
  // 卡牌间距
  CARD_GAP: 'gap-4',
  
  // 放大镜按钮尺寸
  MAGNIFY_BUTTON_SIZE: 'w-[2vw] h-[2vw]',
  MAGNIFY_ICON_SIZE: 'w-[1.1vw] h-[1.1vw]',
  
  // 标题样式
  TITLE_CLASS: 'text-2xl font-black text-amber-100 uppercase tracking-tight mb-6 drop-shadow-lg',
  
  // 文字样式
  TEXT_CLASS: 'text-xs font-bold text-white/80',
} as const;

// 辅助函数：生成卡牌展示类名
export function getCardDisplayClasses(isBase: boolean) {
  return {
    width: isBase ? `w-[${CARD_DISPLAY_CONFIG.BASE_CARD_WIDTH}]` : `w-[${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}]`,
    aspect: isBase ? `aspect-[${CARD_DISPLAY_CONFIG.BASE_CARD_ASPECT}]` : `aspect-[${CARD_DISPLAY_CONFIG.ACTION_CARD_ASPECT}]`,
    maxWidth: isBase ? `max-w-[${CARD_DISPLAY_CONFIG.BASE_CARD_WIDTH}]` : `max-w-[${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}]`,
  };
}
