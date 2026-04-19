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
import type {
    RuleSourceOptionId,
    WorkbenchJournal,
    WorkflowRun,
} from './runtime';
import type {
    ResumeRunPayload,
    StartWorkflowRunPayload,
    WorkflowOrchestrator,
} from './workflowServices';

interface LangGraphWorkflowOrchestratorDeps {
    localOrchestrator: WorkflowOrchestrator;
    createThreadId: () => string;
    toIso: (now?: number) => string;
}

type RunCheckpointStatus = 'waiting_decision' | 'resumed' | 'fallback';

type GraphInterruptValue = {
    decisionId: string;
    summary: string;
    recommendedOptionId?: RuleSourceOptionId;
    evidenceRefs: string[];
};

type GraphResumeValue = {
    action: 'proceed' | 'reject';
    optionId?: RuleSourceOptionId;
    feedback?: string;
    now?: number;
};

type WorkflowGraphState = {
    journal: WorkbenchJournal;
    startPayload: StartWorkflowRunPayload | null;
    resumePayload: ResumeRunPayload | null;
    threadId: string;
    now: number;
};

const WorkflowGraphAnnotation = Annotation.Root({
    journal: Annotation<WorkbenchJournal>,
    startPayload: Annotation<StartWorkflowRunPayload | null>,
    resumePayload: Annotation<ResumeRunPayload | null>,
    threadId: Annotation<string>,
    now: Annotation<number>,
});

function updateRun(
    journal: WorkbenchJournal,
    runId: string,
    updater: (run: WorkflowRun) => WorkflowRun,
): WorkbenchJournal {
    return {
        ...journal,
        runs: journal.runs.map((run) => (run.id === runId ? updater(run) : run)),
    };
}

function findRunByDecisionId(journal: WorkbenchJournal, decisionId: string): WorkflowRun | undefined {
    const decision = journal.decisions.find((item) => item.id === decisionId);
    if (decision) {
        return journal.runs.find((run) => run.id === decision.runId);
    }
    return journal.runs.find((run) => run.latestDecisionRequestId === decisionId);
}

function getActiveRun(journal: WorkbenchJournal): WorkflowRun | undefined {
    if (!journal.activeRunId) {
        return undefined;
    }
    return journal.runs.find((run) => run.id === journal.activeRunId);
}

function getPendingDecision(journal: WorkbenchJournal, runId?: string) {
    if (!runId) {
        return undefined;
    }
    return journal.decisions.find((decision) => decision.runId === runId && !decision.resolution);
}

function annotateRunCheckpoint(
    journal: WorkbenchJournal,
    runId: string,
    threadId: string | undefined,
    checkpointStatus: RunCheckpointStatus,
    now: number,
    engine: 'langgraph' | 'local' = 'langgraph',
): WorkbenchJournal {
    return updateRun(journal, runId, (run) => ({
        ...run,
        orchestrator: {
            engine,
            threadId,
            checkpointStatus,
            lastSyncAt: new Date(now).toISOString(),
        },
    }));
}

function annotateActiveRunCheckpoint(
    journal: WorkbenchJournal,
    threadId: string | undefined,
    checkpointStatus: RunCheckpointStatus,
    now: number,
    engine: 'langgraph' | 'local' = 'langgraph',
): WorkbenchJournal {
    const activeRun = getActiveRun(journal);
    if (!activeRun) {
        return journal;
    }
    return annotateRunCheckpoint(journal, activeRun.id, threadId, checkpointStatus, now, engine);
}

function getJournalFromSnapshot(
    snapshot: unknown,
    fallbackJournal: WorkbenchJournal,
): WorkbenchJournal {
    if (!snapshot || typeof snapshot !== 'object') {
        return fallbackJournal;
    }
    const values = 'values' in snapshot && snapshot.values && typeof snapshot.values === 'object'
        ? snapshot.values as Partial<WorkflowGraphState>
        : null;
    return values?.journal ?? fallbackJournal;
}

function isRecoverableResumeFailure(error: unknown): boolean {
    if (isGraphInterrupt(error)) {
        return true;
    }
    if (!(error instanceof Error)) {
        return false;
    }
    return [
        'checkpoint',
        'thread',
        'resume',
        'missing',
        'not found',
    ].some((keyword) => error.message.toLowerCase().includes(keyword));
}

