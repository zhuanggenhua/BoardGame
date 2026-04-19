import { AudioProvider } from '../contexts/AudioContext';
import { LocalMatchRoom } from './LocalMatchRoom';

export default function LocalMatchRoomWithAudio() {
    return (
        <AudioProvider>
            <LocalMatchRoom />
        </AudioProvider>
    );
}
