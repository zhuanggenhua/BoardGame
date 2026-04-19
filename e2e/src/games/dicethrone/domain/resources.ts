/**
 * DiceThrone 通用资源定义
 * 
 * 所有 DiceThrone 角色共享的资源 ID。
 * 角色特定的配置（如 max 值）在各角色目录下定义。
 */

/**
 * DiceThrone 资源 ID 常量
 * 
 * 所有角色通用，不同角色可能有不同的 max 值，
 * 但资源类型是统一的。
 */
export const RESOURCE_IDS = {
    /** Combat Points - 战斗点数 */
    CP: 'cp',
    /** Health Points - 生命值 */
    HP: 'hp',
} as const;

export type ResourceId = typeof RESOURCE_IDS[keyof typeof RESOURCE_IDS];
