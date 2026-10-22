import manifest from './manifest';
import { ManifestGameThumbnail } from '../../components/lobby/thumbnails';
import './thumbnail.css';

export default function Thumbnail() {
    return (
        <div className="betrayal-game-thumbnail">
            <ManifestGameThumbnail manifest={manifest} />
        </div>
    );
}
