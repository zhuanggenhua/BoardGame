export type InteractionHint = {
    key: string;
    params?: Record<string, string | number>;
};

/** 活跃玩家输入的提示必须包含在同一份展示合同中。 */
export type InteractionPresentationContract<TKind extends string> = {
    kind: TKind;
    hint: InteractionHint;
};
