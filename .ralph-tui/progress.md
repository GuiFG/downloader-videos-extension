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
