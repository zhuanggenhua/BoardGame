import manifest from './manifest';
import { ManifestGameThumbnail } from '../../components/lobby/thumbnails';

/**
 * 卡迪亚缩略图组件
 */
export default function Thumbnail() {
    return <ManifestGameThumbnail manifest={manifest} />;
}
