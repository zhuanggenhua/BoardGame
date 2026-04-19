import { parseDocument } from 'yaml';

export interface UISceneAuthoringMetaEntry {
    名称?: string;
    说明?: string;
}

export interface UISceneAuthoringMeta {
    scene?: UISceneAuthoringMetaEntry;
    nodes?: Record<string, UISceneAuthoringMetaEntry>;
    actions?: Record<string, string>;
    slots?: Record<string, string>;
}

export function parseAuthoringMetaYaml(yamlText: string): UISceneAuthoringMeta {
    const document = parseDocument(yamlText, {
        prettyErrors: false,
        strict: false,
        uniqueKeys: true,
    });

    if (document.errors.length > 0) {
        return {};
    }

    const value = document.toJS() as UISceneAuthoringMeta | null | undefined;
    return value ?? {};
}

export function getAuthoringNodeName(meta: UISceneAuthoringMeta | undefined, nodeId: string) {
    return meta?.nodes?.[nodeId]?.名称 ?? nodeId;
}

export function getAuthoringNodeDescription(meta: UISceneAuthoringMeta | undefined, nodeId: string) {
    return meta?.nodes?.[nodeId]?.说明 ?? '';
}

export function getAuthoringActionName(meta: UISceneAuthoringMeta | undefined, actionId?: string) {
    if (!actionId) {
        return '';
    }
    return meta?.actions?.[actionId] ?? actionId;
}

export function getAuthoringSlotName(meta: UISceneAuthoringMeta | undefined, slotId?: string) {
    if (!slotId) {
        return '';
    }
    return meta?.slots?.[slotId] ?? slotId;
}
