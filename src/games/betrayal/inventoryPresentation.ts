import type {
  BetrayalExplorerSummary,
  BetrayalInventoryCard,
  BetrayalTraitKey,
  PossessionUseEffectProfile,
} from "./game";
import {
  resolveInventoryEffectId,
  resolveUseEffect,
} from "./possessionEffects";

type BetrayalTranslation = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export type BetrayalTraitAssetMap = Record<BetrayalTraitKey, string>;

export type InventoryFaceTone = {
  cardSurfaceClass: string;
  frameClass: string;
  badgeClass: string;
  nameClass: string;
  accentClass: string;
  backOpacityClass: string;
};

export type InventoryCardBackAssetMap = Record<
  BetrayalInventoryCard["kind"],
  string
>;

const INVENTORY_FACE_TONE: Record<
  BetrayalInventoryCard["kind"],
  InventoryFaceTone
> = {
  item: {
    cardSurfaceClass:
      "border-[rgba(118,74,50,0.58)] bg-[linear-gradient(180deg,rgba(85,40,30,0.96),rgba(35,18,16,0.96))]",
    frameClass: "border-[rgba(192,110,86,0.24)] bg-[rgba(20,10,10,0.18)]",
    badgeClass:
      "border-[rgba(202,124,95,0.34)] bg-[rgba(68,29,22,0.8)] text-[#efc4ad]",
    nameClass: "text-[#f6e6d8]",
    accentClass: "text-[#eeb29d]",
    backOpacityClass: "opacity-[0.14]",
  },
  omen: {
    cardSurfaceClass:
      "border-[rgba(88,119,73,0.58)] bg-[linear-gradient(180deg,rgba(53,77,38,0.96),rgba(18,31,20,0.96))]",
    frameClass: "border-[rgba(140,181,123,0.24)] bg-[rgba(11,20,12,0.18)]",
    badgeClass:
      "border-[rgba(126,182,127,0.34)] bg-[rgba(29,61,35,0.78)] text-[#d4f0cb]",
    nameClass: "text-[#edf4df]",
    accentClass: "text-[#bdddb7]",
    backOpacityClass: "opacity-[0.12]",
  },
};

export function resolveInventoryFaceTone(
  kind: BetrayalInventoryCard["kind"],
): InventoryFaceTone {
  return INVENTORY_FACE_TONE[kind];
}

export function resolveInventoryCardBackAsset(
  card: BetrayalInventoryCard,
  deckAssets: InventoryCardBackAssetMap,
): string {
  return deckAssets[card.kind];
}

export function resolveInventoryCardAccentAsset(
  card: BetrayalInventoryCard,
  traitAssets: BetrayalTraitAssetMap,
): string {
  const effect = resolveUseEffect(card);
  if (!effect) {
    return traitAssets.knowledge;
  }
  if (effect.mode === "move") {
    return traitAssets.speed;
  }
  if (effect.mode === "moveOthersInRoom") {
    return traitAssets.speed;
  }
  if (effect.mode === "healTraits") {
    return traitAssets.might;
  }
  if (effect.mode === "placeExplorer") {
    return traitAssets.speed;
  }
  if (effect.mode === "nextNonCombatTraitReplacement") {
    return traitAssets[effect.replacementTrait];
  }
  if (effect.mode === "nextNonCombatTraitRollTotalReplacement") {
    return traitAssets.knowledge;
  }
  return traitAssets[effect.trait ?? "knowledge"];
}

function formatSignedDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function resolvePreviewUseEffectLabel(
  cardOrEffect: BetrayalInventoryCard | PossessionUseEffectProfile | null,
  t: BetrayalTranslation,
): string {
  if (!cardOrEffect) {
    return t("board.status.noSelectedCard");
  }
  const profile =
    "mode" in cardOrEffect ? cardOrEffect : resolveUseEffect(cardOrEffect);
  if (!profile) {
    return "按卡面规则持有";
  }
  if (profile.mode === "move") {
    return t("board.useEffects.move", {
      value: formatSignedDelta(profile.amount),
    });
  }
  if (profile.mode === "moveOthersInRoom") {
    return "移动同板块其他角色到相邻板块";
  }
  if (profile.mode === "healTraits") {
    return `治疗${profile.traits.map((trait) => t(`board.traits.${trait}`)).join("和")}`;
  }
  if (profile.mode === "placeExplorer") {
    return "放置到已发现板块";
  }
  if (profile.mode === "nextNonCombatTraitReplacement") {
    return `下一次非战斗检定可用${t(`board.traits.${profile.replacementTrait}`)}替换`;
  }
  if (profile.mode === "nextNonCombatTraitRollTotalReplacement") {
    return `下一次属性检定可用 ${profile.minTotal}-${profile.maxTotal} 的结果替代投骰`;
  }
  return t("board.useEffects.trait", {
    trait: t(`board.traits.${profile.trait}`),
    value: formatSignedDelta(profile.amount),
  });
}

