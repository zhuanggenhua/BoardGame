## 1. Implementation
- [x] 1.1 Add a saved spellbook data contract scoped to Mage Wars mage IDs.
- [x] 1.2 Update the setup flow so the builder edits the already selected mage instead of switching mage inside the builder.
- [x] 1.3 Add save-as-new, update-current, load, and delete saved spellbook UI inside the Mage Wars builder.
- [x] 1.4 Surface saved spellbooks on mage setup with direct use, edit, and delete actions for the selected mage.
- [x] 1.5 Feed selected saved/custom entries into match setupData.
- [x] 1.6 Refactor the selected mage setup and builder UI so the standard starting spellbook and named saved copies are peer items in one spellbook library, with save-as-new creating a named copy of the current standard/current spellbook instead of using a blank primary flow.

## 2. Verification
- [x] 2.1 Add component/unit coverage for save-as-new, update-current, delete, mage-first builder flow, and setupData handoff.
- [x] 2.2 Update real-entry E2E to select a mage first, build/save a named spellbook, use/edit/delete from mage setup, and start planning with that spellbook.
- [x] 2.3 Run focused tests, E2E, typecheck, OpenSpec validation, spec lint, and completion guard.
- [x] 2.4 Add regression coverage that a named spellbook saved before edits contains the complete standard starting spellbook and that the old DIY/blank primary path is absent.
