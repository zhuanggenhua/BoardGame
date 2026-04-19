import { AudioProvider } from '../contexts/AudioContext';
import { MatchRoom } from './MatchRoom';

export default function MatchRoomWithAudio() {
    return (
        <AudioProvider>
            <MatchRoom />
        </AudioProvider>
    );
}
