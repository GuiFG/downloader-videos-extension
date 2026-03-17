# Video Downloader Extension

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

## Stack

- **Build**: Webpack
- **Testing**: Jest + Testing Library
- **Media Processing**: FFmpeg.wasm
- **Manifest**: V3 (Chrome/Edge native)

## Phases

See `tasks.md` for complete 12-phase TDD roadmap.
