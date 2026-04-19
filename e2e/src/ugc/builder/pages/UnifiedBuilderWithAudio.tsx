import { AudioProvider } from '../../../contexts/AudioContext';
import { UnifiedBuilder } from './UnifiedBuilder';

export default function UnifiedBuilderWithAudio() {
    return (
        <AudioProvider>
            <UnifiedBuilder />
        </AudioProvider>
    );
}