export function resolveInventoryRulesSummary(
  card: BetrayalInventoryCard,
  t: BetrayalTranslation,
): string {
  const activeLabel = resolvePreviewUseEffectLabel(card, t);
  const effectId = card.id
    .replace(/-preview-\d+$/, "")
    .replace(/-armory-\d+-\d+$/, "")
    .replace(/-\d+$/, "");
  const passiveLabels: string[] = [];

  if (effectId === "omen-book") passiveLabels.push("知识检定 +1");
  if (effectId === "skull")
    passiveLabels.push("知识检定 +1；濒死时投 3 骰，4+ 阻止死亡");
  if (effectId === "dog")
    passiveLabels.push("速度检定 +1；可与 4 格内队友交易");
  if (effectId === "mask") passiveLabels.push("速度检定 +1");
  if (effectId === "holy-symbol")
    passiveLabels.push("神志检定 +1；探索时可埋葬第一张板块");
  if (effectId === "ring")
    passiveLabels.push("神志检定 +1；攻击时可改用神志造成精神伤害");
  if (effectId === "idol")
    passiveLabels.push("力量检定 +1；发现事件符号板块时可跳过事件");
  if (effectId === "camera")
    passiveLabels.push(
      "知识检定可用神志替代；“说茄子！”作祟由相机持有者成为叛徒",
    );
  if (effectId === "flashlight" || effectId === "lantern")
    passiveLabels.push("事件属性检定额外投 2 骰");
  if (effectId === "strange-amulet") {
    passiveLabels.push("实际承受物理伤害后 +1 神志");
    passiveLabels.push("援手作祟中决定胜利并控制巨魔手");
  }
  if (effectId === "rope")
    passiveLabels.push("可重掷刚刚的投骰结果");
  if (effectId === "armor") passiveLabels.push("受到物理伤害 -1");
  if (effectId === "radio") passiveLabels.push("受到精神伤害 -1");
  if (effectId === "lockpick-tool")
    passiveLabels.push("移动时可穿过一格同层相邻墙体");
  if (effectId === "hunting-knife")
    passiveLabels.push("攻击时可选择砍刀，攻击结果 +1");
  if (effectId === "dagger")
    passiveLabels.push("攻击时可选择匕首，额外投 2 骰并失去 1 点速度");
  if (effectId === "leather-jacket")
    passiveLabels.push("防御攻击时额外投 1 骰");
  if (effectId === "chainsaw")
    passiveLabels.push("攻击时可选择电锯，额外投 1 骰");
  if (effectId === "gun")
    passiveLabels.push("攻击时可选择枪，攻击视线内目标，失败不反伤");
  if (effectId === "crossbow")
    passiveLabels.push("攻击时可选择十字弓，攻击同板块或相邻板块目标，失败不反伤");

  if (activeLabel !== "按卡面规则持有" && passiveLabels.length > 0) {
    return `${activeLabel}；${passiveLabels.join("；")}`;
  }
  if (activeLabel !== "按卡面规则持有") {
    return activeLabel;
  }
  return passiveLabels.length > 0 ? passiveLabels.join("；") : activeLabel;
}

export function resolveDamageReductionCardNames(
  explorer: BetrayalExplorerSummary | null,
  damageKind: "physical" | "mental" | "general" | undefined,
): string[] {
  if (!explorer || damageKind === "general") {
    return [];
  }
  const reductionEffectId =
    damageKind === "physical" ? "armor" : damageKind === "mental" ? "radio" : null;
  if (!reductionEffectId) {
    return [];
  }
  return explorer.inventory
    .filter((card) => resolveInventoryEffectId(card.id) === reductionEffectId)
    .map((card) => card.name);
}
