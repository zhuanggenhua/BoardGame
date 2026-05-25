/**
 * 交互完整性审计：历史孤儿 handler 基线
 *
 * 说明：
 * - 这些 sourceId 是当前仓库的历史遗留注册（主要为 _pod 兼容链路与旧注册项）
 * - interactionCompletenessAudit 会把它们作为“历史债”白名单
 * - 新增孤儿 handler 不在本列表时，测试会直接失败
 */
export const INTERACTION_ORPHAN_BASELINE = [] as const;
