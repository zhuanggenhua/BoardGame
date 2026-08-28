# Change: Add Mage Wars saved spellbooks

## Why
The current Mage Wars builder only edits spellbook entries for the current match setup. Players need to create a named spellbook copy for a selected mage from that mage's standard starting spellbook, save it, and reuse it before starting a match.

## What Changes
- Add a Mage Wars spellbook library scoped by mage where the standard starting spellbook and named saved copies are peer library items.
- Keep the flow as: choose mage first, then build or select that mage's spellbook.
- Save the current standard/customized spellbook as a named copy, update an existing named copy, and keep save-as-new separate from update-current.
- Surface the standard spellbook and named copies on the selected mage setup area so players can use, edit, or delete them before starting.
- Keep match startup using the selected saved/custom entries through existing setupData.

## Impact
- Affected specs: `mage-wars`
- Affected code: `src/games/mage-wars/ui/SpellbookBuilderPanel.tsx`, `src/games/mage-wars/ui/MageSelectionGate.tsx`, Mage Wars spellbook helpers, tests, and E2E.
