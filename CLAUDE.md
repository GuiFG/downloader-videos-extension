# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install              # Install dependencies
npm test                 # Run all Jest tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run build            # Build production bundles to dist/
npm run dev              # Build in development mode with watch
npm run lint             # Run ESLint on src/ and __tests__/
```

To run a single test file:
```bash
npx jest __tests__/media-extensions.test.js
```

## Architecture

This is a Chrome Extension (Manifest V3) for detecting and downloading HLS/DASH video streams from web pages. The project follows TDD with a Red → Green → Refactor cycle — tests are written before implementation.

### Three Extension Components

**Service Worker** (`src/background/service-worker.js`) — Intercepts network requests globally to capture HLS/DASH/MP4 URLs, stores detected video metadata in `chrome.storage`, manages downloads.

**Content Script** (`src/content/content-script.js`) — Injected into web pages; scans the DOM for `<video>` elements and sends discovered URLs to the service worker as a fallback when network interception misses them.

**Popup** (`src/popup/popup.{html,js,css}`) — Shows detected videos for the current tab, triggers downloads, communicates with the service worker via `chrome.runtime.sendMessage`.

### Utility Modules (`src/utils/`)

- `media-extensions.js` — Media type detection and URL classification
- `hls-parser.js` — Parse M3U8 playlists (master + media)
- `dash-parser.js` — Parse MPD manifests
- `fragment-downloader.js` — Download segments with retry logic and up to 6 parallel fetches

### Build Output

Webpack 5 produces three bundles in `dist/`: `service-worker.js`, `content-script.js`, `popup.js`.

### Testing

- **Framework:** Jest + jsdom
- **Coverage threshold:** >80% lines/functions/statements, >75% branches
- **Test setup:** `__tests__/jest.setup.js` provides global Chrome API mocks, TextEncoder, DOMParser
- **Chrome API mocks:** `__tests__/mocks/chrome-api.js` — reusable mock factory
- **Fixtures:** `__tests__/fixtures/` — M3U8, MPD, and video test data

### Implementation Status

Utilities (`media-extensions`, `hls-parser`, `dash-parser`, `fragment-downloader`) are fully implemented and tested. The three extension components (`service-worker.js`, `content-script.js`, `popup.js`) contain only TODO stubs — these follow the TDD phases defined in `tasks.md`.

### Key Dependency

`@ffmpeg/ffmpeg` is used in-browser (WASM) for media processing — there is no backend.
