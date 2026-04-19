/**
 * UGC Builder V2 - 分层模块化架构类型定义
 * 
 * 5 层架构：Schema → Effects → Instances → Rules → View
 * 每层生成时 AI 能看到所有上层代码（递进式上下文）
 */

// ============================================================================
// 基础类型
// ============================================================================

/** Tag 定义（身份标识，类似 Unity Layer） */
export interface TagDefinition {
  id: string;
  name: string;           // 显示名称
  description: string;    // 描述（用于 AI 提示词）
  color?: string;         // 显示颜色
}

/** 资源定义 */
export interface AssetDefinition {
  id: string;
  name: string;
  type: 'canvas' | 'image' | 'audio';
  data: string;           // canvas: JSON, image/audio: URL 或 base64
}

// ============================================================================
// Layer 1: Schema（实体类型定义）
// ============================================================================

/** Schema 模块（定义 Player/Card/Zone 等有哪些字段） */
export interface SchemaModule {
  id: string;             // 如 'Entity', 'Player', 'Card', 'Zone'
  name: string;           // 显示名称
  description: string;    // 用于 AI 提示词
  extends?: string;       // 继承的 Schema ID（如 Card extends Entity）
  code: string;           // AI 生成的类型定义代码
}

// ============================================================================
// Layer 2: Effects（可复用效果代码）
// ============================================================================

/** Effect 模块（定义可复用的效果逻辑） */
export interface EffectModule {
  id: string;             // 如 'damage', 'heal', 'draw'
  name: string;           // 显示名称
  description: string;    // 用于 AI 提示词
  requiredTags?: string[]; // 依赖的 Tag（文档用途）
  code: string;           // AI 生成的效果代码
}

// ============================================================================
// Layer 3: Instances（具体实例配置）
// ============================================================================

/** Instance 模块（定义具体的卡牌、角色等实例数据） */
export interface InstanceModule {
  id: string;             // 如 'cards', 'heroes', 'skills'
  schemaRef: string;      // 引用的 Schema ID
  name: string;
  description: string;
  code: string;           // AI 生成的实例配置（JSON 或代码）
}

// ============================================================================
// Layer 4: Rules（游戏规则）
// ============================================================================

/** Move 定义 */
export interface MoveDefinition {
  id: string;
  name: string;
  description: string;
  code: string;
}

/** Rules 模块（定义游戏流程和规则） */
export interface RulesModule {
  setup: string;          // 初始化代码
  moves: MoveDefinition[];// 玩家可执行的操作
  
  // 回合生命周期钩子（处理每回合效果如中毒）
  turn?: {
    onBegin?: string;     // 回合开始时
    onEnd?: string;       // 回合结束时
    onMove?: string;      // 每次操作后
  };
  
  phases?: string;        // 阶段定义代码
  endIf: string;          // 胜负判定代码
}

// ============================================================================
// Layer 5: View（渲染）
// ============================================================================

/** View 组件 */
export interface ViewComponent {
  id: string;
  name: string;
  code: string;           // React 组件代码
}

/** View 模块 */
export interface ViewModule {
  components: ViewComponent[];
}

// ============================================================================
// GameBundle（完整游戏包）
// ============================================================================

/** 游戏包 - 分层模块化结构 */
export interface GameBundle {
  id: string;
  name: string;
  description: string;
  
  // ========== 元数据 ==========
  tags: TagDefinition[];
  assets: AssetDefinition[];
  
  // ========== Layer 1: Schema ==========
  schemas: SchemaModule[];
  
  // ========== Layer 2: Effects ==========
  effects: EffectModule[];
  
  // ========== Layer 3: Instances ==========
  instances: InstanceModule[];
  
  // ========== Layer 4: Rules ==========
  rules: RulesModule;
  
  // ========== Layer 5: View ==========
  view: ViewModule;
}

// ============================================================================
// 工厂函数
// ============================================================================

/** 创建空的 GameBundle */
export function createEmptyGameBundle(id: string, name: string): GameBundle {
  return {
    id,
    name,
    description: '',
    tags: [],
    assets: [],
    schemas: [],
    effects: [],
    instances: [],
    rules: {
      setup: '',
      moves: [],
      endIf: '',
    },
    view: {
      components: [],
    },
  };
}

/** 创建默认 Tag */
export function createTag(id: string, name: string, description: string, color?: string): TagDefinition {
  return { id, name, description, color };
}

/** 创建 Schema 模块 */
export function createSchema(id: string, name: string, description: string, code: string, extendsId?: string): SchemaModule {
  return { id, name, description, extends: extendsId, code };
}

/** 创建 Effect 模块 */
export function createEffect(id: string, name: string, description: string, code: string): EffectModule {
  return { id, name, description, code };
}

/** 创建 Instance 模块 */
export function createInstance(id: string, schemaRef: string, name: string, description: string, code: string): InstanceModule {
  return { id, schemaRef, name, description, code };
}

/** 创建 Move 定义 */
export function createMove(id: string, name: string, description: string, code: string): MoveDefinition {
  return { id, name, description, code };
}
