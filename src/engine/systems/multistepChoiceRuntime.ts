import type { InteractionDescriptor, MultistepChoiceData } from './InteractionSystem';

/** Ephemeral client behavior. Never store this object in MatchState. */
export interface MultistepChoiceRuntime<TStep, TResult> {
    localReducer: (current: TResult, step: TStep) => TResult;
    toCommands: (result: TResult) => Array<{ type: string; payload: unknown }>;
    validateStep?: (current: TResult, step: TStep) => boolean;
    getCompletedSteps?: (result: TResult) => number;
    shouldResolveOnConfirm?: (result: TResult) => boolean;
}

export interface MultistepChoiceBinding<TStep, TResult> {
    interaction: InteractionDescriptor<MultistepChoiceData<TResult> & Record<string, unknown>>;
    runtime: MultistepChoiceRuntime<TStep, TResult>;
}
