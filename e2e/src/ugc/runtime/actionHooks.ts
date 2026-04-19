import type { UGCGameState } from '../sdk/types';
import type { UGCViewSdk } from './viewSdk';

export interface RuntimeZoneAction {
  id: string;
  label: string;
  scope?: 'current-player' | 'all';
  requirement?: string;
  hookCode?: string;
}

export interface ActionHookCommand {
  type?: string;
  payload?: Record<string, unknown>;
}

export interface ActionHookExecutionInput {
  action: RuntimeZoneAction;
  context: Record<string, unknown>;
  state: UGCGameState | null;
  sdk: UGCViewSdk | null;
  onCommandResult?: (result: { success: boolean; error?: string }) => void;
}

export interface ActionHookExecutionResult {
  success: boolean;
  error?: string;
  commandId?: string;
}

export function getVisibleActions({
  actions,
  allowActionHooks,
  isCurrentPlayer,
}: {
  actions: RuntimeZoneAction[];
  allowActionHooks: boolean;
  isCurrentPlayer: boolean;
}): RuntimeZoneAction[] {
  if (!allowActionHooks) return [];
  return actions.filter(action => {
    const scope = action.scope || 'all';
    return scope === 'all' || (scope === 'current-player' && isCurrentPlayer);
  });
}

function decodeHtmlEntities(code: string): string {
  const entities: Record<string, string> = {
    '&#39;': "'",
    '&#34;': '"',
    '&quot;': '"',
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&apos;': "'",
  };
  let result = code;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.split(entity).join(char);
  }
  return result;
}

function stripTypeAnnotations(code: string): string {
  let result = decodeHtmlEntities(code);
  result = result.replace(/\((\w+)\s*:\s*[^)]+\)/g, '($1)');
  result = result.replace(/\)\s*:\s*[^=]+=>/g, ') =>');
  result = result.replace(/:\s*(?:string|number|boolean|string\[\]|number\[\]|Record<[^>]+>|[A-Z]\w*(?:<[^>]+>)?)\s*(?=[=,;)\]])/g, '');
  result = result.replace(/\s+as\s+string\[\]/g, '');
  result = result.replace(/\s+as\s+number\[\]/g, '');
  result = result.replace(/\s+as\s+unknown\[\]/g, '');
  result = result.replace(/\s+as\s+(?:string|number|boolean|unknown|Record<[^>]+>|[A-Z]\w*(?:<[^>]+>)?)/g, '');
  return result;
}

function isFunctionExpression(code: string): boolean {
  const trimmed = code.trim();
  return (
    trimmed.startsWith('(') ||
    trimmed.startsWith('function') ||
    trimmed.startsWith('async') ||
    trimmed.includes('=>')
  );
}

export async function executeActionHook({
  action,
  context,
  state,
  sdk,
  onCommandResult,
}: ActionHookExecutionInput): Promise<ActionHookExecutionResult> {
  const hookCode = action.hookCode?.trim();
  if (!hookCode) {
    return { success: false, error: '动作钩子为空' };
  }

  if (!isFunctionExpression(hookCode)) {
    return { success: false, error: '动作钩子需要函数表达式' };
  }

  const jsCode = stripTypeAnnotations(hookCode);
  const dispatchCommand = (command: ActionHookCommand): string => {
    if (!sdk) {
      throw new Error('动作钩子无法派发命令：SDK 不可用');
    }
    const commandType = command.type?.trim() || 'ACTION';
    const basePayload: Record<string, unknown> = {
      actionId: action.id,
      actionLabel: action.label,
      componentId: context.componentId,
      componentType: context.componentType,
    };
    if (Array.isArray(context.selectedCardIds)) {
      basePayload.selectedCardIds = context.selectedCardIds;
    }
    const finalPayload = {
      ...basePayload,
      ...(command.payload || {}),
    };
    return sdk.sendCommand(
      commandType as Parameters<UGCViewSdk['sendCommand']>[0],
      finalPayload,
      onCommandResult
    );
  };

  const payload = {
    action,
    context,
    state,
    sdk,
    dispatchCommand,
  };

  try {
     
    const executor = new Function('payload', `"use strict"; const fn = ${jsCode}; if (typeof fn !== 'function') { throw new Error('动作钩子必须返回函数'); } return fn(payload);`);
    let result = executor(payload) as unknown;
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      result = await result;
    }
    if (result === undefined || result === null) {
      return { success: true };
    }

    const normalizeCommand = (value: unknown): ActionHookCommand[] => {
      if (Array.isArray(value)) {
        return value.map(item => {
          if (!item || typeof item !== 'object') {
            throw new Error('动作钩子返回值必须是命令对象');
          }
          return item as ActionHookCommand;
        });
      }
      if (typeof value === 'object') {
        return [value as ActionHookCommand];
      }
      throw new Error('动作钩子返回值必须是命令对象');
    };

    const commands = normalizeCommand(result);
    const commandIds = commands.map(command => dispatchCommand(command));
    return { success: true, commandId: commandIds[0] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '动作钩子执行失败',
    };
  }
}
