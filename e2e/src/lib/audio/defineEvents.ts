/**
 * 音频事件定义系统 — 面向百游戏 + 适宜 AI
 * 
 * 设计原则：
 * - 显式 > 隐式：音效策略显式声明，不依赖命名推断
 * - 智能默认 + 可覆盖：框架提供默认音效，特殊需求可自定义
 * - 单一真实来源：事件定义即音效配置
 * - 类型安全：编译期检查
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 音效策略类型
 * 
 * - 'ui': 本地 UI 交互音（选择角色/阵营/卡牌），只在本地播放
 * - 'immediate': 即时游戏反馈音（投骰子/出牌/阶段切换），走 EventStream
 * - 'fx': 动画驱动音效（伤害飞行/召唤光柱/攻击气浪），走 FX 系统
 * - 'silent': 静默事件（状态同步/内部更新），无音效
 */
export type AudioStrategy = 'ui' | 'immediate' | 'fx' | 'silent';

/**
 * 事件配置（简洁形式 | 完整形式）
 */
export type EventConfig = 
  | AudioStrategy  // 简洁形式：只声明策略，使用默认音效
  | {              // 完整形式：自定义音效
      audio: AudioStrategy;
      sound: string;
    };

/**
 * 事件定义（规范化后）
 */
export interface EventDefinition {
  /** 事件类型（事件名称） */
  readonly type: string;
  /** 音效策略 */
  readonly audio: AudioStrategy;
  /** 音效 key（可能为 null） */
  readonly sound: string | null;
}

/**
 * 事件定义集合
 */
export type EventDefinitions<T = any> = {
  [K in keyof T]: EventDefinition & { type: K };
};

// ============================================================================
// 框架默认音效库
// ============================================================================

/**
 * 默认音效配置
 */
interface DefaultSoundConfig {
  /** 默认音效（无法匹配模式时使用） */
  default: string;
  /** 模式匹配规则 */
  patterns: Array<{
    match: RegExp;
    sound: string;
  }>;
}

/**
 * 框架默认音效库
 * 
 * 根据事件名称模式自动匹配音效
 */
const DEFAULT_SOUNDS: Record<'ui' | 'immediate', DefaultSoundConfig> = {
  ui: {
    default: 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none',
    patterns: [
      { 
        match: /HOVERED?$/, 
        sound: 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_hover_001' 
      },
      { 
        match: /(SELECTED|CLICKED)$/, 
        sound: 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none' 
      },
    ],
  },
  immediate: {
    default: 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_select_001',
    patterns: [
      { 
        match: /DICE.*ROLLED?/, 
        sound: 'dice.general.tabletop_audio_dice.plastic_dice.plastic_dice_roll_01' 
      },
      { 
        match: /CARD.*PLAYED?/, 
        sound: 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_select_001' 
      },
      { 
        match: /CARD.*DRAWN?/, 
        sound: 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_select_001' 
      },
      { 
        match: /PHASE.*CHANGED?/, 
        sound: 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_next_001' 
      },
      { 
        match: /TURN.*STARTED?/, 
        sound: 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_open_001' 
      },
      { 
        match: /TURN.*ENDED?/, 
        sound: 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_close_001' 
      },
    ],
  },
};

/**
 * 解析事件音效 key
 * 
 * @param eventName 事件名称
 * @param strategy 音效策略
 * @returns 音效 key 或 null
 */
function resolveSound(eventName: string, strategy: AudioStrategy): string | null {
  // fx 和 silent 策略无音效
  if (strategy === 'fx' || strategy === 'silent') {
    return null;
  }

  const config = DEFAULT_SOUNDS[strategy];
  if (!config) return null;

  // 1. 尝试模式匹配
  for (const { match, sound } of config.patterns) {
    if (match.test(eventName)) {
      return sound;
    }
  }

  // 2. 使用默认音效
  return config.default;
}

// ============================================================================
// 核心 API
// ============================================================================

/**
 * 定义事件 — 辅助函数
 * 
 * 功能：
 * 1. 规范化事件配置（简洁形式 → 完整形式）
 * 2. 自动解析音效 key（使用框架默认或自定义）
 * 3. 验证配置完整性（编译期 + 运行期）
 * 
 * @example
 * ```typescript
 * export const EVENTS = defineEvents({
 *   CHARACTER_SELECTED: 'ui',           // 简洁：使用默认
 *   SPECIAL_ABILITY: {                  // 完整：自定义
 *     audio: 'immediate',
 *     sound: 'magic.cast',
 *   },
 * });
 * ```
 */
