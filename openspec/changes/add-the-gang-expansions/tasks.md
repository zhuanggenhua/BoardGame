## 1. Source audit
- [x] 1.1 Locate TTS Workshop JSON and confirm Lua script presence.
- [x] 1.2 Identify Lua sections for modes, challenge registry, deck setup, public cards, hand ranks, poker evaluation, tools, specialists, and vault.
- [x] 1.3 Confirm AssetBundle contents are not required for rule/UI implementation.

## 2. Runtime rules
- [x] 2.1 Add rules config for game mode, active challenges, and locked hand ranks.
- [x] 2.2 Add deal-plan logic for Texas Hold'em, Seven-Card Stud, Banana Split, skipped rounds, extra cards, personal community cards, and front-loaded community cards.
- [x] 2.3 Add special cards and poker variants for Joker, wild cards, blank cards, B/C/D ranks, gear suit, rank reversal, no-flush mode, and locked hand ranks.
- [x] 2.4 Restrict rules config changes to the opening state before chips are selected.
- [x] 2.5 Implement 2Hand, Omaha hand-size changes, Automode progression, and no-redeal config updates unless the deal signature changes.

## 3. UI and localization
- [x] 3.1 Add a folded rules config panel using the current The Gang board style.
- [x] 3.2 Surface game-mode selection and implemented challenge toggles.
- [x] 3.3 Show locked-state messaging after play starts.
- [x] 3.4 Add Chinese and English localization strings.
- [x] 3.5 Show 2Hand as top/bottom hand rows and surface reminder-only challenges as short table status labels.

## 4. Tests and documentation
- [x] 4.1 Add or update domain tests for player count, rule config locking, personal community cards, and expansion poker evaluation.
- [x] 4.2 Add or update Board runtime tests for the extension panel.
- [x] 4.3 Document the TTS Lua mapping and current implementation boundary.
- [x] 4.4 Run OpenSpec strict validation.
- [x] 4.5 Run The Gang targeted ESLint and Vitest checks.
- [x] 4.6 Add domain and Board runtime coverage for tool-card dealing, implemented tool effects, and specialist-card draws.
- [x] 4.7 Add real-entry E2E coverage for extension selection and tool-card dealing.

## 5. Explicitly bounded
- [x] 5.1 Tool-card dealing and TTS-scripted tool actions are implemented for 一次性手机, 手电筒, 润滑剂, and 夜视眼镜.
- [x] 5.2 Specialist-card draw state is implemented through 一次性手机; individual specialist effects remain documented-only because no corresponding TTS Lua effect scripts were found.
- [ ] 5.3 Vault/safe model and interaction are deferred.
- [x] 5.4 Reminder-only tabletop UI scripts are runtime-enforced as short table status labels, without claiming rule-changing mechanics.
