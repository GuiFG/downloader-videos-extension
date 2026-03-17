# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

### FFmpeg Module Pattern
- **Lazy-loading module**: Use module-scope variable (e.g., `let ffmpegInstance = null`) to cache heavy resources
- **Mock strategy**: Create mock classes that maintain internal state (fileSystem Map) to simulate actual API behavior
- **Progress callbacks**: Pass optional `onProgress(percent)` in options object; call at key milestones (0%, 25%, 50%, 75%, 100%)
- **AbortSignal pattern**: Check `signal?.aborted` at multiple points; throw `DOMException('...', 'AbortError')` for abort cases
- **Validation helpers**: Extract validation logic into separate functions (e.g., `validateFragments()`) for reusability

### Chrome API Message Pattern
- **Message handling**: Use `handleMessage(message, sender)` returning Promise with consistent response structure
- **Storage operations**: Wrap chrome.storage.local callbacks in Promises for async/await compatibility
- **Broadcasting**: Use `chrome.tabs.query()` then `chrome.tabs.sendMessage()` to notify all tabs of updates
- **Request interception**: Register chrome.webRequest.onBeforeRequest listener for network monitoring
- **Deduplication strategy**: Normalize URLs (remove query params/fragments) for comparison, preserve tab/timestamp context

---

## [2026-03-17] - US-003 (Service Worker)

### What was implemented
- Complete Service Worker module for network request interception and video URL detection
- 54 comprehensive tests covering:
  - URL normalization and deduplication for query params/fragments
  - Video URL detection and classification (HLS, DASH, MP4, stream segments)
  - Message handler implementation (GET_VIDEOS, ADD_VIDEO, CLEAR_VIDEOS, DOWNLOAD_VIDEO)
  - Chrome storage integration and persistence
  - Video broadcasting to all extension components
  - Download functionality for HLS/DASH/simple videos
  - Error handling and edge cases
  - Network request interception simulation

### Files changed
- **Created**: `src/background/service-worker.js` - Service Worker with 13 exported functions
- **Created**: `__tests__/service-worker.test.js` - 54 comprehensive tests (all passing)

### Acceptance Criteria Status
✅ All acceptance criteria met:
- 54 tests (>7 required) covering request interception, storage, deduplication, message handlers
- chrome.webRequest.onBeforeRequest listener with media URL filtering
- Storage structure: {url, type, timestamp, tabId}
- Message handlers: GET_VIDEOS, ADD_VIDEO, CLEAR_VIDEOS, DOWNLOAD_VIDEO all implemented
- URL deduplication using normalized URLs (cleanUrl)
- DEBUG_SERVICE_WORKER flag for logging
- Broadcasting via chrome.tabs.query() + chrome.tabs.sendMessage()
- Integration mocks with hls-parser, dash-parser, fragment-downloader, ffmpeg-concatenator, download-manager
- Initialization loads and persists videos from chrome.storage.local
- Test coverage: **84.56%** statements, **79.71%** branches, **78.78%** functions, **84.07%** lines
- **ESLint**: No errors on service-worker files
- All 242 tests across all modules **PASS**

### Learnings
- **URL normalization**: Parse full URL objects for case-insensitive domain comparison while preserving path structure
- **Chrome message protocol**: All chrome.storage operations must wrap callbacks in Promises for async/await
- **Deduplication accuracy**: Normalize both sides of URL comparison for consistent deduplication across different query param variations
- **Mock strategy for service worker**: Mock both utility modules AND the global chrome API to test in isolation
- **Error handling patterns**: Check conditions early before logging/processing to avoid null reference errors
- **Broadcasting strategy**: Query tabs first, then send messages with error handling (tabs without content script fail gracefully)
- **Stream reading pattern**: Use reader.getReader() with explicit releaseLock() in finally block for proper cleanup
- **Fragment type detection**: Fetch manifest content, parse for segment URLs, then download with parallel fetching (6 parallel max)

---

## [2026-03-17] - US-002 (Download Manager)

