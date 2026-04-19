## 1. Specification
- [x] 1.1 Add `game-ai-system` deltas for common decision primitive requirements
- [x] 1.2 Align wording with existing AI framework contracts and avoid duplicate scope

## 2. Engine Design
- [x] 2.1 Define CA loop contract over `legalActions` without bypassing legality gate
- [x] 2.2 Define relative utility + controlled randomness contract by difficulty
- [x] 2.3 Define assignment-first layer contract as optional generic primitive
- [x] 2.4 Define generic feature snapshot contract and trace integration

## 3. SummonerWars Validation Scope
- [x] 3.1 Define SummonerWars adapter responsibilities for feature extraction and action valuation
- [x] 3.2 Define acceptance scenarios proving common primitives improve complex turn decisions

## 4. Verification
- [x] 4.1 Run `openspec validate add-tactical-boardgame-ai-playbook --strict --no-interactive`
- [x] 4.2 Confirm no conflict with active AI-related changes and update wording if needed
