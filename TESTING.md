# Testing Guide

This document provides comprehensive guidance on running, understanding, and debugging tests in the Video Downloader Extension project.

## Quick Start

```bash
npm test                # Run all tests once
npm run test:watch      # Run tests in watch mode (re-runs on file changes)
npm run test:coverage   # Generate coverage report
npm run lint            # Run ESLint on src/ and __tests__/
```

## Running Tests

### Run All Tests
```bash
npm test
```
Expected output: **430 tests, 430 passed**

### Run Tests in Watch Mode
```bash
npm run test:watch
```
Watches for file changes and re-runs tests automatically. Useful during development.

### Generate Coverage Report
```bash
npm run test:coverage
```
Generates an HTML coverage report in `coverage/` directory. Open `coverage/lcov-report/index.html` in a browser.

**Coverage Targets:**
- Lines: >80% ✓ (currently 86.72%)
- Functions: >80% ✓ (currently 86.59%)
- Statements: >80% ✓ (currently 86.36%)
- Branches: >75% ✓ (currently 77.64%)

### Run Specific Test File
```bash
npx jest __tests__/media-extensions.test.js
```

### Run Tests Matching Pattern
```bash
npx jest --testNamePattern="HLS" # Runs tests containing "HLS"
npx jest --testNamePattern="download" # Runs tests containing "download"
```

### Run with Verbose Output
```bash
npm test -- --verbose
```
Shows detailed output for each test case.

### Debug Tests in Node Inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```
Open `chrome://inspect` to debug. Use `--runInBand` to disable parallel test execution for easier debugging.

## Test Structure

The test suite follows a **TDD (Test-Driven Development)** approach:

```
__tests__/
├── jest.setup.js                          # Global test setup & Chrome API mocks
├── mocks/
│   ├── chrome-api.js                      # Chrome API mock factory
│   └── ffmpeg.mock.js                     # FFmpeg.wasm mock
├── fixtures/
│   ├── simple.m3u8                        # HLS playlist (basic segments)
│   ├── variants.m3u8                      # HLS with multiple quality variants
│   ├── encrypted.m3u8                     # HLS with encryption info
│   ├── relative-urls.m3u8                 # HLS with relative URLs
│   ├── with-duration.m3u8                 # HLS with segment duration metadata
│   ├── malformed.m3u8                     # Invalid HLS (error handling)
│   └── sample.mpd                         # DASH manifest
│
├── media-extensions.test.js               # Media type detection (62 tests)
├── hls-parser.test.js                     # HLS M3U8 parsing (72 tests)
├── dash-parser.test.js                    # DASH MPD parsing (62 tests)
├── fragment-downloader.test.js            # Video fragment downloading (34 tests)
├── ffmpeg-concatenator.test.js            # Fragment concatenation (28 tests)
├── download-manager.test.js               # Download coordination (29 tests)
├── service-worker.test.js                 # Network interception (54 tests)
├── content-script.test.js                 # DOM scanning (19 tests)
├── popup.test.js                          # UI functionality (62 tests)
├── e2e.test.js                            # Integration tests (12 tests)
└── simple-video-download.test.js          # Direct video download (20 tests)
```

## Test Suites Overview

### 1. Media Extensions (62 tests)
**File:** `__tests__/media-extensions.test.js`

Tests the `src/utils/media-extensions.js` module for media type detection.

**Key Functions Tested:**
- `isMediaURL(url)` - Detects if URL is a media file
- `getMediaType(url)` - Classifies URL as 'hls', 'dash', 'video', 'segment'
- `cleanUrl(url)` - Removes query params and fragments
- `getExtensionsByType(type)` - Returns extensions for media type
- `isPlaylistURL(url)` - Detects HLS/DASH playlists
- `isSimpleVideoURL(url)` - Detects direct video files (MP4, WebM, etc.)
- `isStreamSegmentURL(url)` - Detects video fragments (TS, M4S)

