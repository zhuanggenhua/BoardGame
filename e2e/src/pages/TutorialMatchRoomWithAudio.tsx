import { AudioProvider } from '../contexts/AudioContext';
import { MatchRoom } from './MatchRoom';

export default function TutorialMatchRoomWithAudio() {
    return (
        <AudioProvider>
            <MatchRoom />
        </AudioProvider>
    );
}
