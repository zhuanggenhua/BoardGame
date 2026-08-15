import type {
    DecisionRequest,
    NodeExecutionRecord,
    OptionalWorkflowNodeId,
    RuleSourceOptionId,
    WorkflowNodeId,
    WorkflowRun,
    WorkbenchJournal,
} from './runtime';

export interface PauseForDecisionPayload {
    run: WorkflowRun;
    decision: DecisionRequest;
    nodeRecords: NodeExecutionRecord[];
}

export interface StartWorkflowRunPayload {
    templateId: WorkflowRun['templateId'];
    subject: string;
    prompt: string;
    projectPath?: string;
    nodeToggles?: Partial<Record<OptionalWorkflowNodeId, boolean>>;
}

export interface ResumeRunPayload {
    decisionId: string;
    action: 'proceed' | 'reject';
    optionId?: RuleSourceOptionId;
    feedback?: string;
}

export interface RunNodePayload {
    runId: string;
    nodeId: WorkflowNodeId;
}

export interface PublishArtifactBundlePayload {
    runId: string;
    nodeId: 'publish-artifact-bundle';
}

const joinWorkbenchPath = (root: string, ...segments: string[]) => [
    root.replace(/[\\/]+$/, ''),
    ...segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, '')),
].filter(Boolean).join('/');

export type WorkflowMutationResult = WorkbenchJournal | Promise<WorkbenchJournal>;

export interface LocalRuntime {
    pauseForDecision(
        journal: WorkbenchJournal,
        payload: PauseForDecisionPayload,
        now?: number,
    ): WorkbenchJournal;
    resumeRun(
        journal: WorkbenchJournal,
        payload: ResumeRunPayload,
        now?: number,
    ): WorkbenchJournal;
    runNode(
        journal: WorkbenchJournal,
        payload: RunNodePayload,
        now?: number,
    ): WorkbenchJournal;
    publishArtifactBundle(
        journal: WorkbenchJournal,
        payload: PublishArtifactBundlePayload,
        now?: number,
    ): WorkbenchJournal;
}

export interface WorkflowOrchestrator {
    startWorkflowRun(
        journal: WorkbenchJournal,
        payload: StartWorkflowRunPayload,
        now?: number,
    ): WorkflowMutationResult;
    submitDecision(
        journal: WorkbenchJournal,
        payload: ResumeRunPayload,
        now?: number,
    ): WorkflowMutationResult;
    advance(
        journal: WorkbenchJournal,
        now?: number,
    ): WorkflowMutationResult;
}

interface WorkflowOrchestratorDeps {
    autoNodeDurationMs: number;
    defaultTemplateId: WorkflowRun['templateId'];
    localRuntime: LocalRuntime;
    createId: (prefix: string) => string;
    toIso: (now?: number) => string;
    sanitizeFactionPathSegment: (value: string) => string;
    createPendingNodeRecord: (runId: string, nodeId: WorkflowNodeId) => NodeExecutionRecord;
    createSkippedNodeRecord: (runId: string, nodeId: OptionalWorkflowNodeId, now: number) => NodeExecutionRecord;
    resolveEnabledNodeIds: (
        templateId: WorkflowRun['templateId'],
        nodeToggles?: Partial<Record<OptionalWorkflowNodeId, boolean>>,
    ) => WorkflowNodeId[];
    syncManagedWorktree: (
        journal: WorkbenchJournal,
        worktreeId: string,
        updater: (task: WorkbenchJournal['managedWorktrees'][number]) => WorkbenchJournal['managedWorktrees'][number],
    ) => WorkbenchJournal;
    getActiveWorktreeTask: (journal: WorkbenchJournal) => WorkbenchJournal['managedWorktrees'][number] | undefined;
    updateNodeRecord: (
        journal: WorkbenchJournal,
        runId: string,
        nodeId: WorkflowNodeId,
        updater: (record: NodeExecutionRecord) => NodeExecutionRecord,
    ) => WorkbenchJournal;
    updateRun: (
        journal: WorkbenchJournal,
        runId: string,
        updater: (run: WorkflowRun) => WorkflowRun,
    ) => WorkbenchJournal;
    getWorkflowTemplateDefinition: (templateId: WorkflowRun['templateId']) => {
        id: WorkflowRun['templateId'];
        version: string;
        title: string;
        runnable: boolean;
        nodeOrder: WorkflowNodeId[];
    };
    ruleSourceOptions: DecisionRequest['options'];
}

