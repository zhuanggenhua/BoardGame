import { AudioProvider } from '../contexts/AudioContext';
import { TestMatchRoom } from './TestMatchRoom';

export default function TestMatchRoomWithAudio() {
    return (
        <AudioProvider>
            <TestMatchRoom />
        </AudioProvider>
    );
}
