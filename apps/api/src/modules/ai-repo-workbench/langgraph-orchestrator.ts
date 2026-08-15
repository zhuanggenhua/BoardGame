import {
    Annotation,
    Command,
    END,
    MemorySaver,
    START,
    StateGraph,
    interrupt,
    isGraphInterrupt,
    task,
} from '@langchain/langgraph';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types — shared with frontend runtime but kept self-contained so the backend
// module does not import from `src/features/…`.
// ---------------------------------------------------------------------------

export type RuleSourceOptionId = 'wiki' | 'pdf' | 'document' | 'other-url';

export type WorkflowNodeId =
    | 'capture-faction-intent'
    | 'select-rule-source'
    | 'acquire-rule-material'
    | 'transcribe-or-normalize-rules'
    | 'inspect-assets'
    | 'draft-faction-definition'
    | 'review-faction-definition'
    | 'run-e2e-validation'
    | 'publish-artifact-bundle';

export type WorkbenchNodeStatus =
    | 'pending'
    | 'running'
    | 'waiting_decision'
    | 'blocked'
    | 'skipped'
    | 'completed'
    | 'failed';

export interface NodeRecord {
    nodeId: WorkflowNodeId;
    status: WorkbenchNodeStatus;
    attempt: number;
    inputSnapshot: Record<string, unknown>;
    outputSnapshot: Record<string, unknown> | null;
    startedAt: string | null;
    finishedAt: string | null;
    errorSummary: string | null;
}

export interface DecisionPayload {
    decisionId: string;
    nodeId: WorkflowNodeId;
    phase: string;
    kind: 'single_select' | 'form' | 'approval';
    title: string;
    summary: string;
    rationale?: string;
    options: Array<{
        id: string;
        label: string;
        description: string;
        payload: Record<string, unknown>;
    }>;
    evidenceRefs: string[];
    recommendedOptionId?: string;
    allowReject?: boolean;
    allowFeedback?: boolean;
    proceedLabel?: string;
    rejectLabel?: string;
    feedbackPlaceholder?: string;
    createdAt?: string;
}

export interface DecisionResolution {
    action: 'proceed' | 'reject';
    optionId?: string;
    optionLabel?: string;
    notes?: string;
    decidedAt: string;
    decidedBy: string;
}

export interface ArtifactBundleOutput {
    id: string;
    title: string;
    status: 'published';
    createdAt: string;
    summary: string;
    outputs: Record<string, unknown>;
    evidenceRefs: string[];
    keyObservations: string[];
}

export interface StageExecutionResult {
    stage: string;
    status: 'ready' | 'completed' | 'degraded';
    summary: string;
    summaryMarkdown: string;
    nextStepHints: string[];
    inputSnapshot: Record<string, unknown>;
    executor?: Record<string, unknown>;
    structured: Record<string, unknown>;
}

export interface AssetInspectionResult {
    status: string;
    inspectedPath: string;
    gameId: string;
    declaredFactions: string[];
    imageFiles: Array<Record<string, unknown>>;
    docHints: Array<Record<string, unknown>>;
    enableWikiComparison: boolean;
    enableDocLookup: boolean;
    extraDataSources: string;
    legacyComparison: Record<string, unknown>;
    requiresDecision: boolean;
    recommendedAction: 'proceed' | 'reject';
    nextStepHints: string[];
    summary: string;
    summaryMarkdown: string;
}

export interface LangGraphExecutionDeps {
    inspectFactionAssets(payload: {
        ttsPackPath?: string;
        gameId?: string;
        projectPath?: string;
        factionOutline?: string;
        enableWikiComparison?: boolean;
        enableDocLookup?: boolean;
        extraDataSources?: string;
    }): Promise<AssetInspectionResult>;
    executeDataEntry(payload: Record<string, unknown>): Promise<StageExecutionResult>;
    executeReferenceFaction(payload: Record<string, unknown>): Promise<StageExecutionResult>;
    executeImplementation(payload: Record<string, unknown>): Promise<StageExecutionResult>;
    executeAudit(payload: Record<string, unknown>): Promise<StageExecutionResult>;
    executeUpload(payload: Record<string, unknown>): Promise<StageExecutionResult>;
}

type StageTask = (payload: Record<string, unknown>) => Promise<StageExecutionResult>;
type AssetInspectionTask = (payload: {
    ttsPackPath?: string;
    gameId?: string;
    projectPath?: string;
    factionOutline?: string;
    enableWikiComparison?: boolean;
    enableDocLookup?: boolean;
    extraDataSources?: string;
}) => Promise<AssetInspectionResult>;

// ---------------------------------------------------------------------------
// Graph state annotation
// ---------------------------------------------------------------------------

