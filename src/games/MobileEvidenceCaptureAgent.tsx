import { MobileEvidenceCaptureAgent } from '../components/system/MobileEvidenceCaptureAgent';
import { mobileEvidenceScenarioHandlers } from './mobileEvidenceScenarios';

export default function GameMobileEvidenceCaptureAgent() {
    return <MobileEvidenceCaptureAgent scenarioHandlers={mobileEvidenceScenarioHandlers} />;
}
