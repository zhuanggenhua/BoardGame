import { setAssetsBaseUrl } from './src/core/AssetLoader';
import '@testing-library/jest-dom';

// Tests should be deterministic and not depend on external/CDN base URLs.
setAssetsBaseUrl('/assets');