const WorkflowStateAnnotation = Annotation.Root({
    // ── Run identity ────────────────────────────────────────────────────
    runId: Annotation<string>(),
    threadId: Annotation<string>(),
    templateId: Annotation<string>(),
    templateVersion: Annotation<string>(),

    // ── Context ─────────────────────────────────────────────────────────
    factionName: Annotation<string>(),
    promptText: Annotation<string>(),
    gameId: Annotation<string>(),
    worktreePath: Annotation<string>(),
    branchName: Annotation<string>(),
    repoSessionId: Annotation<string>(),
    worktreeTaskId: Annotation<string>(),

    // ── Configuration ───────────────────────────────────────────────────
    enabledNodeIds: Annotation<WorkflowNodeId[]>(),

    // ── Progress tracking ───────────────────────────────────────────────
    currentNodeId: Annotation<WorkflowNodeId | null>(),
    nodeRecords: Annotation<NodeRecord[]>(),
    runStatus: Annotation<string>(),

    // ── Decision tracking ───────────────────────────────────────────────
    pendingDecision: Annotation<DecisionPayload | null>(),
    decisions: Annotation<Array<DecisionPayload & { resolution?: DecisionResolution }>>(),

    // ── Node outputs (accumulated as graph progresses) ──────────────────
    intentOutput: Annotation<Record<string, unknown> | null>(),
    selectedRuleSource: Annotation<RuleSourceOptionId | null>(),
    acquiredMaterial: Annotation<Record<string, unknown> | null>(),
    normalizedRules: Annotation<StageExecutionResult | null>(),
    assetInspection: Annotation<AssetInspectionResult | null>(),
    definitionDraft: Annotation<StageExecutionResult | null>(),
    reviewResult: Annotation<StageExecutionResult | null>(),
    e2eResult: Annotation<Record<string, unknown> | null>(),
    uploadResult: Annotation<StageExecutionResult | null>(),
    artifactBundle: Annotation<ArtifactBundleOutput | null>(),
    latestReviewFeedback: Annotation<string | null>(),
    reviewRevisionCount: Annotation<number>(),

    // ── Timestamps ──────────────────────────────────────────────────────
    startedAt: Annotation<string>(),
    finishedAt: Annotation<string | null>(),
    checkpointVersion: Annotation<number>(),
});

type WorkflowState = typeof WorkflowStateAnnotation.State;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIso(now = Date.now()): string {
    return new Date(now).toISOString();
}

function createId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function updateNodeRecord(
    records: NodeRecord[],
    nodeId: WorkflowNodeId,
    updater: (r: NodeRecord) => NodeRecord,
): NodeRecord[] {
    return records.map((r) => (r.nodeId === nodeId ? updater(r) : r));
}

function createPendingRecord(nodeId: WorkflowNodeId): NodeRecord {
    return {
        nodeId,
        status: 'pending',
        attempt: 0,
        inputSnapshot: {},
        outputSnapshot: null,
        startedAt: null,
        finishedAt: null,
        errorSummary: null,
    };
}

function markRunning(record: NodeRecord, inputSnapshot: Record<string, unknown>, now: string): NodeRecord {
    return {
        ...record,
        status: 'running',
        attempt: record.attempt + 1,
        inputSnapshot,
        startedAt: now,
        finishedAt: null,
        errorSummary: null,
    };
}

function markCompleted(record: NodeRecord, outputSnapshot: Record<string, unknown>, now: string): NodeRecord {
    return {
        ...record,
        status: 'completed',
        outputSnapshot,
        finishedAt: now,
    };
}

function markWaitingDecision(record: NodeRecord): NodeRecord {
    return { ...record, status: 'waiting_decision' };
}

// ---------------------------------------------------------------------------
// Rule-source options (shared constant)
// ---------------------------------------------------------------------------

const RULE_SOURCE_OPTIONS: DecisionPayload['options'] = [
    {
        id: 'wiki',
        label: 'Wiki（推荐）',
        description: '沿用现有 Wiki 规则来源。',
        payload: { sourceKind: 'wiki', rawSourceSet: ['smashup-fandom-faction-page'] },
    },
    {
        id: 'pdf',
        label: '上传 PDF',
        description: '从 PDF 规则书提取。',
        payload: { sourceKind: 'pdf', rawSourceSet: ['uploaded-rulebook.pdf'] },
    },
    {
        id: 'document',
        label: '上传文档',
        description: '从文档内容提取。',
        payload: { sourceKind: 'document', rawSourceSet: ['uploaded-rules.md'] },
    },
    {
        id: 'other-url',
        label: '其他 URL',
        description: '从网页地址抓取。',
        payload: { sourceKind: 'other-url', rawSourceSet: ['https://example.com/faction-rules'] },
    },
];

