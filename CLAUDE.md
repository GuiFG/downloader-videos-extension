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

✅ **Fully implemented and tested:**

- **Utilities** — `media-extensions`, `hls-parser`, `dash-parser`, `fragment-downloader`
- **Service Worker** — Intercepts network requests, detects HLS/DASH/MP4 streams, manages downloads with FFmpeg concatenation
- **Content Script** — Scans DOM and iframes for video elements, supports Shadow DOM traversal, debounced MutationObserver for dynamic content
- **Popup UI** — Lists detected videos with filters (by type), sort options (by recency), download progress tracking, refresh and clear actions
- **Download Manager** — Handles fragment downloads with up to 6 parallel fetches, retry logic, and FFmpeg-based concatenation
- **FFmpeg Concatenator** — WASM-based in-browser video processing for seamless segment concatenation

### Key Dependency

`@ffmpeg/ffmpeg` is used in-browser (WASM) for media processing — there is no backend.

## Streaming Platform Support

The extension detects and captures videos from multiple streaming platforms using a three-tier detection strategy that prioritizes extension-based detection, falls back to URL patterns for extension-less streaming URLs, and finally attempts Content-Type header detection.

### Detection Priority Order

The service worker uses the following detection priority:

1. **Extension-based detection** (highest priority) — Checks for known media file extensions (`.mp4`, `.m3u8`, `.mpd`, etc.)
2. **URL pattern detection** (fallback) — Uses regex patterns to recognize streaming platform domains/paths
3. **Content-Type detection** (fallback) — Inspects HTTP response headers for media MIME types

This priority ensures that files with extensions are detected fastest, while extension-less streaming URLs from platforms like YouTube and Vimeo are still captured via pattern matching.

### Currently Supported Platforms

#### YouTube (Google Video)
- **Pattern:** `googlevideo.com` domain (with any subdomains)
- **Detects:** HLS/DASH video segments served from Google's CDN
- **Example URLs:**
  - `https://r5---sn-p5qlsn7r.googlevideo.com/videoplayback?itag=18...`
  - `https://googlevideo.com/videoplayback?...`

#### Vimeo
- **Patterns:**
  - `vimeo.com/video/` — Direct video page URLs
  - `player.vimeo.com` — Embedded player requests
- **Detects:** Vimeo video streams and manifest requests
- **Example URLs:**
  - `https://vimeo.com/video/123456789/config`
  - `https://player.vimeo.com/video/123456789`

### URL Pattern Format

URL patterns are defined in `src/utils/media-extensions.js` as regular expressions in the `URL_PATTERNS` constant:

```javascript
export const URL_PATTERNS = {
  stream: [
    /(?:^|\/\/|\.)([\w-]+\.)*googlevideo\.com(?:[/?#]|$)/i,  // YouTube/Google Video
    /(?:^|\/\/)(?:[\w-]+\.)*vimeo\.com\/video\//i,           // Vimeo video URLs
    /(?:^|\/\/)(?:[\w-]+\.)*player\.vimeo\.com/i,            // Vimeo player
  ],
};
```

#### Regex Syntax Notes

- **Word boundaries:** Patterns use `(?:^|\/\/|\.)([\w-]+\.)*domain\.com(?:[/?#]|$)` to avoid false matches (e.g., `fakegooglevideo.com` will not match `googlevideo.com`)
- **Subdomain handling:** `([\w-]+\.)*` matches optional subdomains and CDN hostnames
- **Query/Fragment stripping:** Pattern detection automatically removes query parameters and fragments before matching (`url.split('?')[0].split('#')[0]`)
- **Case-insensitivity:** All patterns use the `i` flag for case-insensitive matching

### Adding a New Streaming Platform

To add support for a new streaming platform:

#### Step 1: Add the regex pattern to `URL_PATTERNS`

```javascript
// src/utils/media-extensions.js

export const URL_PATTERNS = {
  stream: [
    // ... existing patterns ...
    /(?:^|\/\/|\.)([\w-]+\.)*newplatform\.com(?:[/?#]|$)/i,  // New Platform
  ],
};
```

**Pattern checklist:**
- Use `(?:^|\/\/|\.)([\w-]+\.)*domain\.com(?:[/?#]|$)` as the template for domain-based detection
- Include the `/i` flag for case-insensitivity
- Account for CDN subdomains with `([\w-]+\.)*` if the platform uses regional CDN nodes
- Test the pattern against real URLs from the platform

#### Step 2: Add test fixtures

```javascript
// __tests__/fixtures/streaming-urls.js

export const NEW_PLATFORM_FIXTURES = [
  'https://cdn1.newplatform.com/stream/video123.ts',
  'https://stream.newplatform.com/manifest.m3u8',
  // ... more real URLs from the platform
];
```

