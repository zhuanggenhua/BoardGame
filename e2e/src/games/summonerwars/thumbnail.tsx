/**
 * 召唤师战争 - 缩略图组件
 */

import manifest from './manifest';
import { ManifestGameThumbnail } from '../../components/lobby/thumbnails';

export default function Thumbnail() {
    return <ManifestGameThumbnail manifest={manifest} />;
}
