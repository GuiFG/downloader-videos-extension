/**
 * Download Manager Tests
 * Tests for download functionality, filename generation, and directory management
 */

import {
  downloadBlob,
  generateFilename,
  sanitizeFilename,
  setDownloadDirectory,
  getDownloadDirectory,
  createDownloadStatus,
  downloadSimpleVideo,
} from '../src/utils/download-manager.js';

describe('Download Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters from filename', () => {
      const dirty = 'video<>:|.mp4';
      const result = sanitizeFilename(dirty);
      expect(result).not.toMatch(/[<>:"|\\/?*]/);
    });

    it('should remove multiple invalid chars', () => {
      const dirty = 'video?*<>file.mp4';
      const result = sanitizeFilename(dirty);
      expect(result).toBe('videofile.mp4');
    });

    it('should preserve valid characters', () => {
      const clean = 'my-video_2025.mp4';
      expect(sanitizeFilename(clean)).toBe(clean);
    });

    it('should handle leading/trailing spaces', () => {
      const dirty = '  video.mp4  ';
      const result = sanitizeFilename(dirty);
      expect(result).toBe('video.mp4');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with format video_YYYYMMDD_quality.ext', () => {
      const date = new Date('2026-03-17');
      jest.spyOn(Date, 'now').mockReturnValue(date.getTime());

      const filename = generateFilename('https://example.com/video.m3u8', 'hls', '1080p');
      expect(filename).toMatch(/^video_\d{8}_1080p\.mp4$/);
    });

    it('should extract base name from URL', () => {
      const filename = generateFilename('https://example.com/path/myshow.m3u8', 'hls');
      expect(filename).toMatch(/^video_\d{8}_\d+p\.mp4$/);
    });

    it('should use default extension for HLS', () => {
      const filename = generateFilename('https://example.com/stream.m3u8', 'hls');
      expect(filename).toMatch(/\.mp4$/);
    });

    it('should use default extension for DASH', () => {
      const filename = generateFilename('https://example.com/stream.mpd', 'dash');
      expect(filename).toMatch(/\.mp4$/);
    });

    it('should keep original extension for simple video', () => {
      const filename = generateFilename('https://example.com/video.webm', 'simple');
      expect(filename).toMatch(/\.webm$/);
    });

    it('should handle URLs without extension', () => {
      const filename = generateFilename('https://example.com/stream', 'hls');
      expect(filename).toMatch(/\.mp4$/);
    });

    it('should sanitize generated filename', () => {
      // Mock a URL that might produce invalid chars after processing
      const filename = generateFilename('https://example.com/my?video.m3u8', 'hls');
      expect(filename).not.toMatch(/[<>:"|\\/?*]/);
    });
  });

  describe('createDownloadStatus', () => {
    it('should create status object with required fields', () => {
      const status = createDownloadStatus('dl-123', 'video.mp4');
      expect(status).toHaveProperty('downloadId', 'dl-123');
      expect(status).toHaveProperty('filename', 'video.mp4');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('timestamp');
    });

    it('should initialize with pending status', () => {
      const status = createDownloadStatus('dl-123', 'video.mp4');
      expect(status.status).toBe('pending');
    });

    it('should initialize progress to 0', () => {
      const status = createDownloadStatus('dl-123', 'video.mp4');
      expect(status.progress).toBe(0);
    });

    it('should set timestamp to current time', () => {
      const beforeTime = Date.now();
      const status = createDownloadStatus('dl-123', 'video.mp4');
      const afterTime = Date.now();
      expect(status.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(status.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('setDownloadDirectory', () => {
    it('should store directory path in chrome.storage.local', async () => {
      const mockSet = jest.fn((items, callback) => {
        if (callback) callback();
      });
      global.chrome.storage.local.set = mockSet;

      await setDownloadDirectory('/home/user/Downloads');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          downloadDirectory: '/home/user/Downloads'
        }),
        expect.any(Function)
      );
    });

    it('should resolve promise when storage is set', async () => {
      global.chrome.storage.local.set = jest.fn((items, callback) => {
        if (callback) callback();
      });

      await expect(setDownloadDirectory('/path')).resolves.toBeUndefined();
    });
  });

  describe('getDownloadDirectory', () => {
    it('should retrieve directory from chrome.storage.local', async () => {
      const mockGet = jest.fn((keys, callback) => {
        callback({ downloadDirectory: '/home/user/Downloads' });
      });
      global.chrome.storage.local.get = mockGet;

      const dir = await getDownloadDirectory();

      expect(mockGet).toHaveBeenCalledWith('downloadDirectory', expect.any(Function));
      expect(dir).toBe('/home/user/Downloads');
    });

    it('should return default downloads folder if not set', async () => {
      global.chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({});
      });

      const dir = await getDownloadDirectory();

      expect(dir).toBeDefined();
      expect(typeof dir).toBe('string');
    });
  });

  describe('downloadBlob', () => {
    it('should download blob with given filename', async () => {
      const mockDownload = jest.fn((options, callback) => {
        if (callback) callback(1);
        return 1;
      });
      global.chrome.downloads.download = mockDownload;

      const blob = new Blob(['test'], { type: 'video/mp4' });
      const downloadId = await downloadBlob(blob, 'video.mp4');

      expect(mockDownload).toHaveBeenCalled();
      expect(downloadId).toBe(1);
    });

    it('should accept options parameter', async () => {
      const mockDownload = jest.fn((options, callback) => {
        if (callback) callback(2);
        return 2;
      });
      global.chrome.downloads.download = mockDownload;

      const blob = new Blob(['test'], { type: 'video/mp4' });
      await downloadBlob(blob, 'video.mp4', { saveAs: true });

      expect(mockDownload).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'video.mp4',
          saveAs: true
        }),
        expect.any(Function)
      );
    });

    it('should return download ID', async () => {
      global.chrome.downloads.download = jest.fn((options, callback) => {
        if (callback) callback(42);
        return 42;
      });

      const blob = new Blob(['test'], { type: 'video/mp4' });
      const downloadId = await downloadBlob(blob, 'video.mp4');

      expect(downloadId).toBe(42);
    });

    it('should handle filename conflicts by adding (1), (2), etc', async () => {
      const mockDownload = jest.fn((options, callback) => {
        // Simulate Chrome detecting conflict and suggesting new name
        if (callback) callback(1);
        return 1;
      });
      global.chrome.downloads.download = mockDownload;

      const blob = new Blob(['test'], { type: 'video/mp4' });
      const downloadId = await downloadBlob(blob, 'video (1).mp4');

      expect(downloadId).toBe(1);
    });
  });

  describe('downloadSimpleVideo', () => {
    // Helper to create proper headers mock
    const createHeadersMock = (entries) => {
      const headers = new Map(entries);
      return {
        get: (name) => headers.get(name.toLowerCase()),
      };
    };

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
          percent: expect.any(Number)
        })
      );
    });

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

    it('should handle Accept-Ranges header for resumption', async () => {
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
    });
  });
});
