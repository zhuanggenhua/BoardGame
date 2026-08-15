type FlowHostBaseline = Record<string, unknown>;
type WorkflowPackSummary = Record<string, unknown>;

export interface ForkBaseline extends FlowHostBaseline {
    releaseDate: string;
    license: string;
    adoptionMode: 'fork';
    updatePolicy: {
        mode: 'pinned-tag';
        allowAutoTracking: false;
        nextAction: string;
    };
    knownRisks: string[];
}

export interface WorkbenchFlowHostCatalog {
    baseline: ForkBaseline;
    workflowPacks: WorkflowPackSummary[];
}

/**
 * 单一真相：AI Repo Workbench 当前选择的上游 fork 基线。
 * flow-host 提供跨项目复用的通用宿主基线，这里只补 BoardGame 私有约束。
 */
const FALLBACK_FLOW_HOST_BASELINE: FlowHostBaseline = {
    id: 'flowise',
    name: 'Flowise',
    description: 'flow-host 依赖缺失，当前使用降级基线占位',
    version: 'unknown',
};
const FLOW_HOST_CORE_PACKAGE = '@flow-host/core';

const buildForkBaseline = (baseline: FlowHostBaseline): ForkBaseline => ({
    ...baseline,
    localSourcePath: '../flowise-fork',
    releaseDate: '2026-03-23',
    license: 'Apache-2.0',
    adoptionMode: 'fork',
    updatePolicy: {
        mode: 'pinned-tag',
        allowAutoTracking: false,
        nextAction: '后续升级必须按 tag 逐次评估并记录兼容性，不允许直接追 upstream main',
    },
    knownRisks: [
        'Flowise 公开 issue 仍显示 Node 22 存在 engine/兼容告警；当前 BoardGame 使用 Node 24.1.0，接入时必须做隔离适配。',
        'Flowise 历史上有多条安全公告；即使当前锁定到 flowise@3.1.1，后续升级仍需逐条审计 release note 与 advisory。',
        'fork 后必须把画布层和领域层解耦，否则 repo/worktree 语义会再次被上游状态模型反客为主。',
    ],
});

let cachedCatalog: WorkbenchFlowHostCatalog | null = null;

export async function resolveFlowHostCatalog(): Promise<WorkbenchFlowHostCatalog> {
    if (cachedCatalog) {
        return cachedCatalog;
    }

    try {
        const module = await import(/* @vite-ignore */ FLOW_HOST_CORE_PACKAGE);
        const baseline = (module as { FLOWISE_HOST_BASELINE?: FlowHostBaseline }).FLOWISE_HOST_BASELINE;
        const workflowPacks = (module as { FLOW_HOST_WORKFLOW_PACK_SUMMARIES?: WorkflowPackSummary[] })
            .FLOW_HOST_WORKFLOW_PACK_SUMMARIES;
        if (baseline && workflowPacks) {
            cachedCatalog = {
                baseline: buildForkBaseline(baseline),
                workflowPacks,
            };
            return cachedCatalog;
        }
    } catch {
        // 缺少 flow-host 依赖时降级为占位基线，避免阻断服务启动。
    }

    cachedCatalog = {
        baseline: buildForkBaseline(FALLBACK_FLOW_HOST_BASELINE),
        workflowPacks: [],
    };
    return cachedCatalog;
}
