# Smash Up - US Comic Style Cursor Design

## 1. Context & Goal
- **Game**: *Smash Up* (大杀四方) - A card game about smashing distinctive factions together (Zombies, Pirates, Aliens, etc.).
- **Requirement**: Create a new "US Comic Style" (美漫风格) cursor theme.
- **Constraint**: Must be completely original and distinct from the existing "Comic" theme (which is rounded/hand-drawn).

## 2. Design Concept: "Pop Art Vigilante"
The design draws inspiration from:
- **Silver/Bronze Age Comics**: Bold ink lines, dynamic poses.
- **Pop Art**: High contrast, offset shadows ("misregistered print" look), vibrant primaries.
- **Action Onomatopoeia**: The feeling of "POW!", "ZAP!", "SMASH!".

### Visual Identity
- **Shape Language**: Sharp, angular, dynamic. Avoiding soft curves favoring "ink stroke" variance.
- **Color Palette**:
  - **Fill**: Vibrant Comic Yellow (`#FFE600`) - High visibility, energetic.
  - **Shadow/Depth**: Hard Black (`#000000`) offset shadow (ink depth).
  - **Accent**: Comic Red (`#FF2A2A`) for interactions or "hot" states.
  - **Highlight**: Pure White (`#FFFFFF`) specular glint (ink shine).
- **Stroke**: Heavy Black (`#000000`), variable width feel (simulated via geometry or stroke width).

## 3. Cursor States

### 3.1 Default (Arrow)
A stylized, sharp arrow. Not a standard triangle.
- **Shape**: Resembles a stylized lightning bolt or a fast-moving projectile.
- **Detail**:
  - Main body: Yellow.
  - Hard black shadow offset to bottom-right.
  - White "shine" on the top-left edge.
- **Vibe**: Fast, sharp, distinctive.

### 3.2 Pointer (Hand)
A "Gloved" hand, classic superhero trope.
- **Shape**: A clenched fist with the index finger extended.
- **Style**: Heavy blocking.
- **Detail**:
  - Glove color: White or possibly the Theme Yellow to keep consistency. Let's go **White Glove** with **Blue/Black shading** for that classic comic look, OR stay **Yellow** to match the set.
  - *Decision*: **Yellow Main Body** to maintain the "Set" feel. Looks like a superhero gauntlet.
- **Action**: Small "motion lines" near the fingertip to indicate interaction.

### 3.3 Grabbing (Fist)
The "Smash" Fist.
- **Shape**: A strong, blocky clenched fist.
- **Detail**:
  - Impact star/burst behind it? (Might be too cluttered for 32x32).
  - Just the fist, visually heavy.
- **Vibe**: Grabbing = Smashing/Holding tight.

### 3.4 Zoom / Inspect
- **Shape**: A magnifying glass, but refined.
- **Style**: Thick black rim, blue "glass" reflection (`#AEEEEE`).

### 3.5 Not Allowed
- **Shape**: A "Stop" sign or crossed circle, drawn in the thick ink style. Red fill.

## 4. Implementation Plan
- **File**: `src/games/smashup/cursor.ts`
- **Method**: Add a new `usComic` object to the export.
- **SVG Code**: Hand-coded SVGs optimized for 32x32 viewbox.

## 5. Draft SVG Code (Mental Model)

**Default**:
```svg
<svg viewBox="0 0 32 32">
  <defs>
    <filter id="shadow" x="0" y="0" width="200%" height="200%">
       <feOffset result="offOut" in="SourceAlpha" dx="2" dy="2" />
       <feColorMatrix result="matrixOut" in="offOut" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
       <feBlend in="SourceGraphic" in2="matrixOut" mode="normal" />
    </filter>
  </defs>
  <!-- Shape: Geometric Arrow -->
  <path d="M4 4 L14 26 L17 18 L25 18 L4 4 Z" fill="#FFE600" stroke="black" stroke-width="2.5" stroke-linejoin="round" />
  <!-- Maybe a hard shadow path instead of filter for crispness -->
</svg>
```
*Refinement*: SVG filters can be blurry or inconsistent. Hard-coded shadow paths are better for "Comic" look.

**Proposed SVG Structure for "Default"**:
1. **Shadow Path** (Black): Offset by (2,2).
2. **Main Path** (Yellow): The arrow shape.
3. **Stroke** (Black): Outline.
4. **Highlight** (White): Crisp shape on top.

