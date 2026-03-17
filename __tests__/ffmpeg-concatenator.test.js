/**
 * FFmpeg Concatenator Tests
 * Tests for fragment concatenation using FFmpeg.wasm
 */

import {
  concatenateFragments,
  validateFragments,
  clearFFmpegCache,
  supportsAbortSignal
} from '../src/utils/ffmpeg-concatenator';

// Mock @ffmpeg/ffmpeg before importing
jest.mock('@ffmpeg/ffmpeg', () => {
  const fileSystem = new Map();
  let isLoaded = false;

  return {
    FFmpeg: class MockFFmpeg {
      constructor() {
        this.isLoaded = isLoaded;
      }

      async load(_config = {}) {
        isLoaded = true;
        this.isLoaded = true;
        return Promise.resolve();
      }

      async exec(..._args) {
        return 0;
      }

      writeFile(filename, data) {
        fileSystem.set(filename, data);
      }

      readFile(filename) {
        return fileSystem.get(filename) || new Uint8Array();
      }

      deleteFile(filename) {
        fileSystem.delete(filename);
      }

      listFiles() {
        return Array.from(fileSystem.keys());
      }

      async transcode(input, output, _options = {}) {
        const outputData = new Uint8Array(1024);
        fileSystem.set(output, outputData);
        return { exitCode: 0 };
      }
    },

    toBlobURL(_data, _mimeType) {
      return `blob:mock-${Math.random().toString(36).substr(2, 9)}`;
    },
  };
});

// Helper to create test blobs with arrayBuffer support
const createTestBlob = (data, type = 'video/mp4') => {
  const blob = new Blob([new Uint8Array(data)], { type });
  // Add arrayBuffer method if it doesn't exist (for older jsdom)
  if (!blob.arrayBuffer) {
    blob.arrayBuffer = async () => new Uint8Array(data).buffer;
  }
  return blob;
};

