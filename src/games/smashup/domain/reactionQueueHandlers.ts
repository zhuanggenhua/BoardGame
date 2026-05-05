export function registerReactionQueueInteractionHandlers(): void {
    // `smashup_reaction_choose` 已由 ability runtime prompt 直接接管。
    // 保留该入口作为幂等初始化点，避免旧测试/初始化流程额外创建第二条续链。
}
