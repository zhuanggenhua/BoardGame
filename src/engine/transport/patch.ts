import jsonpatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';

const { compare, applyPatch: fjpApplyPatch } = jsonpatch;

/** 重新导出 Operation 类型，方便外部使用 */
export type { Operation } from 'fast-json-patch';

/** Diff 计算结果 */
export interface DiffResult {
  /** 'patch' = 增量可用, 'full' = 需要全量回退 */
  type: 'patch' | 'full';
  /** JSON Patch 操作数组（仅 type='patch' 时有值） */
  patches?: Operation[];
  /** 回退原因（仅 type='full' 时有值） */
  fallbackReason?: string;
}

/**
 * 计算两个 ViewState 之间的 JSON Patch diff
 *
 * @param oldState 上次广播的 ViewState（缓存）
 * @param newState 当前 ViewState
 * @param sizeThreshold patch 体积占全量比例阈值（默认 0.8）
 * @returns DiffResult
 */
export function computeDiff(
  oldState: unknown,
  newState: unknown,
  sizeThreshold = 0.8,
): DiffResult {
  try {
    const patches = compare(oldState as object, newState as object);

    // 空 patch = 状态未变化
    if (patches.length === 0) {
      return { type: 'patch', patches: [] };
    }

    // 体积比较：patch 序列化体积 vs 全量序列化体积
    const patchSize = JSON.stringify(patches).length;
    const fullSize = JSON.stringify(newState).length;

    if (patchSize >= fullSize * sizeThreshold) {
      return { type: 'full', fallbackReason: `patch_size_ratio=${(patchSize / fullSize).toFixed(2)}` };
    }

    return { type: 'patch', patches };
  } catch (error) {
    return { type: 'full', fallbackReason: `diff_error: ${(error as Error).message}` };
  }
}

/** Patch 应用结果 */
export interface ApplyResult {
  success: boolean;
  state?: unknown;
  error?: string;
}

/**
 * 将 JSON Patch 应用到基础状态上
 *
 * @param baseState 当前本地缓存状态
 * @param patches JSON Patch 操作数组
 * @returns ApplyResult
 */
export function applyPatches(baseState: unknown, patches: Operation[]): ApplyResult {
  try {
    // 深拷贝基础状态，避免 applyPatch 的 in-place 修改影响原始引用
    const cloned = JSON.parse(JSON.stringify(baseState));
    const result = fjpApplyPatch(cloned, patches, /* validate */ true);

    // 检查是否有操作失败
    const hasError = result.some(r => r !== null && typeof r === 'object' && 'message' in r);
    if (hasError) {
      return { success: false, error: 'patch_validation_failed' };
    }

    return { success: true, state: cloned };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