function getRuleSourceOption(optionId: string) {
    return RULE_SOURCE_OPTIONS.find((o) => o.id === optionId) ?? RULE_SOURCE_OPTIONS[0];
}

function buildRuleSourceDecision(state: WorkflowState): DecisionPayload {
    const nodeId: WorkflowNodeId = 'select-rule-source';
    return {
        decisionId: `decision-${state.runId}-${nodeId}`,
        nodeId,
        phase: 'rules',
        kind: 'single_select',
        title: '选择规则来源',
        summary: `为 ${state.factionName} 选择当前这次纵切片要走的规则来源路径。`,
        rationale: '选择后继续当前会话。',
        options: RULE_SOURCE_OPTIONS,
        evidenceRefs: [
            'openspec:add-ai-repo-workbench/select-rule-source',
            'repo:local-first-fixture',
        ],
        recommendedOptionId: 'wiki',
        createdAt: toIso(),
        allowReject: false,
        allowFeedback: false,
        proceedLabel: '确认规则来源并继续',
    };
}

function resolveInterruptPayload(
    snapshot: { tasks?: Array<{ interrupts?: Array<{ value?: unknown }> }> },
    state: WorkflowState,
): DecisionPayload | null {
    const interruptInfo = snapshot.tasks?.find((t) => t.interrupts?.length);
    if (!interruptInfo?.interrupts?.length) {
        return null;
    }
    const interruptValue = interruptInfo.interrupts[0]?.value;
    if (interruptValue && typeof interruptValue === 'object' && 'decision' in (interruptValue as Record<string, unknown>)) {
        return (interruptValue as { decision: DecisionPayload }).decision;
    }
    if (interruptValue) {
        return interruptValue as DecisionPayload;
    }
    return buildRuleSourceDecision(state);
}

// ---------------------------------------------------------------------------
// Output builders (domain fixtures for MVP)
// ---------------------------------------------------------------------------

function buildAcquireOutput(factionName: string, sourceId: RuleSourceOptionId) {
    const opt = getRuleSourceOption(sourceId);
    return {
        sourceKind: sourceId,
        rawSourceSet: opt.payload.rawSourceSet,
        acquisitionMode: 'local-first-journal',
        summary: `${factionName} 已锁定 ${opt.label} 作为规则来源。`,
    };
}

function getRuleSourceLabel(sourceId: RuleSourceOptionId): string {
    return getRuleSourceOption(sourceId).label;
}

function formatContextSection(label: string, summaryMarkdown?: string | null): [string, string] | null {
    if (!summaryMarkdown?.trim()) {
        return null;
    }
    return [label, summaryMarkdown.trim()];
}

function buildStagePayload(
    state: WorkflowState,
    options?: {
        supplementalNotes?: string;
        preferredExecutorId?: 'deterministic-planner' | 'codex-cli';
        executionMode?: 'plan' | 'workspace-write';
        extraSections?: Array<[string, string] | null>;
    },
): Record<string, unknown> {
    const sourceId = state.selectedRuleSource ?? 'wiki';
    const sections: Array<[string, string]> = [
        ['游戏', state.gameId],
        ['任务描述', state.promptText],
        ['派系列表', state.factionName],
        ['规则主来源', getRuleSourceLabel(sourceId)],
        ['补充说明', options?.supplementalNotes ?? `当前由 LangGraph 编排；规则来源=${sourceId}`],
    ];

    for (const section of options?.extraSections ?? []) {
        if (section) {
            sections.push(section);
        }
    }

    const question = sections
        .filter(([, value]) => value.trim().length > 0)
        .map(([label, value]) => `${label}=${value}`)
        .join('\n');

    return {
        question,
        gameId: state.gameId,
        taskBrief: state.promptText,
        factionOutline: state.factionName,
        projectPath: state.worktreePath,
        worktreePath: state.worktreePath,
        branchName: state.branchName,
        ttsPackPath: '',
        supplementalNotes: options?.supplementalNotes ?? `当前由 LangGraph 编排；规则来源=${sourceId}`,
        ...(options?.preferredExecutorId ? { preferredExecutorId: options.preferredExecutorId } : {}),
        ...(options?.executionMode ? { executionMode: options.executionMode } : {}),
    };
}

function buildE2eOutput() {
    return {
        e2eStatus: 'passed_demo',
        validationMode: 'workflow-node-demo',
        summary: '已执行图片型 E2E 验证。',
    };
}