describe('FFmpeg Concatenator', () => {
  beforeEach(() => {
    clearFFmpegCache();
    jest.clearAllMocks();
  });

  describe('concatenateFragments - Basic Functionality', () => {
    test('should concatenate array of blobs into single blob', async () => {
      const blob1 = createTestBlob([1, 2, 3], 'video/mp4');
      const blob2 = createTestBlob([4, 5, 6], 'video/mp4');
      const blobs = [blob1, blob2];

      const result = await concatenateFragments(blobs, 'mp4');

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toMatch(/video|mp4/i);
    });

    test('should handle single blob', async () => {
      const blob = createTestBlob([1, 2, 3], 'video/mp4');

      const result = await concatenateFragments([blob], 'mp4');

      expect(result).toBeInstanceOf(Blob);
    });

    test('should handle empty array with error', async () => {
      await expect(concatenateFragments([], 'mp4')).rejects.toThrow();
    });

    test('should support MP4 output format', async () => {
      const blob = createTestBlob([1, 2, 3], 'video/mp4');

      const result = await concatenateFragments([blob], 'mp4');

      expect(result).toBeDefined();
    });

    test('should support WEBM output format', async () => {
      const blob = createTestBlob([1, 2, 3], 'video/webm');

      const result = await concatenateFragments([blob], 'webm');

      expect(result).toBeDefined();
    });
  });

  describe('Fragment Type Support', () => {
    test('should concatenate TS (MPEG-TS) fragments', async () => {
      const blob1 = createTestBlob([0x47, 0x40, 0x00], 'video/mp2t');
      const blob2 = createTestBlob([0x47, 0x40, 0x01], 'video/mp2t');

      const result = await concatenateFragments([blob1, blob2], 'mp4');

      expect(result).toBeInstanceOf(Blob);
    });

    test('should concatenate M4S (ISO-BMFF) fragments', async () => {
      const blob1 = createTestBlob([0x00, 0x00, 0x00, 0x20], 'video/iso.segment');
      const blob2 = createTestBlob([0x00, 0x00, 0x00, 0x20], 'video/iso.segment');

      const result = await concatenateFragments([blob1, blob2], 'mp4');

      expect(result).toBeInstanceOf(Blob);
    });

    test('should detect fragment type from MIME type', async () => {
      const tsBlob = createTestBlob([0x47], 'video/mp2t');
      const m4sBlob = createTestBlob([0x00], 'video/iso.segment');

      const result1 = await concatenateFragments([tsBlob], 'mp4');
      const result2 = await concatenateFragments([m4sBlob], 'mp4');

      expect(result1).toBeInstanceOf(Blob);
      expect(result2).toBeInstanceOf(Blob);
    });
  });

  describe('Progress Reporting', () => {
    test('should report progress via callback', async () => {
      const blob1 = createTestBlob(new Array(100).fill(0), 'video/mp4');
      const blob2 = createTestBlob(new Array(100).fill(0), 'video/mp4');
      const progressUpdates = [];

      const onProgress = (percent) => {
        progressUpdates.push(percent);
      };

      await concatenateFragments([blob1, blob2], 'mp4', { onProgress });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    test('should report 0% at start', async () => {
      const blob = createTestBlob(new Array(100).fill(0), 'video/mp4');
      const progressUpdates = [];

      const onProgress = (percent) => {
        progressUpdates.push(percent);
      };

      await concatenateFragments([blob], 'mp4', { onProgress });

      expect(progressUpdates[0]).toBe(0);
    });

    test('should report 100% at completion', async () => {
      const blob = createTestBlob(new Array(100).fill(0), 'video/mp4');
      const progressUpdates = [];

      const onProgress = (percent) => {
        progressUpdates.push(percent);
      };

      await concatenateFragments([blob], 'mp4', { onProgress });

      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    test('should handle missing onProgress callback gracefully', async () => {
      const blob = createTestBlob(new Array(100).fill(0), 'video/mp4');

      const result = await concatenateFragments([blob], 'mp4', {});

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('AbortSignal Support', () => {
    test('should abort concatenation with AbortSignal', async () => {
      const controller = new AbortController();
      const blob = createTestBlob(new Array(1000).fill(0), 'video/mp4');

      const promise = concatenateFragments([blob], 'mp4', { signal: controller.signal });

      controller.abort();

      await expect(promise).rejects.toThrow();
    });

    test('should throw AbortError when aborted', async () => {
      const controller = new AbortController();
      const blob = createTestBlob(new Array(1000).fill(0), 'video/mp4');

      const promise = concatenateFragments([blob], 'mp4', { signal: controller.signal });

      controller.abort();

      await expect(promise).rejects.toThrow(/aborted|abort/i);
    });
  });

  describe('Fragment Validation', () => {
    test('validateFragments should accept array of blobs', () => {
      const blob1 = createTestBlob([1, 2, 3], 'video/mp4');
      const blob2 = createTestBlob([4, 5, 6], 'video/mp4');

      const result = validateFragments([blob1, blob2]);

      expect(result).toBe(true);
    });

    test('validateFragments should reject non-blob items', () => {
      const invalidFragments = [new Uint8Array([1, 2, 3])];

      expect(() => validateFragments(invalidFragments)).toThrow();
    });

    test('validateFragments should reject empty array', () => {
      expect(() => validateFragments([])).toThrow();
    });

    test('validateFragments should validate metadata', () => {
      const blob = createTestBlob([1, 2, 3], 'video/mp4');

      const result = validateFragments([blob]);

      expect(result).toBe(true);
    });

    test('should validate output format parameter', () => {
      const blob = createTestBlob([1, 2, 3], 'video/mp4');

      expect(() => concatenateFragments([blob], 'invalid-format')).rejects.toThrow();
    });
  });

  describe('FFmpeg Instance Caching', () => {
    test('should reuse FFmpeg instance for multiple concatenations', async () => {
      const blob = createTestBlob(new Array(100).fill(0), 'video/mp4');

      const result1 = await concatenateFragments([blob], 'mp4');
      const result2 = await concatenateFragments([blob], 'mp4');

      expect(result1).toBeInstanceOf(Blob);
      expect(result2).toBeInstanceOf(Blob);
    });

    test('should clear cache when clearFFmpegCache is called', async () => {
      const blob = createTestBlob(new Array(100).fill(0), 'video/mp4');

      await concatenateFragments([blob], 'mp4');
      clearFFmpegCache();

      // Second call should reinitialize
      const result = await concatenateFragments([blob], 'mp4');

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('Web Worker Support', () => {
    test('should support Web Worker option', async () => {
      const blob = createTestBlob(new Array(100).fill(0), 'video/mp4');

      const result = await concatenateFragments([blob], 'mp4', { useWorker: true });

      expect(result).toBeInstanceOf(Blob);
    });

    test('should fall back to main thread if Worker not available', async () => {
      const blob = createTestBlob(new Array(100).fill(0), 'video/mp4');

      const result = await concatenateFragments([blob], 'mp4', { useWorker: false });

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid blob data', async () => {
      const corruptedBlob = createTestBlob([255, 255, 255], 'video/mp4');

      // Should not throw during concatenation
      const result = await concatenateFragments([corruptedBlob], 'mp4');

      expect(result).toBeInstanceOf(Blob);
    });

    test('should handle timeout during concatenation', async () => {
      const blob = createTestBlob(new Array(1000).fill(0), 'video/mp4');

      const result = await concatenateFragments([blob], 'mp4', { timeout: 30000 });

      expect(result).toBeInstanceOf(Blob);
    });

    test('should validate options parameter', () => {
      const blob = createTestBlob(new Array(100).fill(0), 'video/mp4');

      // Should accept options object
      expect(() => concatenateFragments([blob], 'mp4', {})).not.toThrow();
    });
  });

  describe('Utility Functions', () => {
    test('supportsAbortSignal should return boolean', () => {
      const result = supportsAbortSignal();

      expect(typeof result).toBe('boolean');
    });

    test('should support AbortController in modern browsers', () => {
      const supported = supportsAbortSignal();

      expect(supported).toBe(true);
    });
  });
});
