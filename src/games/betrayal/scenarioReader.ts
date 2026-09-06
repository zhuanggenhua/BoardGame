import type { BetrayalCore } from "./game";
import { isHauntScenarioOpeningDiscovery } from "./latestDiscoveryPresentation";
import type { BetrayalScenarioCardCandidate } from "./scenarioConfig";

export type ScenarioReaderAudience = "all" | "heroes" | "traitor";
export type ScenarioReaderScope = "all" | "heroes" | "traitor";

export type ScenarioReaderSection = {
  id: string;
  labelKey: string;
  bodyKey: string;
  accentClass: string;
  audiences: ScenarioReaderAudience[];
};

export type ScenarioReaderPage = {
  id: string;
  type: "cover" | "section";
  pageNumber: number;
  sections?: ScenarioReaderSection[];
};

export type ScenarioBookTurnSnapshot = {
  fromPages: [ScenarioReaderPage | null, ScenarioReaderPage | null];
  toPages: [ScenarioReaderPage | null, ScenarioReaderPage | null];
};

export type ScenarioReaderOpenMode =
  | "hauntReveal"
  | "manualReview"
  | "tutorialObjective";

export type ScenarioReaderOpenPlan = {
  scope: ScenarioReaderScope;
  spreadCount: number;
  initialSpreadIndex: number;
  includeOpeningStage: boolean;
  isPublicHauntRevealReader: boolean;
};

export const SCENARIO_BOOK_TURN_DURATION_MS = 380;

const isChineseLocale = (locale: string) =>
  locale.toLowerCase().startsWith("zh");

const SCENARIO_READER_RULE_HANDOFF_SECTION_IDS = new Set(["setup"]);
const SCENARIO_READER_ENDING_SECTION_IDS = new Set([
  "ending",
  "endingHeroes",
  "endingTraitor",
  "endingHaunt",
  "endingSurvivors",
]);
const SCENARIO_READER_CINEMATIC_SECTION_IDS = new Set([
  "prologue",
  "prologueHeroes",
  "prologueTraitor",
]);

export const isScenarioReaderCinematicSection = (sectionId: string) =>
  SCENARIO_READER_CINEMATIC_SECTION_IDS.has(sectionId);

export const splitCinematicNarrationText = (text: string) =>
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

export const formatScenarioCardTitle = (
  candidate: BetrayalScenarioCardCandidate,
  locale: string,
) => (isChineseLocale(locale) ? candidate.title : candidate.titleEn);

export const formatScenarioCardSummary = (
  candidate: BetrayalScenarioCardCandidate,
  locale: string,
) => (isChineseLocale(locale) ? candidate.summary : candidate.summaryEn);

export type HauntDossierId =
  | "mummyRampage"
  | "crimsonJack"
  | "dust"
  | "bloodFromStone"
  | "helpingHands"
  | "magicCamera";

export type HauntDossier = {
  id: HauntDossierId;
  cardNumber: number;
  titleKey: string;
  objectiveKey: string;
  heroGoalKey: string;
  traitorGoalKey: string;
  sections: ScenarioReaderSection[];
};

const createHauntSection = (
  dossierId: HauntDossierId,
  id: string,
  accentClass: string,
  audiences: ScenarioReaderAudience[] = ["all"],
): ScenarioReaderSection => ({
  id,
  labelKey: `game-betrayal:board.haunts.${dossierId}.reader.${id}Label`,
  bodyKey: `game-betrayal:board.haunts.${dossierId}.reader.${id}`,
  accentClass,
  audiences,
});