#### Step 3: Add unit tests

```javascript
// __tests__/media-extensions.test.js

describe('New Platform Pattern Detection', () => {
  test('detects new platform URLs by pattern', () => {
    NEW_PLATFORM_FIXTURES.forEach((url) => {
      expect(detectMediaTypeByPattern(url)).toBe('stream');
    });
  });

  test('ignores non-matching URLs', () => {
    expect(detectMediaTypeByPattern('https://example.com/video')).toBeNull();
  });
});
```

#### Step 4: Verify with debug logging

Run tests with debug logging enabled to verify the pattern matches correctly:

```bash
DEBUG_VIDEO_DETECTION=true npm test __tests__/media-extensions.test.js
```

### Content-Type Detection Fallback

When a streaming URL has no file extension and doesn't match any URL pattern, the service worker inspects the HTTP response headers for Content-Type. Any response with a `video/*` or `audio/*` MIME type is detected as a stream.

**Supported MIME types:**
- Video: `video/mp4`, `video/webm`, `video/quicktime`, `video/x-matroska`, `video/x-msvideo`, `video/x-flv`, etc.
- Audio: `audio/mpeg`, `audio/wav`, `audio/aac`, `audio/ogg`, `audio/x-wav`, etc.

### Platform-Specific Limitations and Quirks

#### YouTube/Google Video
- **CDN Subdomains:** YouTube uses regional CDN nodes like `r5---sn-p5qlsn7r.googlevideo.com`. The pattern matches any subdomain structure before `googlevideo.com`.
- **Playlist vs. Single Video:** The pattern detects individual video segment requests, not playlist metadata. You'll see multiple entries for a single video as different formats/resolutions are loaded.
- **Query Parameter Heavy:** YouTube URLs have extensive query parameters (bitrate, token, expiration, etc.). The pattern detector strips these before matching.

#### Vimeo
- **Dual Pattern Support:** Vimeo requires two patterns — one for direct video URLs (`vimeo.com/video/`) and one for embedded player requests (`player.vimeo.com`).
- **Config Endpoints:** Vimeo serves video metadata through config endpoints (e.g., `vimeo.com/video/123456789/config`) which are detected by the first pattern.
- **Authentication:** Some Vimeo content requires authentication tokens, which are appended as query parameters. Pattern matching works regardless of authentication state.

#### Content-Type Detection
- **Fallback Mechanism:** If a URL doesn't have an extension and doesn't match a known platform pattern, Content-Type detection kicks in during the `onHeadersReceived` listener.
- **Performance:** Content-Type detection is slightly slower than extension/pattern matching because it requires waiting for response headers.
- **Charset Parameters:** Some servers include charset parameters in Content-Type (e.g., `video/mp4; charset=utf-8`). The detector extracts the MIME type before the first semicolon.

### Debug Logging

Enable debug logging for video detection by setting the `DEBUG_VIDEO_DETECTION` environment variable:

```bash
# Run tests with debug output
DEBUG_VIDEO_DETECTION=true npm test

# Or build with debug enabled
DEBUG_VIDEO_DETECTION=true npm run build
```

**Debug output includes:**
- Timestamp (ISO format) for each detection attempt
- Source identification (`service-worker` or `content-script`)
- Which detection methods were tried and whether they matched
- The detected type and method when successful
- Detailed failure reasons when no method matched

**Example debug output:**
```
[2026-03-17T14:23:45.123Z] [service-worker] Video Detection Attempts: https://r5---sn-p5qlsn7r.googlevideo.com/videoplayback?...
  extension: ✗ failed (no extension)
  pattern: ✓ matched (googlevideo.com)
  content-type: (skipped)

[2026-03-17T14:23:45.124Z] [service-worker] ✓ Video Detected: https://r5---sn-p5qlsn7r.googlevideo.com/videoplayback?...
  {type: "stream", method: "pattern"}
```

### Testing Platform Detection

The test suite includes comprehensive fixtures and tests for all supported platforms. To run detection tests:

```bash
# Run media-extensions tests specifically
npx jest __tests__/media-extensions.test.js -t "pattern|Platform"

# Run with debug output
DEBUG_VIDEO_DETECTION=true npx jest __tests__/media-extensions.test.js
```

Test coverage verifies:
- Basic platform URL detection
- Complex URLs with query parameters and fragments
- Malformed and non-matching URLs
- Edge cases (empty strings, null values, etc.)
- Integration with extension-based and Content-Type detection
- Proper deduplication across detection methods