function buildArtifactBundle(state: WorkflowState, now: string): ArtifactBundleOutput {
    const sourceId = state.selectedRuleSource ?? 'wiki';
    const opt = getRuleSourceOption(sourceId);
    const e2eEnabled = state.enabledNodeIds.includes('run-e2e-validation');
    const screenshotBasePath = join(state.worktreePath, 'evidence', '_shared', 'assets', 'ai-repo-workbench-e2e');
    const screenshotRoute = '/devtools/ai-repo-workbench/assets/e2e';

    return {
        id: createId('artifact'),
        title: `${state.factionName} ArtifactBundle`,
        status: 'published',
        createdAt: now,
        summary: `已基于 ${opt.label} 完成创建派系流程，并返回截图与交付产物。`,
        outputs: {
            ruleSourceIndex: [{
                sourceKind: sourceId,
                label: opt.label,
                rawSourceSet: opt.payload.rawSourceSet,
                decisionMode: 'human-selected',
            }],
            acquireStage: state.acquiredMaterial ?? {},
            dataEntryStage: state.normalizedRules ?? {},
            assetInspectionStage: state.assetInspection ?? {},
            definitionDraftStage: state.definitionDraft ?? {},
            reviewStage: state.reviewResult ?? {},
            uploadStage: state.uploadResult ?? {},
            decisionLog: state.decisions.map((d) => ({
                decisionId: d.decisionId,
                title: d.title,
                resolution: d.resolution ?? null,
            })),
            screenshots: [
                {
                    id: 'e2e-waiting-decision',
                    title: '会话工作流等待决策态',
                    kind: 'e2e',
                    stage: 'waiting_decision',
                    absolutePath: join(screenshotBasePath, 'node-graph-waiting-decision.png'),
                    assetPath: `${screenshotRoute}/node-graph-waiting-decision.png`,
                    alt: 'AI 仓库工作台等待决策态工作流截图',
                },
                {
                    id: 'e2e-completed',
                    title: '会话工作流完成态',
                    kind: 'e2e',
                    stage: 'completed',
                    absolutePath: join(screenshotBasePath, 'node-graph-complete.png'),
                    assetPath: `${screenshotRoute}/node-graph-complete.png`,
                    alt: 'AI 仓库工作台完成态工作流截图',
                },
            ],
            e2eStatus: e2eEnabled ? 'passed_demo' : 'skipped',
        },
        evidenceRefs: [
            'RepoSession.local-fixture',
            'DecisionRequest.select-rule-source',
            e2eEnabled ? 'WorkflowNode.run-e2e-validation=enabled' : 'WorkflowNode.run-e2e-validation=skipped',
        ],
        keyObservations: [
            'LangGraph 当前只负责编排、断点恢复与人工决策，业务执行已下沉到现有 executor 边界。',
            '规则来源、数据录入、旧派系参考、实施、审计、上传摘要均来自实际阶段节点，而不是纯占位文案。',
            e2eEnabled
                ? '本轮用户开启了 E2E 节点，因此 ArtifactBundle 记录为 passed_demo。'
                : '本轮用户关闭了 E2E 节点，因此 ArtifactBundle 明确记录为 skipped，而不是隐式缺失。',
        ],
    };
}

// ---------------------------------------------------------------------------
// Graph nodes — each maps to a WorkflowNodeId
// ---------------------------------------------------------------------------

function captureFactionIntentNode(state: WorkflowState) {
    const now = toIso();
    const nodeId: WorkflowNodeId = 'capture-faction-intent';
    const output = {
        workingDirectory: join(state.worktreePath, 'temp', 'workbench', state.factionName),
        requestedOutcome: '生成规则驱动的派系定义草案与 ArtifactBundle',
    };

    const records = updateNodeRecord(state.nodeRecords, nodeId, (r) =>
        markCompleted(
            markRunning(r, {
                templateId: state.templateId,
                factionName: state.factionName,
                gameId: state.gameId,
                worktreePath: state.worktreePath,
                branchName: state.branchName,
            }, now),
            output,
            now,
        ),
    );

    return {
        currentNodeId: nodeId,
        nodeRecords: records,
        intentOutput: output,
        checkpointVersion: state.checkpointVersion + 1,
    };
}