**Test Categories:**
- **Constants & Exports**: MEDIA_EXTENSIONS object structure
- **HLS Detection**: M3U8 URLs with various patterns
- **DASH Detection**: MPD URLs and manifest detection
- **Simple Video Detection**: MP4, WebM, MOV, FLV files
- **Segment Detection**: TS (MPEG-TS) and M4S (ISO-BMFF) fragments
- **URL Normalization**: Query params, fragments, case handling
- **Edge Cases**: Invalid input, null/undefined handling
- **Error Handling**: Malformed URLs, invalid types

**Coverage:** 96.42% lines, 95.45% branches

### 2. HLS Parser (72 tests)
**File:** `__tests__/hls-parser.test.js`

Tests the `src/utils/hls-parser.js` module for parsing M3U8 playlists.

**Key Functions Tested:**
- `parseM3U8(content, baseUrl)` - Parses M3U8 playlist
- `selectVariant(variants, preference)` - Picks best quality variant
- `parseSegments(content, baseUrl)` - Extracts segment URLs

**Test Categories:**
- **Basic Parsing**: Simple M3U8 with sequential segments
- **Variant Selection**: Multiple quality options (720p, 1080p, 4K)
- **Encryption Handling**: EXT-X-KEY directives
- **Relative URLs**: Path resolution relative to base URL
- **Segments with Duration**: EXT-X-TARGETDURATION and timing
- **Master Playlists**: Variant selection and ranking
- **Edge Cases**: Empty playlists, missing variants, no preference
- **Error Handling**: Malformed content, invalid M3U8 syntax
- **URL Resolution**: Absolute vs relative path handling

**Fixtures Used:**
- `simple.m3u8` - Basic HLS with 3 segments
- `variants.m3u8` - Multiple quality variants
- `encrypted.m3u8` - Encryption information
- `relative-urls.m3u8` - Relative path resolution
- `with-duration.m3u8` - Duration metadata
- `malformed.m3u8` - Invalid syntax

**Coverage:** 85.55% lines, 76.37% branches

### 3. DASH Parser (62 tests)
**File:** `__tests__/dash-parser.test.js`

Tests the `src/utils/dash-parser.js` module for parsing MPD manifests.

**Key Functions Tested:**
- `parseMPD(content, baseUrl)` - Parses DASH manifest
- `selectRepresentation(representations, preference)` - Picks best quality
- `generateSegmentList(template, count)` - Creates segment URLs from template
- `extractAudio(adaptationSets)` - Extracts audio streams

**Test Categories:**
- **Manifest Parsing**: MPD structure and attributes
- **Representation Selection**: Multiple quality variants
- **Segment Templates**: Dynamic URL generation
- **Period Handling**: Time-based content organization
- **Adaptation Sets**: Video, audio, subtitle tracks
- **Cache Behavior**: Cached vs fresh manifest parsing
- **Live Stream Detection**: IsLive attribute
- **Error Handling**: Missing attributes, malformed XML
- **Edge Cases**: No representations, empty periods

**Fixtures Used:**
- `sample.mpd` - Standard DASH manifest

**Coverage:** 83.63% lines, 76.85% branches

### 4. Fragment Downloader (34 tests)
**File:** `__tests__/fragment-downloader.test.js`

Tests the `src/utils/fragment-downloader.js` module for downloading video segments.

**Key Functions Tested:**
- `downloadFragments(urls, options)` - Downloads multiple segments in parallel
- Configurable parallelism (default: 6 concurrent downloads)
- Progress tracking with callbacks
- Retry logic with exponential backoff
- AbortSignal support for cancellation

**Test Categories:**
- **Parallel Downloads**: 6 concurrent fetches
- **Progress Reporting**: Percentage completion updates
- **Retry Logic**: Exponential backoff (1s, 2s, 4s)
- **Timeout Handling**: Request timeouts
- **Abort Signals**: Cancellation via AbortController
- **Error Handling**: Failed downloads, network errors
- **Edge Cases**: Single URL, empty list, large payloads
- **Performance**: Parallel efficiency vs sequential

**Coverage:** 100% lines, 81.25% branches

### 5. FFmpeg Concatenator (28 tests)
**File:** `__tests__/ffmpeg-concatenator.test.js`

