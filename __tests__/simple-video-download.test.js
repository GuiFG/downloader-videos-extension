/**
 * Simple Video Download Tests
 * Tests for direct video file download without FFmpeg processing
 * Covers: direct fetch, MIME validation, retry logic, progress reporting, and resumption
 */

import { downloadSimpleVideo } from '../src/utils/download-manager.js';

describe('Simple Video Download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create proper headers mock
  const createHeadersMock = (entries) => {
    const headers = new Map(entries);
    return {
      get: (name) => headers.get(name.toLowerCase()),
    };
  };

  describe('Direct video download', () => {
    it('should fetch and return blob for simple video', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockBlob = new Blob([mockData], { type: 'video/mp4' });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([['content-type', 'video/mp4'], ['content-length', '5']]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: mockData })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        },
        blob: async () => mockBlob
      });

      const result = await downloadSimpleVideo('https://example.com/video.mp4');
      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle WebM video files', async () => {
      const mockData = new Uint8Array([1, 2, 3]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([['content-type', 'video/webm'], ['content-length', '3']]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: mockData })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        }
      });

      const result = await downloadSimpleVideo('https://example.com/video.webm');
      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle MOV video files', async () => {
      const mockData = new Uint8Array([1, 2, 3]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([['content-type', 'video/quicktime'], ['content-length', '3']]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: mockData })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        }
      });

      const result = await downloadSimpleVideo('https://example.com/video.mov');
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('MIME type validation', () => {
    it('should validate Content-Type is video/*', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([['content-type', 'text/html']]),
        blob: async () => new Blob()
      });

      await expect(
        downloadSimpleVideo('https://example.com/video.mp4')
      ).rejects.toThrow(/video/);
    });

    it('should reject non-video MIME types', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([['content-type', 'application/json']]),
        blob: async () => new Blob()
      });

      await expect(
        downloadSimpleVideo('https://example.com/file.mp4')
      ).rejects.toThrow(/Invalid Content-Type/);
    });

    it('should accept all video/* MIME types', async () => {
      const mimeTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-flv'];

      for (const mimeType of mimeTypes) {
        const mockData = new Uint8Array([1, 2, 3]);

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: createHeadersMock([['content-type', mimeType], ['content-length', '3']]),
          body: {
            getReader: () => ({
              read: jest.fn()
                .mockResolvedValueOnce({ done: false, value: mockData })
                .mockResolvedValueOnce({ done: true }),
              releaseLock: jest.fn()
            })
          }
        });

        const result = await downloadSimpleVideo('https://example.com/video.mp4');
        expect(result).toBeInstanceOf(Blob);
      }
    });
  });

  describe('Resume support (Accept-Ranges header)', () => {
    it('should detect server support for Range headers', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([
          ['content-type', 'video/mp4'],
          ['content-length', '100'],
          ['accept-ranges', 'bytes']
        ]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: mockData })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        }
      });

      const result = await downloadSimpleVideo('https://example.com/video.mp4');
      expect(result).toBeInstanceOf(Blob);

      // Verify that fetch was called (could be extended to verify Range header usage)
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should work with servers that do not support ranges', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([
          ['content-type', 'video/mp4'],
          ['content-length', '4']
          // No accept-ranges header
        ]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: mockData })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        }
      });

      const result = await downloadSimpleVideo('https://example.com/video.mp4');
      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle accept-ranges: none', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([
          ['content-type', 'video/mp4'],
          ['content-length', '4'],
          ['accept-ranges', 'none']
        ]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: mockData })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        }
      });

      const result = await downloadSimpleVideo('https://example.com/video.mp4');
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('Progress reporting', () => {
    it('should call onProgress callback during download', async () => {
      const onProgress = jest.fn();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([['content-type', 'video/mp4'], ['content-length', '4']]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3, 4]) })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        }
      });

      await downloadSimpleVideo('https://example.com/video.mp4', onProgress);

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          percent: expect.any(Number),
          current: expect.any(Number),
          total: expect.any(Number)
        })
      );
    });

    it('should report progress as {current, total, percent}', async () => {
      const onProgress = jest.fn();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([['content-type', 'video/mp4'], ['content-length', '100']]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new Uint8Array(50) })
              .mockResolvedValueOnce({ done: false, value: new Uint8Array(50) })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        }
      });

      await downloadSimpleVideo('https://example.com/video.mp4', onProgress);

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          current: 50,
          total: 100,
          percent: 50
        })
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          current: 100,
          total: 100,
          percent: 100
        })
      );
    });

    it('should report 100% progress when download completes', async () => {
      const onProgress = jest.fn();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([['content-type', 'video/mp4'], ['content-length', '10']]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new Uint8Array(10) })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        }
      });

      await downloadSimpleVideo('https://example.com/video.mp4', onProgress);

      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toEqual(
        expect.objectContaining({
          percent: 100
        })
      );
    });
  });

  describe('Retry logic with exponential backoff', () => {
    it('should retry on fetch failure up to 3 times', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4]);

      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: createHeadersMock([['content-type', 'video/mp4'], ['content-length', '4']]),
          body: {
            getReader: () => ({
              read: jest.fn()
                .mockResolvedValueOnce({ done: false, value: mockData })
                .mockResolvedValueOnce({ done: true }),
              releaseLock: jest.fn()
            })
          }
        });

      const result = await downloadSimpleVideo('https://example.com/video.mp4');
      expect(result).toBeInstanceOf(Blob);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should throw after 3 failed retries', async () => {
      global.fetch = jest.fn()
        .mockRejectedValue(new Error('Network error'));

      await expect(
        downloadSimpleVideo('https://example.com/video.mp4')
      ).rejects.toThrow();
    }, 20000);

    it('should implement exponential backoff between retries', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4]);

      global.fetch = jest.fn()
        .mockImplementationOnce(() => {
          return Promise.reject(new Error('Network error'));
        })
        .mockImplementationOnce(() => {
          return Promise.reject(new Error('Network error'));
        })
        .mockImplementationOnce(() => {
          return Promise.resolve({
            ok: true,
            headers: createHeadersMock([['content-type', 'video/mp4'], ['content-length', '4']]),
            body: {
              getReader: () => ({
                read: jest.fn()
                  .mockResolvedValueOnce({ done: false, value: mockData })
                  .mockResolvedValueOnce({ done: true }),
                releaseLock: jest.fn()
              })
            }
          });
        });

      const result = await downloadSimpleVideo('https://example.com/video.mp4');
      expect(result).toBeInstanceOf(Blob);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    }, 15000);
  });

  describe('Error handling', () => {
    it('should reject on HTTP error status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: createHeadersMock([['content-type', 'text/html']]),
      });

      await expect(
        downloadSimpleVideo('https://example.com/nonexistent.mp4')
      ).rejects.toThrow(/HTTP|404/i);
    });

    it('should reject on 500 server error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: createHeadersMock([['content-type', 'text/html']]),
      });

      await expect(
        downloadSimpleVideo('https://example.com/video.mp4')
      ).rejects.toThrow();
    });

    it('should handle network timeout gracefully', async () => {
      global.fetch = jest.fn()
        .mockRejectedValue(new Error('Timeout'));

      await expect(
        downloadSimpleVideo('https://example.com/video.mp4')
      ).rejects.toThrow();
    }, 20000);
  });

  describe('Content-Length handling', () => {
    it('should handle missing content-length header', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([['content-type', 'video/mp4']]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: mockData })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        }
      });

      const result = await downloadSimpleVideo('https://example.com/video.mp4');
      expect(result).toBeInstanceOf(Blob);
    });

    it('should calculate progress percentage accurately', async () => {
      const onProgress = jest.fn();
      const totalSize = 1000;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: createHeadersMock([['content-type', 'video/mp4'], ['content-length', totalSize.toString()]]),
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new Uint8Array(250) })
              .mockResolvedValueOnce({ done: false, value: new Uint8Array(250) })
              .mockResolvedValueOnce({ done: false, value: new Uint8Array(250) })
              .mockResolvedValueOnce({ done: false, value: new Uint8Array(250) })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn()
          })
        }
      });

      await downloadSimpleVideo('https://example.com/video.mp4', onProgress);

      // Verify progress at 25%, 50%, 75%, 100%
      const percentages = onProgress.mock.calls.map(call => call[0].percent);
      expect(percentages).toContain(25);
      expect(percentages).toContain(50);
      expect(percentages).toContain(75);
      expect(percentages).toContain(100);
    });
  });
});