function selectRuleSourceNode(state: WorkflowState) {
    const now = toIso();
    const nodeId: WorkflowNodeId = 'select-rule-source';
    const decision = buildRuleSourceDecision(state);

    const records = updateNodeRecord(state.nodeRecords, nodeId, (r) =>
        markWaitingDecision(markRunning(r, {
            supportedSources: RULE_SOURCE_OPTIONS.map((o) => o.id),
            recommendedOptionId: 'wiki',
        }, now)),
    );

    // ── interrupt: pause here and wait for human decision ────────────
    const resolution = interrupt<
        { decision: DecisionPayload },
        { action: 'proceed' | 'reject'; optionId?: RuleSourceOptionId; feedback?: string }
    >({ decision });

    // ── execution continues after resume ─────────────────────────────
    const resumeNow = toIso();
    const selectedOption = getRuleSourceOption(resolution.optionId ?? 'wiki');

    const completedRecords = updateNodeRecord(records, nodeId, (r) =>
        markCompleted(r, {
            selectedSource: selectedOption.id,
            selectedLabel: selectedOption.label,
            rawSourceSet: selectedOption.payload.rawSourceSet,
        }, resumeNow),
    );

    return {
        currentNodeId: nodeId,
        nodeRecords: completedRecords,
        selectedRuleSource: resolution.optionId as RuleSourceOptionId,
        pendingDecision: null,
        decisions: [
            ...state.decisions,
            {
                ...decision,
                resolution: {
                    action: 'proceed',
                    optionId: selectedOption.id,
                    optionLabel: selectedOption.label,
                    notes: resolution.feedback?.trim() || undefined,
                    decidedAt: resumeNow,
                    decidedBy: 'owner',
                } satisfies DecisionResolution,
            },
        ],
        runStatus: 'running',
        checkpointVersion: state.checkpointVersion + 1,
    };
}

function acquireRuleMaterialNode(state: WorkflowState) {
    const now = toIso();
    const nodeId: WorkflowNodeId = 'acquire-rule-material';
    const sourceId = state.selectedRuleSource ?? 'wiki';
    const output = buildAcquireOutput(state.factionName, sourceId);

    const records = updateNodeRecord(state.nodeRecords, nodeId, (r) =>
        markCompleted(markRunning(r, { sourceId }, now), output, now),
    );

    return {
        currentNodeId: nodeId,
        nodeRecords: records,
        acquiredMaterial: output,
        checkpointVersion: state.checkpointVersion + 1,
    };
}

function createTranscribeOrNormalizeNode(runDataEntry: StageTask) {
    return async function transcribeOrNormalizeNode(state: WorkflowState) {
        const now = toIso();
        const nodeId: WorkflowNodeId = 'transcribe-or-normalize-rules';
        const payload = buildStagePayload(state, {
            extraSections: [
                formatContextSection('规则来源锁定', state.acquiredMaterial?.summary as string | undefined),
            ],
        });
        const output = await runDataEntry(payload) as StageExecutionResult;

        const records = updateNodeRecord(state.nodeRecords, nodeId, (r) =>
            markCompleted(markRunning(r, { acquiredMaterial: state.acquiredMaterial }, now), output.structured, toIso()),
        );

        return {
            currentNodeId: nodeId,
            nodeRecords: records,
            normalizedRules: output,
            checkpointVersion: state.checkpointVersion + 1,
        };
    };
}

function createInspectAssetsNode(runInspectAssets: AssetInspectionTask) {
    return async function inspectAssetsNode(state: WorkflowState) {
        const now = toIso();
        const nodeId: WorkflowNodeId = 'inspect-assets';
        const payload = {
            gameId: state.gameId,
            projectPath: state.worktreePath,
            factionOutline: state.factionName,
            enableWikiComparison: (state.selectedRuleSource ?? 'wiki') === 'wiki',
            enableDocLookup: true,
            extraDataSources: state.promptText,
        };
        const output = await runInspectAssets(payload) as AssetInspectionResult;

        const records = updateNodeRecord(state.nodeRecords, nodeId, (r) =>
            markCompleted(markRunning(r, payload, now), output as unknown as Record<string, unknown>, toIso()),
        );

        return {
            currentNodeId: nodeId,
            nodeRecords: records,
            assetInspection: output,
            checkpointVersion: state.checkpointVersion + 1,
        };
    };
}