export function defineEvents<T extends Record<string, EventConfig>>(
  events: T
): EventDefinitions<T> {
  const result = {} as any;

  for (const [name, config] of Object.entries(events)) {
    // 规范化配置
    const normalized = typeof config === 'string'
      ? { audio: config, sound: undefined }
      : config;

    // 解析音效 key
    const sound = normalized.sound ?? resolveSound(name, normalized.audio);

    // 验证：ui 和 immediate 必须有音效
    if ((normalized.audio === 'ui' || normalized.audio === 'immediate') && !sound) {
      throw new Error(
        `[Audio] 事件 "${name}" 的策略为 "${normalized.audio}"，但无法解析音效 key。\n` +
        `请显式提供 sound 配置或调整事件命名以匹配默认模式。\n` +
        `支持的模式：*_SELECTED, *_CLICKED, *_HOVERED (ui) | *_ROLLED, *_PLAYED, *_CHANGED (immediate)`
      );
    }

    result[name] = {
      type: name,
      audio: normalized.audio,
      sound,
    };
  }

  return result;
}

/**
 * 从事件定义中自动收集需要预加载的音效 key
 * 
 * 提取所有 'immediate' 和 'ui' 策略的非空 sound key，
 * 去重后返回。游戏层可直接用于 criticalSounds 或 contextualPreloadKeys。
 * 
 * @example
 * ```typescript
 * // 游戏层 audio.config.ts
 * criticalSounds: [
 *   ...collectPreloadKeys(EVENTS),  // 自动收集，零维护
 *   ...EXTRA_KEYS,                  // 游戏层额外的非事件音效
 * ],
 * ```
 */
export function collectPreloadKeys<T extends EventDefinitions>(events: T): string[] {
  const keys = new Set<string>();
  for (const def of Object.values(events)) {
    if ((def.audio === 'immediate' || def.audio === 'ui') && def.sound) {
      keys.add(def.sound);
    }
  }
  return Array.from(keys);
}

/**
 * 自动生成 feedbackResolver
 * 
 * 规则：
 * - 'ui' → 返回 null（UI 层负责播放）
 * - 'immediate' → 返回音效 key
 * - 'fx' → 返回 null（FX 系统负责播放）
 * - 'silent' → 返回 null
 * 
 * @example
 * ```typescript
 * export const feedbackResolver = createFeedbackResolver(EVENTS);
 * ```
 */
export function createFeedbackResolver<T extends EventDefinitions>(
  events: T
): (event: { type: string }) => string | null {
  // 构建查找表（只包含 immediate 策略的事件）
  const soundMap = new Map<string, string>();

  for (const def of Object.values(events)) {
    if (def.audio === 'immediate' && def.sound) {
      soundMap.set(def.type, def.sound);
    }
  }

  return (event) => soundMap.get(event.type) ?? null;
}

/**
 * 获取 UI 音效 key（类型安全）
 * 
 * 只能用于 audio='ui' 的事件，编译期检查
 * 
 * @example
 * ```typescript
 * playSound(getUISound(EVENTS.CHARACTER_SELECTED));  // ✅ 编译通过
 * playSound(getUISound(EVENTS.DAMAGE_DEALT));        // ❌ 编译错误
 * ```
 */
export function getUISound<T extends { audio: 'ui'; sound: string | null }>(
  eventDef: T
): string {
  if (!eventDef.sound) {
    throw new Error(`[Audio] UI 事件 "${eventDef.type}" 缺少 sound 配置`);
  }
  return eventDef.sound;
}

/**
 * 检查事件是否为 UI 交互音
 */
export function isUIEvent(eventDef: EventDefinition): boolean {
  return eventDef.audio === 'ui';
}

/**
 * 创建 UI 音频中间件
 * 
 * 自动拦截 'ui' 策略的事件并播放音效
 * 
 * @example
 * ```typescript
 * const middleware = createUIAudioMiddleware(EVENTS, playSound);
 * middleware('CHARACTER_SELECTED');  // 自动播放音效
 * ```
 */
export function createUIAudioMiddleware<T extends EventDefinitions>(
  events: T,
  playSound: (key: string) => void
) {
  // 构建 UI 事件查找表
  const uiSoundMap = new Map<string, string>();

  for (const def of Object.values(events)) {
    if (def.audio === 'ui' && def.sound) {
      uiSoundMap.set(def.type, def.sound);
    }
  }

  return (command: string) => {
    const soundKey = uiSoundMap.get(command);
    if (soundKey) {
      playSound(soundKey);
    }
  };
}
