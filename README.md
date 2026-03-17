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

## Stack

- **Build**: Webpack
- **Testing**: Jest + Testing Library
- **Media Processing**: FFmpeg.wasm
- **Manifest**: V3 (Chrome/Edge native)

## Phases

See `tasks.md` for complete 12-phase TDD roadmap.