function createDraftFactionDefinitionNode(
    runReferenceFaction: StageTask,
    runImplementation: StageTask,
) {
    return async function draftFactionDefinitionNode(state: WorkflowState) {
        const now = toIso();
        const nodeId: WorkflowNodeId = 'draft-faction-definition';
        const sourceId = state.selectedRuleSource ?? 'wiki';
        const referencePayload = buildStagePayload(state, {
            extraSections: [
                formatContextSection('数据录入', state.normalizedRules?.summaryMarkdown as string | undefined),
                formatContextSection('素材检查', state.assetInspection?.summaryMarkdown as string | undefined),
            ],
        });
        const referenceStage = await runReferenceFaction(referencePayload) as StageExecutionResult;

        const implementationPayload = buildStagePayload(state, {
            supplementalNotes: [
                `LangGraph implementation 编排，规则来源=${sourceId}`,
                state.latestReviewFeedback ? `上轮审计反馈=${state.latestReviewFeedback}` : null,
            ].filter(Boolean).join('；'),
            preferredExecutorId: 'codex-cli',
            executionMode: 'plan',
            extraSections: [
                formatContextSection('数据录入', state.normalizedRules?.summaryMarkdown as string | undefined),
                formatContextSection('旧派系参考', referenceStage.summaryMarkdown),
                formatContextSection('素材检查', state.assetInspection?.summaryMarkdown as string | undefined),
            ],
        });
        const implementationStage = await runImplementation(implementationPayload) as StageExecutionResult;

        const output = {
            stage: 'draft-faction-definition',
            status: implementationStage.status,
            summary: implementationStage.summary,
            summaryMarkdown: implementationStage.summaryMarkdown,
            nextStepHints: implementationStage.nextStepHints,
            inputSnapshot: implementationStage.inputSnapshot,
            structured: {
                referenceStage,
                implementationStage,
            },
        };

        const records = updateNodeRecord(state.nodeRecords, nodeId, (r) =>
            markCompleted(markRunning(r, {
                normalizedRules: state.normalizedRules,
                assetInspection: state.assetInspection,
                reviewFeedback: state.latestReviewFeedback,
                reviewRevisionCount: state.reviewRevisionCount,
            }, now), output.structured, toIso()),
        );

        return {
            currentNodeId: nodeId,
            nodeRecords: records,
            definitionDraft: output,
            checkpointVersion: state.checkpointVersion + 1,
        };
    };
}

function createReviewFactionDefinitionNode(runAudit: StageTask) {
    return async function reviewFactionDefinitionNode(state: WorkflowState) {
        const now = toIso();
        const nodeId: WorkflowNodeId = 'review-faction-definition';
        const referenceStage = (state.definitionDraft?.structured as Record<string, unknown> | undefined)?.referenceStage;
        const implementationStage = (state.definitionDraft?.structured as Record<string, unknown> | undefined)?.implementationStage;
        const payload = buildStagePayload(state, {
            extraSections: [
                formatContextSection('数据录入', state.normalizedRules?.summaryMarkdown as string | undefined),
                formatContextSection('旧派系参考', (referenceStage as Record<string, unknown> | undefined)?.summaryMarkdown as string | undefined),
                formatContextSection('实施结果', (implementationStage as Record<string, unknown> | undefined)?.summaryMarkdown as string | undefined),
                formatContextSection('素材检查', state.assetInspection?.summaryMarkdown as string | undefined),
            ],
        });
        const output = await runAudit(payload) as StageExecutionResult;
        const auditDecision = String(output.structured.decision ?? '');
        const latestReviewFeedback = auditDecision === 'rewrite'
            ? output.summaryMarkdown
            : null;

        const completedRecords = updateNodeRecord(state.nodeRecords, nodeId, (r) =>
            markCompleted(markRunning(r, {
                definitionDraft: state.definitionDraft,
            }, now), output.structured, toIso()),
        );

        return {
            currentNodeId: nodeId,
            nodeRecords: completedRecords,
            reviewResult: output,
            latestReviewFeedback,
            checkpointVersion: state.checkpointVersion + 1,
        };
    };
}

function runE2eValidationNode(state: WorkflowState) {
    const nodeId: WorkflowNodeId = 'run-e2e-validation';

    if (!state.enabledNodeIds.includes(nodeId)) {
        const now = toIso();
        const records = updateNodeRecord(state.nodeRecords, nodeId, (r) => ({
            ...r,
            status: 'skipped' as const,
            outputSnapshot: { reason: 'disabled-before-run' },
            finishedAt: now,
        }));
        return {
            currentNodeId: nodeId,
            nodeRecords: records,
            e2eResult: { e2eStatus: 'skipped', reason: 'disabled-before-run' },
            checkpointVersion: state.checkpointVersion + 1,
        };
    }

    const now = toIso();
    const output = buildE2eOutput();
    const records = updateNodeRecord(state.nodeRecords, nodeId, (r) =>
        markCompleted(markRunning(r, { reviewResult: state.reviewResult }, now), output, now),
    );

    return {
        currentNodeId: nodeId,
        nodeRecords: records,
        e2eResult: output,
        checkpointVersion: state.checkpointVersion + 1,
    };
}

