/**
 * 全局日志工具
 * 
 * 功能：
 * - 自动折叠详细信息，减少控制台噪音
 * - 支持颜色标记和分组
 * - 开发环境自动启用，生产环境静默
 * - 避免触发 React 组件堆栈（使用 console.log 而非 console.error）
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * 错误日志（使用 console.log 避免 React 堆栈）
   */
  error(title: string, details?: Record<string, any>, suggestions?: string[]) {
    if (!isDev) return;

    // 使用 console.log 而非 console.error，避免触发 React 组件堆栈
    console.log(
      `%c❌ ${title}`,
      'color: #ff6b6b; font-weight: bold; font-size: 14px; background: #ffe0e0; padding: 4px 8px; border-radius: 4px;'
    );

    if (details) {
      console.groupCollapsed('%c📋 详细信息', 'color: #999');
      console.table(details);
      console.groupEnd();
    }

    if (suggestions && suggestions.length > 0) {
      console.groupCollapsed('%c💡 排查建议', 'color: #ffa500');
      suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
      console.groupEnd();
    }
  },

  /**
   * 警告日志（使用 console.log 避免堆栈）
   */
  warn(title: string, details?: Record<string, any>) {
    if (!isDev) return;

    console.log(
      `%c⚠️ ${title}`,
      'color: #ff8c00; font-weight: bold; background: #fff4e6; padding: 4px 8px; border-radius: 4px;'
    );

    if (details) {
      console.groupCollapsed('%c📋 详细信息', 'color: #999');
      console.table(details);
      console.groupEnd();
    }
  },

  /**
   * 信息日志
   */
  info(title: string, details?: Record<string, any>) {
    if (!isDev) return;

    console.log(
      `%c✓ ${title}`,
      'color: #51cf66; font-weight: bold; background: #e7f5e7; padding: 4px 8px; border-radius: 4px;'
    );

    if (details) {
      console.groupCollapsed('%c📋 详细信息', 'color: #999');
      console.table(details);
      console.groupEnd();
    }
  },

  /**
   * 调试日志（默认折叠）
   */
  debug(title: string, ...data: any[]) {
    if (!isDev) return;

    console.groupCollapsed(`%c🔍 ${title}`, 'color: #748ffc');
    data.forEach((d) => console.log(d));
    console.groupEnd();
  },

  /**
   * 分组日志（手动控制折叠）
   */
  group(title: string, collapsed = true) {
    if (!isDev) return;

    if (collapsed) {
      console.groupCollapsed(`%c${title}`, 'color: #748ffc; font-weight: bold');
    } else {
      console.group(`%c${title}`, 'color: #748ffc; font-weight: bold');
    }
  },

  groupEnd() {
    if (!isDev) return;
    console.groupEnd();
  },
};
