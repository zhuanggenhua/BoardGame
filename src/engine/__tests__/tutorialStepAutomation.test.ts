import { describe, expect, it } from 'vitest';
import type { TutorialCollection, TutorialManifest } from '../types';
import { getTutorialHiddenAutomationContractErrors } from '../tutorialStepAutomation';
import betrayalTutorials from '../../games/betrayal/tutorial';
import cardiaTutorial from '../../games/cardia/tutorial';
import diceThroneTutorial from '../../games/dicethrone/tutorial';
import fantasyRealmsTutorial from '../../games/fantasyrealms/tutorial';
import mageWarsTutorials from '../../games/mage-wars/tutorial';
import qidahenTutorials from '../../games/qidahen/tutorial';
import smashUpTutorials from '../../games/smashup/tutorial';
import splendorTutorial from '../../games/splendor/tutorial';
import summonerWarsTutorial from '../../games/summonerwars/tutorial';
import theGangTutorial from '../../games/the-gang/tutorial';
import ticTacToeTutorial from '../../games/tictactoe/tutorial';

const isTutorialCollection = (
    item: TutorialManifest | TutorialCollection,
): item is TutorialCollection => !Array.isArray((item as TutorialManifest).steps);

const collectManifests = (
    label: string,
    item: TutorialManifest | TutorialCollection,
) => {
    if (!isTutorialCollection(item)) {
        return [{ label, manifest: item }];
    }
    return Object.entries(item.tutorials).map(([tutorialId, entry]) => ({
        label: `${label}:${tutorialId}`,
        manifest: entry.manifest,
    }));
};

describe('tutorial hidden automation contracts', () => {
    it('rejects setup-precondition after a visible tutorial step', () => {
        const manifest: TutorialManifest = {
            id: 'bad-mid-setup',
            steps: [
                { id: 'intro', content: 'intro', infoStep: true },
                {
                    id: 'mid-setup',
                    content: 'mid setup',
                    aiActions: [{ commandType: 'AI_MOVE' }],
                    hiddenAutomation: {
                        kind: 'setup-precondition',
                        reason: 'This incorrectly hides a mid-tutorial state jump.',
                    },
                },
                { id: 'after', content: 'after', infoStep: true },
            ],
        };

        expect(getTutorialHiddenAutomationContractErrors(manifest)).toEqual(
            expect.arrayContaining([
                expect.stringContaining('setup-precondition can only run before the first visible tutorial step'),
            ]),
        );
    });

    it('accepts branch-recovery only when it restores a prior visible step', () => {
        const manifest: TutorialManifest = {
            id: 'branch-recovery',
            steps: [
                { id: 'choose', content: 'choose', requireAction: true },
                {
                    id: 'recover',
                    content: 'hidden recovery',
                    aiActions: [{ commandType: 'SYS_TUTORIAL_PREVIOUS' }],
                    hiddenAutomation: {
                        kind: 'branch-recovery',
                        reason: 'Restore the complete checkpoint before an uncovered legal branch.',
                        recoveryStepId: 'choose',
                    },
                },
                { id: 'after', content: 'after' },
            ],
        };

        expect(getTutorialHiddenAutomationContractErrors(manifest)).toEqual([]);
    });

    it('keeps all authored game tutorial manifests within the hidden automation contract', () => {
        const entries = [
            ...collectManifests('betrayal', betrayalTutorials),
            ...collectManifests('cardia', cardiaTutorial),
            ...collectManifests('dicethrone', diceThroneTutorial),
            ...collectManifests('fantasyrealms', fantasyRealmsTutorial),
            ...collectManifests('mage-wars', mageWarsTutorials),
            ...collectManifests('qidahen', qidahenTutorials),
            ...collectManifests('smashup', smashUpTutorials),
            ...collectManifests('splendor', splendorTutorial),
            ...collectManifests('summonerwars', summonerWarsTutorial),
            ...collectManifests('the-gang', theGangTutorial),
            ...collectManifests('tictactoe', ticTacToeTutorial),
        ];

        const failures = entries
            .map(({ label, manifest }) => ({
                label,
                errors: getTutorialHiddenAutomationContractErrors(manifest),
            }))
            .filter(({ errors }) => errors.length > 0);

        expect(failures).toEqual([]);
    });
});