const HAUNT_DOSSIERS: Record<HauntDossierId, HauntDossier> = {
  mummyRampage: {
    id: "mummyRampage",
    cardNumber: 1,
    titleKey: "game-betrayal:board.haunts.mummyRampage.title",
    objectiveKey: "game-betrayal:board.haunts.mummyRampage.objective",
    heroGoalKey: "game-betrayal:board.haunts.mummyRampage.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.mummyRampage.traitorGoal",
    sections: [
      createHauntSection("mummyRampage", "prologue", "border-[#8f5a22]"),
      createHauntSection("mummyRampage", "prologueHeroes", "border-[#8f5a22]", [
        "heroes",
      ]),
      createHauntSection("mummyRampage", "prologueTraitor", "border-[#8f5a22]", [
        "traitor",
      ]),
      createHauntSection("mummyRampage", "setup", "border-[#607f3a]"),
      createHauntSection("mummyRampage", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("mummyRampage", "special", "border-[#a16c24]", ["heroes"]),
      createHauntSection("mummyRampage", "traitor", "border-[#8f3c2e]", ["traitor"]),
      createHauntSection("mummyRampage", "monster", "border-[#684b87]", ["traitor"]),
      createHauntSection("mummyRampage", "endingHeroes", "border-[#8f5a22]", [
        "heroes",
      ]),
      createHauntSection("mummyRampage", "endingTraitor", "border-[#8f5a22]", [
        "traitor",
      ]),
    ],
  },
  crimsonJack: {
    id: "crimsonJack",
    cardNumber: 1,
    titleKey: "game-betrayal:board.haunts.crimsonJack.title",
    objectiveKey: "game-betrayal:board.haunts.crimsonJack.objective",
    heroGoalKey: "game-betrayal:board.haunts.crimsonJack.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.crimsonJack.traitorGoal",
    sections: [
      createHauntSection("crimsonJack", "prologue", "border-[#8f5a22]"),
      createHauntSection("crimsonJack", "setup", "border-[#607f3a]"),
      createHauntSection("crimsonJack", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("crimsonJack", "special", "border-[#a16c24]", ["heroes"]),
      createHauntSection("crimsonJack", "traitor", "border-[#8f3c2e]", ["traitor"]),
      createHauntSection("crimsonJack", "monster", "border-[#684b87]", ["traitor"]),
      createHauntSection("crimsonJack", "ending", "border-[#8f5a22]"),
    ],
  },
  dust: {
    id: "dust",
    cardNumber: 3,
    titleKey: "game-betrayal:board.haunts.dust.title",
    objectiveKey: "game-betrayal:board.haunts.dust.objective",
    heroGoalKey: "game-betrayal:board.haunts.dust.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.dust.traitorGoal",
    sections: [
      createHauntSection("dust", "prologue", "border-[#8f5a22]"),
      createHauntSection("dust", "setup", "border-[#607f3a]"),
      createHauntSection("dust", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("dust", "special", "border-[#a16c24]", ["heroes"]),
      createHauntSection("dust", "traitor", "border-[#8f3c2e]", ["traitor"]),
      createHauntSection("dust", "ending", "border-[#8f5a22]"),
    ],
  },
  bloodFromStone: {
    id: "bloodFromStone",
    cardNumber: 5,
    titleKey: "game-betrayal:board.haunts.bloodFromStone.title",
    objectiveKey: "game-betrayal:board.haunts.bloodFromStone.objective",
    heroGoalKey: "game-betrayal:board.haunts.bloodFromStone.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.bloodFromStone.traitorGoal",
    sections: [
      createHauntSection("bloodFromStone", "prologue", "border-[#8f5a22]"),
      createHauntSection("bloodFromStone", "setup", "border-[#607f3a]"),
      createHauntSection("bloodFromStone", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("bloodFromStone", "special", "border-[#a16c24]", ["heroes"]),
      createHauntSection("bloodFromStone", "monster", "border-[#684b87]"),
      createHauntSection("bloodFromStone", "ending", "border-[#8f5a22]"),
    ],
  },
  helpingHands: {
    id: "helpingHands",
    cardNumber: 12,
    titleKey: "game-betrayal:board.haunts.helpingHands.title",
    objectiveKey: "game-betrayal:board.haunts.helpingHands.objective",
    heroGoalKey: "game-betrayal:board.haunts.helpingHands.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.helpingHands.traitorGoal",
    sections: [
      createHauntSection("helpingHands", "prologue", "border-[#8f5a22]"),
      createHauntSection("helpingHands", "setup", "border-[#607f3a]"),
      createHauntSection("helpingHands", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("helpingHands", "special", "border-[#a16c24]"),
      createHauntSection("helpingHands", "traitor", "border-[#8f3c2e]", ["traitor"]),
      createHauntSection("helpingHands", "ending", "border-[#8f5a22]"),
    ],
  },
  magicCamera: {
    id: "magicCamera",
    cardNumber: 33,
    titleKey: "game-betrayal:board.haunts.magicCamera.title",
    objectiveKey: "game-betrayal:board.haunts.magicCamera.objective",
    heroGoalKey: "game-betrayal:board.haunts.magicCamera.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.magicCamera.traitorGoal",
    sections: [
      createHauntSection("magicCamera", "prologue", "border-[#8f5a22]"),
      createHauntSection("magicCamera", "setup", "border-[#607f3a]"),
      createHauntSection("magicCamera", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("magicCamera", "special", "border-[#a16c24]", ["heroes"]),
      createHauntSection("magicCamera", "traitor", "border-[#8f3c2e]", ["traitor"]),
      createHauntSection("magicCamera", "ending", "border-[#8f5a22]"),
    ],
  },
};

const HAUNT_DOSSIER_BY_CARD_NUMBER: Record<number, HauntDossierId> = {
  1: "mummyRampage",
  3: "dust",
  5: "bloodFromStone",
  12: "helpingHands",
  33: "magicCamera",
};

const HAUNT_DOSSIER_BY_HAUNT_ID: Record<
  NonNullable<BetrayalCore["endgameResult"]>["hauntId"],
  HauntDossierId
> = {
  "mummy-rampage": "mummyRampage",
  "crimson-jack-returns": "crimsonJack",
  "the-dust": "dust",
  "blood-from-a-stone": "bloodFromStone",
  "helping-hands": "helpingHands",
  "magic-camera": "magicCamera",
};

export function resolveScenarioCardDossier(
  candidate: BetrayalScenarioCardCandidate,
): HauntDossier {
  if (candidate.id === "mummy-rampage") {
    return HAUNT_DOSSIERS.mummyRampage;
  }
  if (candidate.id === "crimson-jack-returns") {
    return HAUNT_DOSSIERS.crimsonJack;
  }
  const dossierId = HAUNT_DOSSIER_BY_CARD_NUMBER[candidate.hauntNumber];
  return dossierId ? HAUNT_DOSSIERS[dossierId] : HAUNT_DOSSIERS.crimsonJack;
}

export function resolveActiveHauntDossier(core: BetrayalCore): HauntDossier {
  if (core.phase === "haunt" && core.scenarioRuntime.hauntCardNumber) {
    if (
      core.scenarioRuntime.hauntCardNumber === 1 &&
      core.scenarioRuntime.hauntScenarioCardId === "mummy-rampage"
    ) {
      return HAUNT_DOSSIERS.mummyRampage;
    }
    const dossierId =
      HAUNT_DOSSIER_BY_CARD_NUMBER[core.scenarioRuntime.hauntCardNumber] ??
      "crimsonJack";
    return HAUNT_DOSSIERS[dossierId];
  }
  return HAUNT_DOSSIERS.mummyRampage;
}

export function resolveEndgameHauntDossier(core: BetrayalCore): HauntDossier {
  const hauntId = core.endgameResult?.hauntId;
  return hauntId
    ? HAUNT_DOSSIERS[HAUNT_DOSSIER_BY_HAUNT_ID[hauntId]]
    : resolveActiveHauntDossier(core);
}

export function resolveEndgameNarrationSectionId(
  dossier: HauntDossier,
  outcome: NonNullable<BetrayalCore["endgameResult"]>["outcome"] | undefined,
): string {
  if (outcome === "haunt") {
    return "endingHaunt";
  }
  if (outcome === "traitor") {
    return "endingTraitor";
  }
  if (dossier.id === "mummyRampage") {
    return "endingHeroes";
  }
  return "endingSurvivors";
}

export function resolveScenarioReaderScope(
  core: BetrayalCore,
  viewerPlayerId: string,
): ScenarioReaderScope {
  const teamModel = core.scenarioRuntime.hauntTraitorResolution?.teamModel;
  const isOneTraitorHaunt =
    core.phase === "haunt" &&
    core.scenarioRuntime.hauntTriggered &&
    (teamModel === "one-traitor" ||
      (!teamModel && Boolean(core.scenarioRuntime.traitorPlayerId)));

  if (!isOneTraitorHaunt || !core.scenarioRuntime.traitorPlayerId) {
    return "all";
  }

  return core.scenarioRuntime.traitorPlayerId === viewerPlayerId
    ? "traitor"
    : "heroes";
}

export function resolveScenarioReaderOpenPlan(
  core: BetrayalCore,
  viewerPlayerId: string,
  options: {
    mode: ScenarioReaderOpenMode;
    hasOpeningSection: boolean;
    bookSpreadCount: number;
  },
): ScenarioReaderOpenPlan {
  const scope = resolveScenarioReaderScope(core, viewerPlayerId);
  const isPublicHauntRevealReader =
    core.phase === "haunt" &&
    scope === "all" &&
    isHauntScenarioOpeningDiscovery(core);
  const includeOpeningStage =
    core.phase === "haunt" &&
    options.hasOpeningSection &&
    options.mode === "hauntReveal";
  const spreadCount = Math.max(
    1,
    options.bookSpreadCount + (includeOpeningStage ? 1 : 0),
  );
  return {
    scope,
    spreadCount,
    initialSpreadIndex: 0,
    includeOpeningStage,
    isPublicHauntRevealReader,
  };
}

function isScenarioSectionVisibleForScope(
  section: ScenarioReaderSection,
  scope: ScenarioReaderScope,
): boolean {
  if (scope === "all") {
    return true;
  }
  return section.audiences.includes("all") || section.audiences.includes(scope);
}

function filterScenarioSectionsByScope(
  sections: ScenarioReaderSection[],
  scope: ScenarioReaderScope,
): ScenarioReaderSection[] {
  const immersiveSections = sections.filter(
    (section) =>
      !SCENARIO_READER_RULE_HANDOFF_SECTION_IDS.has(section.id) &&
      !SCENARIO_READER_ENDING_SECTION_IDS.has(section.id) &&
      !SCENARIO_READER_CINEMATIC_SECTION_IDS.has(section.id),
  );
  return immersiveSections.filter((section) =>
    isScenarioSectionVisibleForScope(section, scope),
  );
}

export function findScenarioOpeningNarrationSection(
  dossier: HauntDossier,
  scope: ScenarioReaderScope,
): ScenarioReaderSection | null {
  const cinematicSections = dossier.sections.filter(
    (section) =>
      SCENARIO_READER_CINEMATIC_SECTION_IDS.has(section.id) &&
      isScenarioSectionVisibleForScope(section, scope),
  );
  if (scope !== "all") {
    return (
      cinematicSections.find((section) => section.audiences.includes(scope)) ??
      cinematicSections[0] ??
      null
    );
  }
  return (
    cinematicSections.find((section) => section.audiences.includes("all")) ??
    cinematicSections[0] ??
    null
  );
}

export function buildScenarioReaderPages(
  dossier: HauntDossier = HAUNT_DOSSIERS.mummyRampage,
  scope: ScenarioReaderScope = "all",
): ScenarioReaderPage[] {
  const scopedSections = filterScenarioSectionsByScope(dossier.sections, scope);
  // 每个正文段占一页；书本一次展示左右两页，但不能为了减少翻页把结局
  // 和前置规则段压到同一轮翻页里，否则第一页翻页就会直接看到结局。
  const pageCount = Math.max(2, scopedSections.length);
  const baseSectionsPerPage = Math.floor(scopedSections.length / pageCount);
  const pagesWithExtraSection = scopedSections.length % pageCount;
  let sectionOffset = 0;

  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const sectionCount =
      baseSectionsPerPage + (pageIndex < pagesWithExtraSection ? 1 : 0);
    const sections = scopedSections.slice(
      sectionOffset,
      sectionOffset + sectionCount,
    );
    sectionOffset += sectionCount;
    return {
      id: `${dossier.id}-dossier-${pageIndex + 1}`,
      type: "section" as const,
      pageNumber: pageIndex + 1,
      sections,
    };
  });
}

export function resolveScenarioReaderSpreadPages(
  pages: ScenarioReaderPage[],
  hasOpeningStage: boolean,
  spreadIndex: number,
): [ScenarioReaderPage | null, ScenarioReaderPage | null] {
  const bookSpreadIndex = hasOpeningStage
    ? Math.max(0, spreadIndex - 1)
    : spreadIndex;
  return [
    pages[bookSpreadIndex * 2] ?? null,
    pages[bookSpreadIndex * 2 + 1] ?? null,
  ];
}
