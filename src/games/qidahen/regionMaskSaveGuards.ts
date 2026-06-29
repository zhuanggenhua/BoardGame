export type QidahenRegionMaskWorkspaceLoadState = 'loading' | 'ready' | 'failed';

export const getQidahenRegionMaskSaveBlockedReason = ({
    workspaceLoadState,
    outputDir,
}: {
    workspaceLoadState: QidahenRegionMaskWorkspaceLoadState;
    outputDir: string;
}) => {
    if (workspaceLoadState === 'loading') {
        return `保存已阻止：正在读取 ${outputDir} 里的当前工作区数据。等自动回读完成后再保存，避免旧内存态覆盖正式区域结果。`;
    }
    if (workspaceLoadState === 'failed') {
        return `保存已阻止：当前工作区读取失败。先修复回读错误，再保存，避免把旧内存态写回 ${outputDir}。`;
    }
    return null;
};
