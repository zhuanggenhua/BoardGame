/**
 * engine/primitives — 引擎层可复用工具函数库
 *
 * 核心原则：复用工具函数，不复用领域概念。
 * 提供框架让游戏注册自己的处理器，而非预定义效果类型。
 */

export * from './expression';
export * from './condition';
export * from './target';
export * from './effects';
export * from './zones';
export * from './dice';
export * from './resources';
export * from './grid';
export * from './visual';
export * from './actionRegistry';
export * from './ability';
export * from './tags';
export * from './modifier';
export * from './attribute';
export * from './uiHints';
export * from './mulligan';
export * from './spriteAtlas';