export function createLangGraphWorkflowOrchestrator(
    deps: LangGraphWorkflowOrchestratorDeps,
): WorkflowOrchestrator {
    const checkpointer = new MemorySaver();

    const startRunTask = task(
        'ai-repo-workbench-start-run',
        async (input: {
            journal: WorkbenchJournal;
            payload: StartWorkflowRunPayload;
            threadId: string;
            now: number;
        }) => {
            const nextJournal = await deps.localOrchestrator.startWorkflowRun(
                input.journal,
                input.payload,
                input.now,
            );
            return annotateActiveRunCheckpoint(
                nextJournal,
                input.threadId,
                'waiting_decision',
                input.now,
            );
        },
    );

    const resumeDecisionTask = task(
        'ai-repo-workbench-resume-decision',
        async (input: {
            journal: WorkbenchJournal;
            payload: ResumeRunPayload;
            threadId: string;
            now: number;
        }) => {
            const nextJournal = await deps.localOrchestrator.submitDecision(
                input.journal,
                input.payload,
                input.now,
            );
            const run = findRunByDecisionId(nextJournal, input.payload.decisionId);
            if (!run) {
                return nextJournal;
            }
            return annotateRunCheckpoint(
                nextJournal,
                run.id,
                input.threadId,
                'resumed',
                input.now,
            );
        },
    );

    const startRunNode = async (state: typeof WorkflowGraphAnnotation.State) => {
        if (!state.startPayload) {
            return {};
        }
        const nextJournal = await startRunTask({
            journal: state.journal,
            payload: state.startPayload,
            threadId: state.threadId,
            now: state.now,
        });
        return {
            journal: nextJournal,
        };
    };

    const waitForRuleSourceDecisionNode = (state: typeof WorkflowGraphAnnotation.State) => {
        const run = getActiveRun(state.journal);
        const decision = getPendingDecision(state.journal, run?.id);
        if (!decision) {
            return {};
        }
        const resolution = interrupt<GraphInterruptValue, GraphResumeValue>({
            decisionId: decision.id,
            summary: decision.summary,
            recommendedOptionId: decision.recommendedOptionId,
            evidenceRefs: decision.evidenceRefs,
        });
        return {
            resumePayload: {
                decisionId: decision.id,
                action: resolution.action,
                optionId: resolution.optionId,
                feedback: resolution.feedback,
            },
            now: resolution.now ?? Date.now(),
        };
    };

    const applyRuleSourceDecisionNode = async (state: typeof WorkflowGraphAnnotation.State) => {
        if (!state.resumePayload) {
            return {};
        }
        const nextJournal = await resumeDecisionTask({
            journal: state.journal,
            payload: state.resumePayload,
            threadId: state.threadId,
            now: state.now,
        });
        return {
            journal: nextJournal,
        };
    };

    const graph = new StateGraph(WorkflowGraphAnnotation)
        .addNode('start-run', startRunNode)
        .addNode('wait-for-rule-source-decision', waitForRuleSourceDecisionNode)
        .addNode('apply-rule-source-decision', applyRuleSourceDecisionNode)
        .addEdge(START, 'start-run')
        .addEdge('start-run', 'wait-for-rule-source-decision')
        .addEdge('wait-for-rule-source-decision', 'apply-rule-source-decision')
        .addEdge('apply-rule-source-decision', END)
        .compile({
            checkpointer,
            name: 'ai-repo-workbench-new-faction-orchestrator',
        });

    return {
        async startWorkflowRun(journal, payload, now = Date.now()) {
            const threadId = deps.createThreadId();
            const config = {
                configurable: {
                    thread_id: threadId,
                },
            };

            try {
                await graph.invoke({
                    journal,
                    startPayload: payload,
                    resumePayload: null,
                    threadId,
                    now,
                }, config);
            } catch (error) {
                if (!isGraphInterrupt(error)) {
                    console.error('[ai-repo-workbench] LangGraph start failed, fallback to local orchestrator.', error);
                    const fallbackJournal = await deps.localOrchestrator.startWorkflowRun(journal, payload, now);
                    return annotateActiveRunCheckpoint(fallbackJournal, undefined, 'fallback', now, 'local');
                }
            }

            const snapshot = await graph.getState(config);
            return getJournalFromSnapshot(snapshot, journal);
        },

        async submitDecision(journal, payload, now = Date.now()) {
            const run = findRunByDecisionId(journal, payload.decisionId);
            const threadId = run?.orchestrator?.engine === 'langgraph'
                && run.orchestrator.checkpointStatus !== 'fallback'
                ? run.orchestrator.threadId
                : undefined;

            if (!threadId) {
                const fallbackJournal = await deps.localOrchestrator.submitDecision(journal, payload, now);
                return run
                    ? annotateRunCheckpoint(fallbackJournal, run.id, undefined, 'fallback', now, 'local')
                    : fallbackJournal;
            }

            const config = {
                configurable: {
                    thread_id: threadId,
                },
            };

            try {
                await graph.invoke(
                    new Command({
                        resume: {
                            action: payload.action,
                            optionId: payload.optionId,
                            feedback: payload.feedback,
                            now,
                        } satisfies GraphResumeValue,
                    }),
                    config,
                );
                const snapshot = await graph.getState(config);
                return getJournalFromSnapshot(snapshot, journal);
            } catch (error) {
                if (!isRecoverableResumeFailure(error)) {
                    throw error;
                }
                console.warn('[ai-repo-workbench] LangGraph resume unavailable, fallback to local orchestrator.', error);
                const fallbackJournal = await deps.localOrchestrator.submitDecision(journal, payload, now);
                return run
                    ? annotateRunCheckpoint(fallbackJournal, run.id, undefined, 'fallback', now, 'local')
                    : fallbackJournal;
            }
        },

        async advance(journal, now = Date.now()) {
            return deps.localOrchestrator.advance(journal, now);
        },
    };
}