Tests the `src/utils/ffmpeg-concatenator.js` module for combining fragments.

**Key Functions Tested:**
- `concatenateFragments(blobs, outputFormat, options)` - Merges TS/M4S into MP4
- `loadFFmpeg()` - Lazy-loads FFmpeg.wasm
- `clearFFmpegCache()` - Cleans cached instance

**Test Categories:**
- **Format Support**: TS (MPEG-TS) and M4S (ISO-BMFF) fragments
- **Output Formats**: MP4, WebM, Matroska
- **Progress Callbacks**: 0%, 25%, 50%, 75%, 100% milestones
- **AbortSignal**: Cancellation during processing
- **Lazy Loading**: FFmpeg instance caching
- **Web Worker Support**: Offload to worker thread
- **Error Handling**: Invalid format, corrupted blobs
- **Edge Cases**: Single blob, many small blobs, timeout

**Mocks Used:**
- `ffmpeg.mock.js` - Simulates FFmpeg.wasm with file system

**Coverage:** 80.17% lines, 78.57% branches

### 6. Download Manager (29 tests)
**File:** `__tests__/download-manager.test.js`

Tests the `src/utils/download-manager.js` module for coordinating downloads.

**Key Functions Tested:**
- `downloadBlob(blob, filename, options)` - Uses chrome.downloads API
- `generateFilename(baseUrl, type, quality)` - Creates filename
- `sanitizeFilename(name)` - Removes invalid characters
- `downloadSimpleVideo(url, onProgress)` - Direct video download
- `setDownloadDirectory(path)` - Configure download location
- `getDownloadDirectory()` - Retrieve current directory
- `createDownloadStatus(id, filename, status)` - Track download state

