# Video Downloader Extension

[![Coverage Status](https://img.shields.io/badge/coverage-86.72%25-brightgreen)]()
[![Branch Coverage](https://img.shields.io/badge/branch%20coverage-77.64%25-brightgreen)]()
[![Tests](https://img.shields.io/badge/tests-447%20passed-brightgreen)]()

A Chrome extension to download HLS and DASH streaming videos with TDD methodology.

## Setup

```bash
npm install
npm test
npm run build
```

## Development

```bash
npm run dev         # Watch mode
npm test:watch      # Test watch mode
```

## Loading Extension

1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `downloader` directory

## Architecture

- **Service Worker**: Intercepts network requests, captures video URLs
- **Content Script**: Scans page DOM for video tags
- **Popup UI**: Lists detected videos and manages downloads
- **Utils**: HLS/DASH parsers, FFmpeg integration, download manager

## Testing

All code follows TDD: tests are written BEFORE implementation.

```bash
npm test                # Run all tests
npm test:watch          # Watch mode
npm run test:coverage   # Coverage report
```

Target: >80% coverage

For comprehensive testing documentation, fixtures guide, mocks patterns, and debugging tips, see [TESTING.md](TESTING.md).

## Performance

The extension is optimized for minimal bundle size and fast execution:

### Build Size (Production)
| Component | Size | Target | Status |
|-----------|------|--------|--------|
| service-worker.js | 18 KB | < 20 KB | ✅ |
| content-script.js | 1.8 KB | < 5 KB | ✅ |
| popup.js | 4.2 KB | < 10 KB | ✅ |
| **Total dist/** | **40 KB** | **< 100 MB** | ✅ |

**Note**: FFmpeg.wasm (~30MB) is lazy-loaded on-demand, not bundled with main extension.

### Parser Performance
- **HLS Parser**: 1000-segment playlist parsed in **~70ms** (target: < 100ms)
- **DASH Parser**: Complex MPD with 50+ representations parsed in **~20ms** (target: < 200ms)
- **Fragment Downloader**: Maintains **6 parallel fetches** for optimal throughput

### Service Worker Performance
- **Module Load Time**: ~245ms (target: < 500ms)
- **Startup Overhead**: Minimal, auto-initializes on extension load

### Memory Usage
- **Idle State**: ~45MB estimated (typical extension background page)
- **Peak During Download**: < 500MB for large file concatenation
- **FFmpeg Processing**: WASM worker manages memory independently

### Test Suite Performance
- **All 447 Tests**: Execute in ~57 seconds (430 feature tests + 17 performance tests)
- **100% Compatibility**: Tree-shaking and minification enabled in production builds
- **Coverage**: 86.72% lines, 77.64% branches

Run performance tests:
```bash
npm test -- __tests__/performance.test.js
```

## Features

- ✅ **HLS Stream Detection**: Automatically detects and downloads HLS (M3U8) streams
- ✅ **DASH Stream Detection**: Automatically detects and downloads DASH (MPD) streams
- ✅ **Direct Video Download**: Downloads simple video files (MP4, WebM, MOV, FLV)
- ✅ **Stream Fragment Assembly**: Automatically concatenates video segments into MP4 files
- ✅ **Progressive Download**: Real-time progress reporting during downloads
- ✅ **Network Request Interception**: Captures video URLs from network activity
- ✅ **DOM Scanning**: Discovers video elements on web pages
- ✅ **Dynamic Content Support**: Detects videos added dynamically to the page
- ✅ **Multiple Video Format Support**: HLS, DASH, MP4, WebM, MOV, FLV

## Supported Video Formats

| Format | Type | Detection | Download |
|--------|------|-----------|----------|
| HLS (M3U8) | Streaming | Network interception + DOM scanning | Yes (fragments → MP4) |
| DASH (MPD) | Streaming | Network interception + DOM scanning | Yes (segments → MP4) |
| MP4 | Direct | Network interception + DOM scanning | Yes (direct) |
| WebM | Direct | Network interception + DOM scanning | Yes (direct) |
| MOV | Direct | Network interception + DOM scanning | Yes (direct) |
| FLV | Direct | Network interception + DOM scanning | Yes (direct) |

## Architecture Details

### Three Extension Components

**1. Service Worker** (`src/background/service-worker.js`)
- Global network request interceptor via `chrome.webRequest.onBeforeRequest`
- Captures HLS/DASH manifest URLs and video URLs
- Maintains in-memory cache of detected videos
- Persists video metadata to `chrome.storage.local`
- Routes downloads to appropriate handler (HLS → parser → fragments → FFmpeg, DASH → parser → segments → FFmpeg, direct → download)
- Handles message passing from Content Script and Popup

**2. Content Script** (`src/content/content-script.js`)
- Injected into all web pages
- Scans DOM for `<video>` elements and extracts URLs
- Monitors for dynamically added video elements via MutationObserver
- Traverses iframes (same-origin) and shadow DOM recursively
- Deduplicates discovered URLs
- Communicates discovered videos to Service Worker
- Fallback mechanism when network interception misses videos

**3. Popup UI** (`src/popup/popup.js`, `src/popup/popup.html`, `src/popup/popup.css`)
- Lists all detected videos from current tab
- Displays video metadata: URL, type (HLS/DASH/MP4), quality, timestamp
- Type-specific icons: 📺 HLS, 🎬 DASH, 🎞️ MP4
- Filter dropdown: All/HLS/DASH/MP4
- Sort dropdown: Newest/Quality
- Download button with real-time progress bar
- Clear All button to remove video list
- Refresh button to reload from storage
- Error/success status messages

### Utility Modules (`src/utils/`)

| Module | Purpose |
|--------|---------|
| `media-extensions.js` | Media type detection, URL classification, extension mapping |
| `hls-parser.js` | Parse M3U8 playlists (master + media variants) |
| `dash-parser.js` | Parse MPD manifests with caching support |
| `fragment-downloader.js` | Download segments/fragments with retry logic, up to 6 parallel fetches |
| `ffmpeg-concatenator.js` | Concatenate TS/M4S fragments into MP4 using FFmpeg.wasm |
| `download-manager.js` | Handle blob downloads, filename generation, retry with exponential backoff |

## Stack

- **Build**: Webpack 5 with production minification and tree-shaking
- **Testing**: Jest + jsdom with 447 tests, 86.72% coverage
- **Media Processing**: FFmpeg.wasm (lazy-loaded, ~30MB)
- **Manifest**: Chrome Extension Manifest V3 (native Chrome/Edge)
- **Storage**: Chrome local storage for video metadata persistence

## Known Limitations

1. **Cross-origin Restrictions**: Cannot intercept HTTPS streams on sites with restrictive CSP headers
2. **Encrypted Streams**: HLS streams with encryption (EXT-X-KEY) are not supported
3. **Live Streams**: Live HLS/DASH streams require playlist polling (not yet implemented)
4. **Memory**: FFmpeg concatenation is memory-constrained (estimated <500MB peak for typical files)
5. **Fragment Limit**: Very large playlists (>10,000 segments) may impact performance
6. **WASM Support**: Requires browser with WebAssembly support (all modern browsers support this)
7. **Background Page Limits**: Service Worker can be suspended after 5 minutes of inactivity
8. **Parallel Limits**: Maximum 6 parallel fragment downloads (browser connection limit)

## Troubleshooting

### Videos Not Detected
1. Ensure extension is enabled in `chrome://extensions/`
2. Check that page has video streams (some sites load videos dynamically)
3. Try clicking the Refresh button in the popup
4. Check browser console for error messages

### Download Fails
1. Verify network connection is stable
2. Check that video URL is still accessible
3. Ensure sufficient disk space for download
4. Try again - automatic retry logic (up to 3 retries) is built-in

### Extension Disabled After Inactivity
Service Worker automatically reloads when needed. Simply retry the download.

## Phases

See `tasks.md` for complete 12-phase TDD roadmap and implementation progress.