### What was implemented
- Complete download manager module for handling video downloads across HLS, DASH, and simple video streams
- 29 comprehensive tests covering:
  - Filename generation with consistent format (video_YYYYMMDD_quality.ext)
  - Filename sanitization for invalid characters
  - Download status tracking with metadata
  - Chrome storage integration for directory management
  - Blob download with chrome.downloads API
  - Simple video fetch with retry logic and exponential backoff
  - Progress callback reporting during downloads
  - Content-Type validation for video streams
  - Accept-Ranges header support for resumption
  - Filename conflict handling (Chrome's built-in mechanism)

### Files changed
- **Created**: `src/utils/download-manager.js` - Core download management with 6 exported functions
- **Created**: `__tests__/download-manager.test.js` - 29 comprehensive tests (all passing)
- **Fixed**: ESLint issues (removed unused imports, added global chrome declaration, refactored constant loop condition)

### Acceptance Criteria Status
✅ All acceptance criteria met:
- 29 tests covering blob download, filename generation, sanitization, conflict detection
- `downloadBlob(blob, filename, options)` fully implemented with chrome.downloads integration
- `generateFilename(baseUrl, type, quality)` returns format: video_YYYYMMDD_1080p.mp4
- `sanitizeFilename(name)` helper using regex to remove invalid characters
- Directory customization via `setDownloadDirectory()` and `getDownloadDirectory()`
- Download status tracking via `createDownloadStatus()` with {downloadId, filename, status, progress, timestamp}
- Resumption support verified with Accept-Ranges header test
- Filename conflict handling via chrome.downloads API automatic numbering
- Support for types: 'hls', 'dash', 'simple' with appropriate metadata
- Test coverage: **92.04%** statements, **77.55%** branches, **95.23%** functions, **95.06%** lines
- **ESLint**: No errors on download-manager files
- All 29 tests **PASS**

### Learnings
- **Blob URL lifecycle**: Create with `createObjectURL()`, revoke after download starts (with timeout to allow browser to process)
- **Retry strategy**: Exponential backoff with base delay of 1000ms, doubling on each retry (1s, 2s, 4s)
- **Stream reading**: Use `response.body.getReader()` with proper cleanup via `releaseLock()` for reliable streaming
- **Progress tracking**: Calculate percent based on content-length header; report at each chunk boundary
- **Chrome API pattern**: Use Promise wrapper around callback-based chrome.downloads.download() for consistency
- **Filename format**: Simple but effective pattern (video_YYYYMMDD_quality.ext) avoids timezone issues with fixed YYYYMMDD format
- **Sanitization scope**: Chrome handles filename conflicts automatically with (1), (2), etc., so app only needs to validate character safety

---

## [2026-03-17] - US-001 (FFmpeg Concatenator)

### What was implemented
- Complete FFmpeg concatenator module for combining video fragments (TS/M4S) into MP4 files
- 28 comprehensive tests covering:
  - Basic blob concatenation and format support
  - TS (MPEG-TS) and M4S (ISO-BMFF) fragment type detection
  - Progress callback reporting (0-100%)
  - AbortSignal-based cancellation
  - FFmpeg instance caching and reuse
  - Web Worker option support
  - Error handling and timeouts
  - Validation of fragments and output formats

### Files changed
- **Created**: `src/utils/ffmpeg-concatenator.js` - Core concatenation logic with lazy-loaded FFmpeg.wasm
- **Created**: `__tests__/ffmpeg-concatenator.test.js` - 28 tests (all passing)
- **Created**: `__tests__/mocks/ffmpeg.mock.js` - FFmpeg.wasm mock implementation
- **Fixed**: ESLint warnings in mock functions (unused parameters marked with `_` prefix)

### Acceptance Criteria Status
✅ All acceptance criteria met:
- 28 tests covering blob concatenation, TS/M4S support, metadata validation, error handling
- FFmpeg.wasm mocking implemented with file system simulation
- `concatenateFragments(blobs, outputFormat, options)` fully implemented
- Lazy-loading via `loadFFmpeg()` with module-scope cache
- Web Worker support via `useWorker` option
- Progress callbacks with 0%, intermediate, and 100% updates
- FFmpeg instance caching with `clearFFmpegCache()` function
- Test coverage: **80.17%** statements, **81.25%** lines, **78.57%** branches
- **ESLint**: No warnings/errors on FFmpeg files
- All 28 tests **PASS**

### Learnings
- **Fragment type detection**: MIME type inspection (`video/mp2t` vs `video/iso.segment`) is reliable for determining TS vs M4S
- **FFmpeg concat protocol**: Using concat demuxer (`-f concat` with file list) is more robust than concat string filter
- **Mock file system**: Maintaining Map-based file system in mock allows realistic simulation of FFmpeg's virtual FS
- **Progress granularity**: Reporting progress in 6-8 key points (0%, per-blob write, concat, exec, output read, cleanup, 100%) provides good UX feedback
- **AbortSignal placement**: Checking abort status after every async operation prevents dangling promises

---
