import type { UISceneAuthoringSavePayload } from '../types';

export async function saveUiSceneAuthoring(sceneId: string, payload: UISceneAuthoringSavePayload) {
    const response = await fetch(`/layout/ui-scene/${sceneId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof result?.message === 'string' ? result.message : '保存失败');
    }

    return result;
}