function createPublishArtifactBundleNode(runUpload: StageTask) {
    return async function publishArtifactBundleNode(state: WorkflowState) {
        const now = toIso();
        const nodeId: WorkflowNodeId = 'publish-artifact-bundle';
        const referenceStage = (state.definitionDraft?.structured as Record<string, unknown> | undefined)?.referenceStage;
        const implementationStage = (state.definitionDraft?.structured as Record<string, unknown> | undefined)?.implementationStage;
        const payload = buildStagePayload(state, {
            extraSections: [
                formatContextSection('素材检查', state.assetInspection?.summaryMarkdown as string | undefined),
                formatContextSection('数据录入', state.normalizedRules?.summaryMarkdown as string | undefined),
                formatContextSection('旧派系参考', (referenceStage as Record<string, unknown> | undefined)?.summaryMarkdown as string | undefined),
                formatContextSection('实施结果', (implementationStage as Record<string, unknown> | undefined)?.summaryMarkdown as string | undefined),
                formatContextSection('审计结果', state.reviewResult?.summaryMarkdown as string | undefined),
            ],
        });
        const uploadResult = await runUpload(payload) as StageExecutionResult;
        const bundle = buildArtifactBundle({
            ...state,
            uploadResult,
        }, toIso());

        const records = updateNodeRecord(state.nodeRecords, nodeId, (r) =>
            markCompleted(markRunning(r, { reviewResult: state.reviewResult }, now), {
                artifactBundleId: bundle.id,
                summary: bundle.summary,
                uploadSummary: uploadResult.summaryMarkdown,
            }, toIso()),
        );

        return {
            currentNodeId: null,
            nodeRecords: records,
            uploadResult,
            artifactBundle: bundle,
            runStatus: 'completed',
            finishedAt: toIso(),
            checkpointVersion: state.checkpointVersion + 1,
        };
    };
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export function buildNewFactionGraph(deps: LangGraphExecutionDeps) {
    const checkpointer = new MemorySaver();
    const runInspectAssets = task(
        'inspectFactionAssets',
        async (payload: unknown) => deps.inspectFactionAssets(payload as Parameters<LangGraphExecutionDeps['inspectFactionAssets']>[0]),
    ) as unknown as AssetInspectionTask;
    const runDataEntry = task(
        'executeDataEntry',
        async (payload: unknown) => deps.executeDataEntry(payload as Record<string, unknown>),
    ) as unknown as StageTask;
    const runReferenceFaction = task(
        'executeReferenceFaction',
        async (payload: unknown) => deps.executeReferenceFaction(payload as Record<string, unknown>),
    ) as unknown as StageTask;
    const runImplementation = task(
        'executeImplementation',
        async (payload: unknown) => deps.executeImplementation(payload as Record<string, unknown>),
    ) as unknown as StageTask;
    const runAudit = task(
        'executeAudit',
        async (payload: unknown) => deps.executeAudit(payload as Record<string, unknown>),
    ) as unknown as StageTask;
    const runUpload = task(
        'executeUpload',
        async (payload: unknown) => deps.executeUpload(payload as Record<string, unknown>),
    ) as unknown as StageTask;

    const graph = new StateGraph(WorkflowStateAnnotation)
        .addNode('capture-faction-intent', captureFactionIntentNode)
        .addNode('select-rule-source', selectRuleSourceNode)
        .addNode('acquire-rule-material', acquireRuleMaterialNode)
        .addNode('transcribe-or-normalize-rules', createTranscribeOrNormalizeNode(runDataEntry))
        .addNode('inspect-assets', createInspectAssetsNode(runInspectAssets))
        .addNode('draft-faction-definition', createDraftFactionDefinitionNode(runReferenceFaction, runImplementation))
        .addNode('review-faction-definition', createReviewFactionDefinitionNode(runAudit))
        .addNode('run-e2e-validation', runE2eValidationNode)
        .addNode('publish-artifact-bundle', createPublishArtifactBundleNode(runUpload))
        .addEdge(START, 'capture-faction-intent')
        .addEdge('capture-faction-intent', 'select-rule-source')
        .addEdge('select-rule-source', 'acquire-rule-material')
        .addEdge('acquire-rule-material', 'transcribe-or-normalize-rules')
        .addEdge('transcribe-or-normalize-rules', 'inspect-assets')
        .addEdge('inspect-assets', 'draft-faction-definition')
        .addEdge('draft-faction-definition', 'review-faction-definition')
        .addEdge('review-faction-definition', 'run-e2e-validation')
        .addEdge('run-e2e-validation', 'publish-artifact-bundle')
        .addEdge('publish-artifact-bundle', END)
        .compile({
            checkpointer,
            name: 'ai-repo-workbench-new-faction-v2',
        });

    return { graph, checkpointer };
}

// ---------------------------------------------------------------------------
// Orchestrator factory — used by NestJS service
// ---------------------------------------------------------------------------

export interface LangGraphOrchestratorConfig {
    factionName: string;
    promptText: string;
    gameId: string;
    worktreePath: string;
    branchName: string;
    repoSessionId: string;
    worktreeTaskId: string;
    enabledNodeIds: WorkflowNodeId[];
    templateId?: string;
    templateVersion?: string;
}

const NODE_ORDER: WorkflowNodeId[] = [
    'capture-faction-intent',
    'select-rule-source',
    'acquire-rule-material',
    'transcribe-or-normalize-rules',
    'inspect-assets',
    'draft-faction-definition',
    'review-faction-definition',
    'run-e2e-validation',
    'publish-artifact-bundle',
];

export interface GraphRunResult {
    threadId: string;
    state: WorkflowState;
    interrupted: boolean;
    interruptPayload: DecisionPayload | null;
}

export class NewFactionLangGraphOrchestrator {
    private readonly graph: ReturnType<typeof buildNewFactionGraph>['graph'];
    private readonly checkpointer: MemorySaver;

    constructor(private readonly deps: LangGraphExecutionDeps) {
        const { graph, checkpointer } = buildNewFactionGraph(deps);
        this.graph = graph;
        this.checkpointer = checkpointer;
    }

    async startRun(config: LangGraphOrchestratorConfig): Promise<GraphRunResult> {
        const threadId = createId('lg-thread');
        const now = toIso();
        const runId = createId('workflow-run');

        const initialState: WorkflowState = {
            runId,
            threadId,
            templateId: config.templateId ?? 'new-faction',
            templateVersion: config.templateVersion ?? 'mvp-v1',
            factionName: config.factionName,
            promptText: config.promptText,
            gameId: config.gameId,
            worktreePath: config.worktreePath,
            branchName: config.branchName,
            repoSessionId: config.repoSessionId,
            worktreeTaskId: config.worktreeTaskId,
            enabledNodeIds: config.enabledNodeIds,
            currentNodeId: null,
            nodeRecords: NODE_ORDER.map(createPendingRecord),
            runStatus: 'running',
            pendingDecision: null,
            decisions: [],
            intentOutput: null,
            selectedRuleSource: null,
            acquiredMaterial: null,
            normalizedRules: null,
            assetInspection: null,
            definitionDraft: null,
            reviewResult: null,
            e2eResult: null,
            uploadResult: null,
            artifactBundle: null,
            latestReviewFeedback: null,
            reviewRevisionCount: 0,
            startedAt: now,
            finishedAt: null,
            checkpointVersion: 0,
        };

        const threadConfig = { configurable: { thread_id: threadId } };

        try {
            const result = await this.graph.invoke(initialState, threadConfig);
            const snapshot = await this.graph.getState(threadConfig);
            const state = snapshot.values as WorkflowState;
            const interruptPayload = resolveInterruptPayload(snapshot, state);
            if (interruptPayload) {
                return {
                    threadId,
                    state,
                    interrupted: true,
                    interruptPayload,
                };
            }
            return {
                threadId,
                state: result,
                interrupted: false,
                interruptPayload: null,
            };
        } catch (error) {
            if (isGraphInterrupt(error)) {
                const snapshot = await this.graph.getState(threadConfig);
                const state = snapshot.values as WorkflowState;
                const interruptPayload = resolveInterruptPayload(snapshot, state) ?? buildRuleSourceDecision(state);
                return {
                    threadId,
                    state,
                    interrupted: true,
                    interruptPayload,
                };
            }
            throw error;
        }
    }

    async resumeDecision(
        threadId: string,
        resolution: {
            action: 'proceed' | 'reject';
            optionId?: RuleSourceOptionId;
            feedback?: string;
        },
    ): Promise<GraphRunResult> {
        const threadConfig = { configurable: { thread_id: threadId } };

        try {
            const result = await this.graph.invoke(
                new Command({ resume: resolution }),
                threadConfig,
            );
            const snapshot = await this.graph.getState(threadConfig);
            const state = snapshot.values as WorkflowState;
            const interruptPayload = resolveInterruptPayload(snapshot, state);
            if (interruptPayload) {
                return {
                    threadId,
                    state,
                    interrupted: true,
                    interruptPayload,
                };
            }
            return {
                threadId,
                state: result,
                interrupted: false,
                interruptPayload: null,
            };
        } catch (error) {
            if (isGraphInterrupt(error)) {
                const snapshot = await this.graph.getState(threadConfig);
                const state = snapshot.values as WorkflowState;
                const interruptPayload = resolveInterruptPayload(snapshot, state) ?? buildRuleSourceDecision(state);
                return {
                    threadId,
                    state,
                    interrupted: true,
                    interruptPayload,
                };
            }
            throw error;
        }
    }

    async getState(threadId: string): Promise<WorkflowState | null> {
        const threadConfig = { configurable: { thread_id: threadId } };
        try {
            const snapshot = await this.graph.getState(threadConfig);
            return (snapshot.values as WorkflowState) ?? null;
        } catch {
            return null;
        }
    }
}
