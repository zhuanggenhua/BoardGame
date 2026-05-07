import { AudioProvider } from '../contexts/AudioContext';
import { useLocation } from 'react-router-dom';
import { MatchRoom } from './MatchRoom';

export default function TutorialMatchRoomWithAudio() {
    const location = useLocation();
    const routeKey = `${location.pathname}${location.search}${location.hash}`;

    return (
        <AudioProvider>
            <MatchRoom key={routeKey} />
        </AudioProvider>
    );
}