**Test Categories:**
- **Filename Generation**: `video_YYYYMMDD_quality.ext` format
- **Sanitization**: Invalid characters removal
- **Blob Download**: chrome.downloads.download() integration
- **Directory Management**: Custom download paths
- **Simple Video Download**: Direct fetch + retry
- **Progress Tracking**: Callback reporting with percent
- **Content-Type Validation**: Video/* MIME types
- **Resumption Support**: Accept-Ranges header detection
- **Error Handling**: Network failures, invalid content
- **Retry Logic**: 3 attempts with exponential backoff

**Coverage:** 93.18% lines, 81.63% branches

### 7. Service Worker (54 tests)
**File:** `__tests__/service-worker.test.js`

Tests the `src/background/service-worker.js` module for network interception.

**Key Functions Tested:**
- `handleMessage(message, sender)` - Message dispatch
- `detectVideoURL(url)` - Classifies video URLs
- `addVideo(url, tabId)` - Stores discovered videos
- `getVideos()` - Retrieves stored videos
- `clearVideos()` - Empties video list
- `downloadVideo(video, onProgress)` - Initiates downloads
- `broadcastVideos()` - Notifies all tabs

**Test Categories:**
- **URL Detection**: HLS, DASH, MP4, segments
- **Deduplication**: Query params and fragment removal
- **Storage Integration**: chrome.storage.local persistence
- **Message Handlers**: GET_VIDEOS, ADD_VIDEO, CLEAR_VIDEOS, DOWNLOAD_VIDEO
- **Broadcasting**: Sends updates to all tabs
- **Download Routing**: Delegates to appropriate handler
- **Error Handling**: Invalid messages, storage errors
- **Integration**: Mocked utility modules (parsers, downloaders)

**Mocks Used:**
- hls-parser, dash-parser, fragment-downloader, ffmpeg-concatenator, download-manager

**Coverage:** 85.18% lines, 82.6% branches

### 8. Content Script (19 tests)
**File:** `__tests__/content-script.test.js`

Tests the `src/content/content-script.js` module for DOM scanning.

**Key Functions Tested:**
- `findVideoElements()` - Scans DOM for video sources
- `initContentScript()` - Sets up MutationObserver

**Test Categories:**
- **DOM Traversal**: Direct `<video>` elements and `<source>` children
- **Deduplication**: URL normalization with Set
- **Message Passing**: chrome.runtime.sendMessage integration
- **MutationObserver**: Dynamic video element detection
- **Debouncing**: 100ms debounce to prevent spam
- **iframe Support**: Same-origin iframe traversal
- **Shadow DOM**: Recursive shadow tree traversal
- **Data Attributes**: Custom `data-video-url` and `data-stream-url`
- **Error Handling**: Cross-origin iframes, malformed URLs

**Coverage:** 88.73% lines, 75% branches

### 9. Popup UI (62 tests)
**File:** `__tests__/popup.test.js`

Tests the `src/popup/popup.js` module for UI functionality.

**Key Functions Tested:**
- `getVideoList()` - Fetches videos from storage
- `renderVideoList(videos)` - Displays video grid
- `filterVideos(videos, type)` - Filters by type (hls, dash, video)
- `sortVideos(videos, sortBy)` - Sorts by recency or quality
- `downloadVideo(video, onProgress)` - Initiates downloads
- `clearAllVideos()` - Removes all stored videos
- `initPopup()` - Sets up UI and event listeners
- `updateStatus(message, type)` - Updates status display
- `updateProgress(percent)` - Updates progress bar

**Test Categories:**
- **Video Fetching**: chrome.storage.local retrieval
- **Video Rendering**: DOM element creation with icons
- **Filtering**: Type-based filtering (all, hls, dash, video)
- **Sorting**: By timestamp (newest) or quality (highest)
- **Download Flow**: Message passing to service worker
- **Progress Updates**: Progress bar and status messaging
- **Clear All**: Confirmation dialog and storage clearing
- **UI State**: Icon selection, status colors
- **Error Handling**: Download failures, invalid data
- **Edge Cases**: Rapid control changes, missing metadata

**Coverage:** 84.66% lines, 68.29% branches

### 10. E2E Integration (12 tests)
**File:** `__tests__/e2e.test.js`

Tests the complete pipeline from video detection to download.

**Key Integration Points:**
- Service Worker → Content Script communication
- Service Worker → Popup communication
- Video detection via network interception
- Video detection via DOM scanning
- Storage persistence and retrieval
- Complete download pipeline

**Test Scenarios:**
1. **Service worker video detection and classification**
2. **Multiple videos simultaneously without race conditions**
3. **Parallel downloads of 5+ videos with proper parallelism**
4. **Popup retrieves and displays videos**
5. **URL deduplication with query parameters**
6. **Clear all videos from storage**
7. **Content script DOM scanning**
8. **Complete pipeline cycle in <60 seconds**
9. **All message types handled correctly**
10. **Error handling for invalid messages**
11. **Accurate video type detection for all formats**
12. **Popup filtering and sorting functionality**

**Coverage:** Tests complete integration flow

### 11. Simple Video Download (20 tests)
**File:** `__tests__/simple-video-download.test.js`

Tests direct download of non-streaming video files.

**Key Functions Tested:**
- `downloadSimpleVideo(url, onProgress)` - From download-manager.js
- Handles MP4, WebM, MOV, FLV formats
- 3-retry exponential backoff
- Progress reporting
- Content-Type validation

**Test Categories:**
- **Direct Download**: MP4, WebM, MOV, FLV formats
- **MIME Validation**: Requires video/* content type
- **Resume Support**: Accept-Ranges header detection
- **Progress Reporting**: {current, total, percent} format
- **Retry Logic**: 3 retries with 1s, 2s, 4s delays
- **Error Handling**: HTTP errors, network timeouts
- **Content-Length**: Handling present and missing header

**Coverage:** 83.34% lines, 83.84% lines

## Fixtures Guide

Test data is stored in `__tests__/fixtures/`. These are real media file metadata examples.

### HLS Playlists (M3U8)

**simple.m3u8** - Basic HLS playlist with 3 segments
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:9.9,
segment-0.ts
...
#EXT-X-ENDLIST
```
Use for: Simple parsing tests, segment extraction

**variants.m3u8** - Multiple quality variants (720p, 1080p)
```
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
video-1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
video-720p.m3u8
...
```
Use for: Variant selection tests, quality ranking

**encrypted.m3u8** - Encryption metadata
```
#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/key"
```
Use for: Encryption detection tests

**relative-urls.m3u8** - Relative path resolution
```
segment-0.ts  → resolves to https://example.com/stream/segment-0.ts
./sub/segment.ts → resolves to https://example.com/stream/sub/segment.ts
```
Use for: URL resolution and deduplication tests

**with-duration.m3u8** - Segment duration metadata
```
#EXT-X-TARGETDURATION:10
#EXTINF:9.9,
segment-0.ts
```
Use for: Duration parsing and timing tests

**malformed.m3u8** - Invalid syntax
```
INVALID CONTENT
Missing headers or incorrect format
```
Use for: Error handling and robustness tests

### DASH Manifests (MPD)

**sample.mpd** - Standard DASH manifest
```xml
<?xml version="1.0" encoding="UTF-8"?>
<MPD>
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="1" width="1920" height="1080" bandwidth="5000000">
        <BaseURL>video.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
```
Use for: DASH parsing, representation selection, segment generation

## Mocks Patterns

### Jest Setup (`__tests__/jest.setup.js`)

Provides global mocks for browser/Chrome APIs:

```javascript
global.chrome = {
  runtime: { sendMessage, onMessage.addListener },
  storage: { local: { get, set, remove, clear } },
  downloads: { download },
  webRequest: { onBeforeRequest.addListener },
  tabs: { query, sendMessage }
}
global.fetch = jest.fn()
global.confirm = jest.fn(() => true)
global.alert = jest.fn()
global.TextEncoder/TextDecoder = polyfilled
global.DOMParser = jsdom.window.DOMParser
```

### Chrome API Mock Factory (`__tests__/mocks/chrome-api.js`)

Provides `createChromeMock()` factory for creating isolated chrome mocks:

```javascript
import createChromeMock from '__tests__/mocks/chrome-api.js'

const mockChrome = createChromeMock()
// Each call to storage.get/set returns mock data
```

**Pattern in tests:**
```javascript
beforeEach(() => {
  global.chrome = createChromeMock()
  // Reset mocks for test isolation
})
```

### FFmpeg Mock (`__tests__/mocks/ffmpeg.mock.js`)

Simulates FFmpeg.wasm with virtual file system:

```javascript
class FFmpegMock {
  constructor() {
    this.fileSystem = new Map()  // Virtual FS
  }

  writeFile(path, data) {
    this.fileSystem.set(path, data)
  }

  readFile(path) {
    return this.fileSystem.get(path)
  }

  run(...args) {
    // Simulates FFmpeg command execution
  }
}
```

**Pattern in tests:**
```javascript
jest.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    load = jest.fn()
    writeFile = jest.fn()
    exec = jest.fn()
    readFile = jest.fn()
  }
}))
```

### Mocking Storage Data

**Pattern for persistent mock storage:**
```javascript
let mockStorageData = {}

beforeEach(() => {
  mockStorageData = {}
  global.chrome.storage.local.get.mockImplementation((keys, callback) => {
    if (!keys) {
      callback({ ...mockStorageData })
    } else if (Array.isArray(keys)) {
      const result = {}
      keys.forEach(k => {
        if (k in mockStorageData) result[k] = mockStorageData[k]
      })
      callback(result)
    }
  })

  global.chrome.storage.local.set.mockImplementation((items, callback) => {
    Object.assign(mockStorageData, items)
    if (callback) callback()
  })
})
```

### Mocking Fetch Responses

**Pattern for HTTP response simulation:**
```javascript
const mockFetch = jest.fn((url) => {
  if (url.includes('.m3u8')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { 'content-type': 'application/vnd.apple.mpegurl' },
      text: () => Promise.resolve('#EXTM3U\n...')
    })
  }
  throw new Error('Not found')
})

global.fetch = mockFetch
```

## Debugging Tips

### Show Verbose Output
```bash
npm test -- --verbose
# Shows each test name as it runs
```

### Run Single Test
```bash
npx jest __tests__/media-extensions.test.js -t "should detect HLS URLs"
```

### Skip Tests
```javascript
describe.skip('Feature', () => {
  test('disabled test', () => {})
})

test.skip('disabled test', () => {})
```

### Focus on Tests
```javascript
describe.only('Feature', () => {
  test('only this runs', () => {})
})

test.only('only this runs', () => {})
```

### Check Uncovered Lines
```bash
npm run test:coverage
# Open coverage/lcov-report/index.html
# Click on a file to see which lines aren't covered
```

### Debug with Node Inspector
```bash
node --inspect-brk node_modules/.bin/jest __tests__/media-extensions.test.js --runInBand
```

Then:
1. Open `chrome://inspect` in Chrome
2. Click "Inspect" on the jest process
3. Use Chrome DevTools debugger (F10 to step, F5 to continue)
4. Set breakpoints in code

### Print Debug Info
```javascript
test('debug example', () => {
  const result = someFunction()
  console.log('Result:', result)
  console.log('Type:', typeof result)
  console.log('Keys:', Object.keys(result))

  expect(result).toEqual({...})
})
```

Then run:
```bash
npm test -- --verbose 2>&1 | grep "Result:"
```

### Check What Tests Ran
```bash
npm test -- --listTests
```

### Update Snapshots
```bash
npm test -- --updateSnapshot
# Use when you intentionally change expected output
```

## Example Test Case Structure

### Basic Unit Test

```javascript
import { isMediaURL } from '../src/utils/media-extensions'

describe('Media Extensions - URL Detection', () => {
  describe('isMediaURL', () => {
    test('should detect HLS URLs', () => {
      // ARRANGE: Set up test data
      const url = 'https://example.com/stream.m3u8'

      // ACT: Call the function
      const result = isMediaURL(url)

      // ASSERT: Verify the result
      expect(result).toBe(true)
    })

    test('should reject non-media URLs', () => {
      const url = 'https://example.com/index.html'
      const result = isMediaURL(url)
      expect(result).toBe(false)
    })

    test('should handle null input gracefully', () => {
      const result = isMediaURL(null)
      expect(result).toBe(false)
    })
  })
})
```

### Test with Mock Data

```javascript
import { downloadBlob } from '../src/utils/download-manager'

describe('Download Manager', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()
    global.chrome.downloads.download.mockClear()
  })

  test('should download blob with correct filename', async () => {
    // ARRANGE
    const mockBlob = new Blob(['test data'], { type: 'video/mp4' })
    const filename = 'video_20260317_1080p.mp4'

    // Mock successful download
    global.chrome.downloads.download.mockImplementation((options, callback) => {
      callback(1)  // Return download ID
      return 1
    })

    // ACT
    const downloadId = await downloadBlob(mockBlob, filename)

    // ASSERT
    expect(downloadId).toBe(1)
    expect(global.chrome.downloads.download).toHaveBeenCalled()
    expect(global.chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({ filename }),
      expect.any(Function)
    )
  })
})
```

### Test with Service Worker Integration

```javascript
import { handleMessage } from '../src/background/service-worker'

describe('Service Worker - Message Handling', () => {
  let mockStorageData = {}

  beforeEach(() => {
    mockStorageData = {}

    // Mock storage.local
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ ...mockStorageData })
    })

    global.chrome.storage.local.set.mockImplementation((items, callback) => {
      Object.assign(mockStorageData, items)
      if (callback) callback()
    })
  })

  test('should handle GET_VIDEOS message', async () => {
    // ARRANGE
    const message = { type: 'GET_VIDEOS' }
    const sender = { tab: { id: 1 } }

    // Pre-populate storage
    mockStorageData.videos = [
      { url: 'https://example.com/video.mp4', type: 'video' }
    ]

    // ACT
    const response = await handleMessage(message, sender)

    // ASSERT
    expect(response.success).toBe(true)
    expect(response.videos).toHaveLength(1)
    expect(response.videos[0].url).toContain('video.mp4')
  })
})
```

### Async Test with Callbacks

```javascript
test('should report download progress', async () => {
  // ARRANGE
  const progressUpdates = []
  const onProgress = (percent) => {
    progressUpdates.push(percent)
  }

  // Mock fetch with streamed response
  global.fetch.mockImplementation(() => Promise.resolve({
    ok: true,
    headers: { 'content-length': '1000' },
    body: {
      getReader: () => ({
        read: jest.fn()
          .mockResolvedValueOnce({ value: new Uint8Array(250) })
          .mockResolvedValueOnce({ value: new Uint8Array(250) })
          .mockResolvedValueOnce({ value: new Uint8Array(250) })
          .mockResolvedValueOnce({ value: new Uint8Array(250) })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn()
      })
    }
  }))

  // ACT
  await downloadSimpleVideo('https://example.com/video.mp4', onProgress)

  // ASSERT
  expect(progressUpdates).toContain(25)  // 25%, 50%, 75%
  expect(progressUpdates).toContain(50)
  expect(progressUpdates).toContain(75)
  expect(progressUpdates[progressUpdates.length - 1]).toBe(100)
})
```

### Error Handling Test

```javascript
test('should retry on network failure', async () => {
  // ARRANGE
  let attempts = 0
  global.fetch.mockImplementation(() => {
    attempts++
    if (attempts < 3) {
      return Promise.reject(new Error('Network error'))
    }
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)) })
  })

  // ACT & ASSERT
  const result = await downloadSimpleVideo('https://example.com/video.mp4')

  expect(attempts).toBe(3)  // Should retry twice before succeeding
  expect(result).toBeDefined()
})
```

## Coverage Report

Run `npm run test:coverage` to see detailed coverage:

**Current Global Coverage (430 tests):**
- **Statements:** 86.36% (target: 80%) ✓
- **Branches:** 77.64% (target: 75%) ✓
- **Functions:** 86.59% (target: 80%) ✓
- **Lines:** 86.72% (target: 80%) ✓

**File-by-File Coverage:**
- `media-extensions.js`: 96.42% lines, 95.45% branches
- `fragment-downloader.js`: 100% lines, 81.25% branches
- `download-manager.js`: 93.18% lines, 81.63% branches
- `content-script.js`: 88.73% lines, 75% branches
- `hls-parser.js`: 85.55% lines, 76.37% branches
- `service-worker.js`: 85.18% lines, 82.6% branches
- `popup.js`: 84.66% lines, 68.29% branches
- `dash-parser.js`: 83.63% lines, 76.85% branches
- `ffmpeg-concatenator.js`: 80.17% lines, 78.57% branches

## Writing New Tests

### Before You Start

1. **Read existing tests** in the same module for patterns
2. **Understand the function** behavior and edge cases
3. **Check fixtures** for relevant test data

### Test Writing Checklist

- [ ] Test normal/happy path cases
- [ ] Test edge cases (empty input, null, undefined)
- [ ] Test error cases (network errors, invalid data)
- [ ] Test boundary conditions
- [ ] Mock external dependencies
- [ ] Reset mocks between tests
- [ ] Use descriptive test names
- [ ] Follow Arrange-Act-Assert structure
- [ ] Keep tests focused (one assertion per test is ideal)
- [ ] Verify coverage is >80% lines and >75% branches

### Common Mistakes to Avoid

- ❌ Not resetting mocks in `beforeEach`
- ❌ Testing implementation details instead of behavior
- ❌ Forgetting to mock chrome APIs
- ❌ Not handling promises correctly (missing `await`)
- ❌ Using hardcoded timestamps (use fixed dates)
- ❌ Tests that depend on each other (use `beforeEach`)

## Continuous Integration

Tests are run automatically by the build system on:
- **Push to any branch**: Run `npm test`
- **Pull requests**: Run `npm test` + `npm run lint`
- **Failed tests**: Blocks merge until fixed
- **Coverage drop**: Warning if coverage decreases

To verify locally before pushing:
```bash
npm run lint
npm test
npm run test:coverage
```

## Reference

- [Jest Documentation](https://jestjs.io/)
- [CLAUDE.md](CLAUDE.md) - Project setup and commands
- [README.md](README.md) - Project overview