export function createLocalWorkflowOrchestrator(deps: WorkflowOrchestratorDeps): WorkflowOrchestrator {
    function startNextPendingNode(journal: WorkbenchJournal, runId: string, now: number): WorkbenchJournal {
        const run = journal.runs.find((item) => item.id === runId);
        if (!run || run.status !== 'running') {
            return journal;
        }

        const nextRecord = journal.nodeRecords.find((record) => record.runId === runId && record.status === 'pending');
        if (!nextRecord) {
            return journal;
        }

        const startedJournal = deps.updateNodeRecord(journal, runId, nextRecord.nodeId, (record) => ({
            ...record,
            status: 'running',
            attempt: Math.max(record.attempt, 1),
            startedAt: deps.toIso(now),
            inputRef: `${record.nodeId}.input.started`,
            inputSnapshot: {
                runId,
                subject: run.context.subject,
                prompt: run.context.prompt,
            },
        }));

        return deps.updateRun(startedJournal, runId, (activeRun) => ({
            ...activeRun,
            currentNodeId: nextRecord.nodeId,
        }));
    }

    return {
        startWorkflowRun(journal, payload, now = Date.now()) {
            const activeWorktree = deps.getActiveWorktreeTask(journal);
            const template = deps.getWorkflowTemplateDefinition(payload.templateId || deps.defaultTemplateId);
            if (!activeWorktree) {
                return journal;
            }
            if (!template.runnable) {
                throw new Error(`工作流 ${template.id} 当前还没有接入执行器。`);
            }

            const subject = payload.subject.trim() || '未命名任务';
            const prompt = payload.prompt.trim() || `启动 ${template.title}：${subject}`;
            const runId = deps.createId('workflow-run');
            const decisionId = deps.createId('decision');
            const createdAt = deps.toIso(now);

            const run: WorkflowRun = {
                id: runId,
                templateId: template.id,
                templateVersion: template.version,
                repoSessionId: journal.repoSession.id,
                worktreeTaskId: activeWorktree.id,
                status: 'waiting_decision',
                currentNodeId: 'select-rule-source',
                checkpointVersion: 1,
                startedAt: createdAt,
                latestDecisionRequestId: decisionId,
                title: `${subject} / ${template.title} / ${activeWorktree.branchName}`,
                enabledNodeIds: deps.resolveEnabledNodeIds(template.id, payload.nodeToggles),
                context: {
                    gameId: template.id === 'new-faction' ? 'smashup' : undefined,
                    factionName: template.id === 'new-faction' ? subject : undefined,
                    subject,
                    prompt,
                },
            };

            const decision: DecisionRequest = {
                id: decisionId,
                runId,
                nodeId: 'select-rule-source',
                phase: 'rules',
                kind: 'single_select',
                title: '选择规则来源',
                summary: `为 ${subject} 选择当前这次纵切片要走的规则来源路径。`,
                blocking: true,
                rationale: '首个真实人工决策点必须可见、可恢复、可审计。',
                options: deps.ruleSourceOptions,
                evidenceRefs: [
                    'openspec:add-ai-repo-workbench/select-rule-source',
                    'repo:local-first-fixture',
                ],
                recommendedOptionId: 'wiki',
                createdAt,
                resumeToken: deps.createId('resume-token'),
                allowReject: false,
                allowFeedback: false,
                proceedLabel: '确认规则来源并继续',
            };

            const captureNode: NodeExecutionRecord = {
                nodeId: 'capture-faction-intent',
                runId,
                status: 'completed',
                attempt: 1,
                inputRef: 'capture-faction-intent.input.fixture',
                inputSnapshot: {
                    templateId: template.id,
                    subject,
                    prompt,
                    gameId: 'smashup',
                    worktreePath: activeWorktree.worktreePath,
                    branchName: activeWorktree.branchName,
                },
                outputRef: 'capture-faction-intent.output.intent',
                outputSnapshot: {
                    workingDirectory: joinWorkbenchPath(
                        activeWorktree.worktreePath,
                        'temp',
                        'workbench',
                        deps.sanitizeFactionPathSegment(subject),
                    ),
                    requestedOutcome: '生成规则驱动的派系定义草案与 ArtifactBundle',
                },
                startedAt: createdAt,
                finishedAt: createdAt,
            };

            const selectRuleSourceNode: NodeExecutionRecord = {
                nodeId: 'select-rule-source',
                runId,
                status: 'waiting_decision',
                attempt: 1,
                inputRef: 'select-rule-source.input.options',
                inputSnapshot: {
                    supportedSources: deps.ruleSourceOptions.map((option) => option.id),
                    recommendedOptionId: 'wiki',
                },
                stateRef: 'select-rule-source.state.decision-request',
                stateSnapshot: {
                    decisionRequestId: decisionId,
                },
                startedAt: createdAt,
            };

            const nextNodes = template.nodeOrder
                .filter((nodeId) => !['capture-faction-intent', 'select-rule-source'].includes(nodeId))
                .map((nodeId) => (
                    run.enabledNodeIds.includes(nodeId)
                        ? deps.createPendingNodeRecord(runId, nodeId)
                        : deps.createSkippedNodeRecord(runId, nodeId as OptionalWorkflowNodeId, now)
                ));

            return deps.localRuntime.pauseForDecision(journal, {
                run,
                decision,
                nodeRecords: [captureNode, selectRuleSourceNode, ...nextNodes],
            }, now);
        },

        submitDecision(journal, payload, now = Date.now()) {
            const resumedJournal = deps.localRuntime.resumeRun(journal, payload, now);
            const decision = resumedJournal.decisions.find((item) => item.id === payload.decisionId);
            const runId = decision?.runId ?? journal.runs.find((item) => item.latestDecisionRequestId === payload.decisionId)?.id;
            if (!runId) {
                return resumedJournal;
            }
            return startNextPendingNode(resumedJournal, runId, now);
        },

        advance(journal, now = Date.now()) {
            if (!journal.activeRunId) {
                return journal;
            }

            const run = journal.runs.find((item) => item.id === journal.activeRunId);
            if (!run || run.status !== 'running') {
                return journal;
            }

            const runningNode = journal.nodeRecords.find((record) => record.runId === run.id && record.status === 'running');
            if (!runningNode) {
                return startNextPendingNode(journal, run.id, now);
            }

            if (!runningNode.startedAt || now - Date.parse(runningNode.startedAt) < deps.autoNodeDurationMs) {
                return journal;
            }

            const nextJournal = runningNode.nodeId === 'publish-artifact-bundle'
                ? deps.localRuntime.publishArtifactBundle(journal, {
                    runId: run.id,
                    nodeId: 'publish-artifact-bundle',
                }, now)
                : deps.localRuntime.runNode(journal, {
                    runId: run.id,
                    nodeId: runningNode.nodeId,
                }, now);

            const nextRun = nextJournal.runs.find((item) => item.id === run.id);
            if (!nextRun || nextRun.status !== 'running') {
                return nextJournal;
            }
            return startNextPendingNode(nextJournal, run.id, now);
        },
    };
}
