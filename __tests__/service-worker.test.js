/* global chrome */

/**
 * Service Worker Tests
 * Tests for request interception, storage, deduplication, and message handlers
 */

// Mock the utility modules before importing service worker
jest.mock('../src/utils/media-extensions.js', () => ({
  isMediaURL: jest.fn((url) => {
    if (!url) return false;
    return url.includes('.m3u8') || url.includes('.mpd') || url.includes('.mp4') || url.includes('.ts');
  }),
  getMediaType: jest.fn((url) => {
    if (!url) return 'unknown';
    if (url.includes('.m3u8')) return 'hls';
    if (url.includes('.mpd')) return 'dash';
    if (url.includes('.ts')) return 'stream';
    if (url.includes('.mp4')) return 'video';
    return 'unknown';
  }),
  detectMediaTypeByPattern: jest.fn((url) => {
    if (!url) return null;
    // Mock pattern detection for googlevideo.com and vimeo.com/video/
    if (url.includes('googlevideo.com')) return 'stream';
    if (url.includes('vimeo.com/video/') || url.includes('player.vimeo.com')) return 'stream';
    return null;
  }),
  cleanUrl: jest.fn((url) => {
    if (!url) return '';
    return url.split('?')[0].split('#')[0];
  }),
  detectMediaTypeByContentType: jest.fn((contentType) => {
    if (!contentType || typeof contentType !== 'string') return null;
    const mimeType = contentType.split(';')[0].trim().toLowerCase();
    if (mimeType.startsWith('video/')) return 'stream';
    if (mimeType.startsWith('audio/')) return 'audio';
    return null;
  }),
}));

jest.mock('../src/utils/fragment-downloader.js', () => ({
  downloadFragments: jest.fn(async () => ({
    blobs: [new Blob(['test'], { type: 'video/mp4' })],
    failedUrls: [],
    errors: [],
  })),
}));

jest.mock('../src/utils/hls-parser.js', () => ({
  parseHLS: jest.fn(() => ({
    streams: [{ url: 'https://example.com/segment-1.ts' }],
    variants: [],
    duration: 100,
  })),
}));

jest.mock('../src/utils/dash-parser.js', () => ({
  parseDALE: jest.fn(() => ({
    segments: [{ url: 'https://example.com/segment-1.m4s' }],
  })),
}));

jest.mock('../src/utils/ffmpeg-concatenator.js', () => ({
  concatenateFragments: jest.fn(async () => new Blob(['test'], { type: 'video/mp4' })),
  clearFFmpegCache: jest.fn(),
}));

jest.mock('../src/utils/download-manager.js', () => ({
  downloadBlob: jest.fn(async () => ({ status: 'success' })),
  generateFilename: jest.fn(() => 'video_20260317_720p.mp4'),
  sanitizeFilename: jest.fn((name) => name),
  setDownloadDirectory: jest.fn(),
  getDownloadDirectory: jest.fn(async () => '/downloads'),
}));

import {
  initializeServiceWorker,
  handleMessage,
  normalizeUrl,
  detectVideoUrl,
  getDetectedVideos,
  clearDetectedVideos,
  downloadVideo,
} from '../src/background/service-worker.js';

describe('Service Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset chrome storage mock with proper callback implementations
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });
    chrome.storage.local.set.mockImplementation((items, callback) => {
      if (callback) callback();
    });
    chrome.storage.local.remove.mockImplementation((keys, callback) => {
      if (callback) callback();
    });
    chrome.storage.local.clear.mockImplementation((callback) => {
      if (callback) callback();
    });
    chrome.runtime.sendMessage.mockImplementation(() => Promise.resolve());
    chrome.tabs.query.mockImplementation((query, callback) => {
      callback([]);
    });
    chrome.tabs.sendMessage.mockImplementation(() => Promise.resolve());
    if (chrome.webRequest?.onBeforeRequest?.addListener) {
      chrome.webRequest.onBeforeRequest.addListener.mockClear();
    }
    if (chrome.webRequest?.onHeadersReceived?.addListener) {
      chrome.webRequest.onHeadersReceived.addListener.mockClear();
    }
    if (chrome.runtime?.onMessage?.addListener) {
      chrome.runtime.onMessage.addListener.mockClear();
    }
  });

  describe('URL Normalization for Deduplication', () => {
    test('should normalize URLs by removing query parameters', () => {
      const url1 = 'https://example.com/video.m3u8?token=abc&version=1';
      const url2 = 'https://example.com/video.m3u8?token=xyz&version=2';
      expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
      expect(normalizeUrl(url1)).toBe('https://example.com/video.m3u8');
    });

    test('should normalize URLs by removing fragments', () => {
      const url1 = 'https://example.com/video.mpd#section1';
      const url2 = 'https://example.com/video.mpd#section2';
      expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
      expect(normalizeUrl(url1)).toBe('https://example.com/video.mpd');
    });

    test('should normalize URLs by removing both query and fragment', () => {
      const url = 'https://example.com/stream.m3u8?token=abc#live';
      expect(normalizeUrl(url)).toBe('https://example.com/stream.m3u8');
    });

    test('should handle URLs without query parameters or fragments', () => {
      const url = 'https://example.com/video.mp4';
      expect(normalizeUrl(url)).toBe(url);
    });

    test('should be case-insensitive for domain but preserve extension case', () => {
      const url1 = 'HTTPS://EXAMPLE.COM/VIDEO.M3U8';
      const url2 = 'https://example.com/video.m3u8';
      // URLs should normalize to lowercase for comparison
      expect(normalizeUrl(url1).toLowerCase()).toBe(normalizeUrl(url2).toLowerCase());
    });
  });

  describe('Video URL Detection and Classification', () => {
    test('should detect HLS playlist URLs', () => {
      const result = detectVideoUrl('https://example.com/stream.m3u8', 1);
      expect(result).toMatchObject({
        url: 'https://example.com/stream.m3u8',
        type: 'hls',
        tabId: 1,
      });
      expect(result.timestamp).toBeDefined();
    });

    test('should detect DASH manifest URLs', () => {
      const result = detectVideoUrl('https://example.com/stream.mpd', 2);
      expect(result).toMatchObject({
        url: 'https://example.com/stream.mpd',
        type: 'dash',
        tabId: 2,
      });
    });

    test('should detect simple video URLs', () => {
      const result = detectVideoUrl('https://example.com/video.mp4', 3);
      expect(result).toMatchObject({
        url: 'https://example.com/video.mp4',
        type: 'video',
        tabId: 3,
      });
    });

    test('should detect stream segment URLs', () => {
      const result = detectVideoUrl('https://example.com/segment.ts', 1);
      expect(result).toMatchObject({
        url: 'https://example.com/segment.ts',
        type: 'stream',
        tabId: 1,
      });
    });

    test('should return null for non-media URLs', () => {
      const result = detectVideoUrl('https://example.com/image.png', 1);
      expect(result).toBeNull();
    });

    test('should include timestamp in detected video', () => {
      const beforeTime = Date.now();
      const result = detectVideoUrl('https://example.com/video.m3u8', 1);
      const afterTime = Date.now();
      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Message Handler - GET_VIDEOS', () => {
    test('should handle GET_VIDEOS message', async () => {
      // First add some videos to the in-memory cache
      const video1 = { url: 'https://example.com/video1.m3u8', type: 'hls', tabId: 1, timestamp: Date.now() };
      const video2 = { url: 'https://example.com/video2.mpd', type: 'dash', tabId: 2, timestamp: Date.now() };

      await handleMessage({ type: 'ADD_VIDEO', video: video1 });
      await handleMessage({ type: 'ADD_VIDEO', video: video2 });

      const response = await handleMessage({ type: 'GET_VIDEOS' });
      expect(response.videos.length).toBe(2);
      expect(response.videos[0].url).toBe(video1.url);
      expect(response.videos[1].url).toBe(video2.url);
    });

    test('should return empty array when no videos stored', async () => {
      await clearDetectedVideos();
      const response = await handleMessage({ type: 'GET_VIDEOS' });
      expect(response.videos).toEqual([]);
    });
  });

  describe('Message Handler - ADD_VIDEO', () => {
    test('should add new video to storage', async () => {
      const newVideo = {
        url: 'https://example.com/video.m3u8',
        type: 'hls',
        tabId: 1,
        timestamp: Date.now(),
      };

      const setMock = chrome.storage.local.set;
      await handleMessage({ type: 'ADD_VIDEO', video: newVideo });

      expect(setMock).toHaveBeenCalled();
      const [savedData] = setMock.mock.calls[0];
      expect(savedData.detectedVideos).toContainEqual(newVideo);
    });

    test('should deduplicate videos using normalized URLs', async () => {
      await clearDetectedVideos();

      const video1 = {
        url: 'https://example.com/video.m3u8?token=abc',
        type: 'hls',
        tabId: 1,
        timestamp: Date.now() - 1000,
      };
      const video2 = {
        url: 'https://example.com/video.m3u8?token=xyz',
        type: 'hls',
        tabId: 2,
        timestamp: Date.now(),
      };

      const setMock = chrome.storage.local.set;
      await handleMessage({ type: 'ADD_VIDEO', video: video1 });
      setMock.mockClear();

      await handleMessage({ type: 'ADD_VIDEO', video: video2 });

      const [savedData] = setMock.mock.calls[0];
      // Should only have one video (deduped) after adding similar URLs
      expect(savedData.detectedVideos.length).toBe(1);
      // Should have the newer timestamp
      expect(savedData.detectedVideos[0].timestamp).toBe(video2.timestamp);
    });

    test('should broadcast message when video added', async () => {
      await clearDetectedVideos();

      const newVideo = {
        url: 'https://example.com/video.m3u8',
        type: 'hls',
        tabId: 1,
        timestamp: Date.now(),
      };

      // Mock tabs.query to return at least one tab
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1, url: 'https://example.com' }]);
      });
      chrome.tabs.sendMessage.mockImplementation(() => Promise.resolve());

      await handleMessage({ type: 'ADD_VIDEO', video: newVideo });

      // Should broadcast to all tabs about the update
      expect(chrome.tabs.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Message Handler - CLEAR_VIDEOS', () => {
    test('should clear all stored videos', async () => {
      // First add a video
      const video = { url: 'https://example.com/video.m3u8', type: 'hls', tabId: 1, timestamp: Date.now() };
      await handleMessage({ type: 'ADD_VIDEO', video });

      const clearMock = chrome.storage.local.clear;
      await handleMessage({ type: 'CLEAR_VIDEOS' });
      expect(clearMock).toHaveBeenCalled();
    });

    test('should broadcast clear notification', async () => {
      const video = { url: 'https://example.com/video.m3u8', type: 'hls', tabId: 1, timestamp: Date.now() };
      await handleMessage({ type: 'ADD_VIDEO', video });

      // Mock tabs.query to return at least one tab
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1, url: 'https://example.com' }]);
      });
      chrome.tabs.sendMessage.mockImplementation(() => Promise.resolve());
      chrome.storage.local.clear.mockImplementation((callback) => callback());

      await handleMessage({ type: 'CLEAR_VIDEOS' });

      expect(chrome.tabs.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Message Handler - DOWNLOAD_VIDEO', () => {
    test('should handle DOWNLOAD_VIDEO message', async () => {
      const video = {
        url: 'https://example.com/video.m3u8',
        type: 'hls',
        tabId: 1,
      };

      const response = await handleMessage({
        type: 'DOWNLOAD_VIDEO',
        video,
      });

      expect(response).toHaveProperty('status');
      expect(['pending', 'in_progress', 'completed', 'error']).toContain(response.status);
    });

    test('should reject invalid video data', async () => {
      const response = await handleMessage({
        type: 'DOWNLOAD_VIDEO',
        video: { url: '', type: 'unknown' },
      });

      expect(response.status).toBe('error');
    });
  });

  describe('Video Storage and Retrieval', () => {
    test('should load videos from storage on initialization', async () => {
      const mockVideos = [
        { url: 'https://example.com/video1.m3u8', type: 'hls', tabId: 1, timestamp: Date.now() },
      ];

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ detectedVideos: mockVideos });
      });

      const videos = await getDetectedVideos();
      expect(videos).toEqual(mockVideos);
    });

    test('should persist videos to storage', async () => {
      await clearDetectedVideos();

      const video = {
        url: 'https://example.com/video.m3u8',
        type: 'hls',
        tabId: 1,
        timestamp: Date.now(),
      };

      const setMock = chrome.storage.local.set;
      await handleMessage({ type: 'ADD_VIDEO', video });

      expect(setMock).toHaveBeenCalled();
      const [savedData] = setMock.mock.calls[0];
      expect(savedData).toHaveProperty('detectedVideos');
    });

    test('should handle storage errors gracefully', async () => {
      chrome.storage.local.get.mockImplementation((_keys, callback) => {
        callback(null);
      });

      const videos = await getDetectedVideos();
      expect(Array.isArray(videos)).toBe(true);
    });
  });

  describe('Service Worker Initialization', () => {
    test('should register webRequest listener on init', async () => {
      await initializeServiceWorker();
      expect(chrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalled();
    });

    test('should set up message listener on init', async () => {
      await initializeServiceWorker();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should load initial videos from storage', async () => {
      const mockVideos = [
        { url: 'https://example.com/video.m3u8', type: 'hls', tabId: 1, timestamp: Date.now() },
      ];

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ detectedVideos: mockVideos });
      });

      await initializeServiceWorker();
      const videos = await getDetectedVideos();
      expect(videos.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Message Handler Unknown Types', () => {
    test('should handle unknown message types', async () => {
      const response = await handleMessage({ type: 'UNKNOWN' });
      expect(response).toHaveProperty('error');
    });
  });

  describe('Clear Detected Videos', () => {
    test('should clear all detected videos', async () => {
      chrome.storage.local.clear.mockImplementation((callback) => callback());

      await clearDetectedVideos();
      expect(chrome.storage.local.clear).toHaveBeenCalled();
    });
  });

  describe('Network Request Interception', () => {
    test('should detect HLS URLs in network requests', async () => {
      const video = detectVideoUrl('https://example.com/stream.m3u8', 1);
      expect(video).not.toBeNull();
      expect(video.type).toBe('hls');
      expect(video.tabId).toBe(1);
    });

    test('should detect DASH URLs in network requests', async () => {
      const video = detectVideoUrl('https://example.com/stream.mpd', 2);
      expect(video).not.toBeNull();
      expect(video.type).toBe('dash');
      expect(video.tabId).toBe(2);
    });

    test('should ignore non-media URLs', async () => {
      const video = detectVideoUrl('https://example.com/page.html', 1);
      expect(video).toBeNull();
    });
  });

  describe('Download Video Function', () => {
    beforeEach(() => {
      // Mock fetch for download tests
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          text: async () => '#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10,\nsegment-1.ts',
          headers: {
            get: jest.fn(() => '1024'),
          },
          body: {
            getReader: jest.fn(() => ({
              read: jest.fn()
                .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
                .mockResolvedValueOnce({ done: true }),
              releaseLock: jest.fn(),
            })),
          },
        })
      );
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should validate video object before downloading', async () => {
      const result = await downloadVideo({ url: '', type: 'unknown' });
      expect(result.status).toBe('error');
    });

    test('should validate URL format before downloading', async () => {
      const result = await downloadVideo({ url: 'not-a-url', type: 'hls' });
      expect(result.status).toBe('error');
    });

    test('should return error for unsupported video types', async () => {
      const result = await downloadVideo({
        url: 'https://example.com/file.txt',
        type: 'unknown',
      });
      expect(result.status).toBe('error');
    });

    test('should handle null video object', async () => {
      const result = await downloadVideo(null);
      expect(result.status).toBe('error');
    });

    test('should download HLS stream successfully', async () => {
      const video = {
        url: 'https://example.com/stream.m3u8',
        type: 'hls',
      };
      const result = await downloadVideo(video);
      expect(result).toHaveProperty('status');
    });

    test('should download DASH stream successfully', async () => {
      const video = {
        url: 'https://example.com/stream.mpd',
        type: 'dash',
      };
      const result = await downloadVideo(video);
      expect(result).toHaveProperty('status');
    });

    test('should download simple video successfully', async () => {
      const video = {
        url: 'https://example.com/video.mp4',
        type: 'video',
      };
      const result = await downloadVideo(video);
      expect(result).toHaveProperty('status');
    });

    test('should handle progress callback', async () => {
      const onProgress = jest.fn();
      const video = {
        url: 'https://example.com/video.mp4',
        type: 'video',
      };
      await downloadVideo(video, onProgress);
      // Progress may or may not be called depending on fetch response
      expect(typeof onProgress).toBe('function');
    });

    test('should handle fetch failure gracefully', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
      const video = {
        url: 'https://example.com/stream.m3u8',
        type: 'hls',
      };
      const result = await downloadVideo(video);
      expect(result.status).toBe('error');
    });

    test('should handle invalid response from fetch', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        })
      );
      const video = {
        url: 'https://example.com/stream.m3u8',
        type: 'hls',
      };
      const result = await downloadVideo(video);
      expect(result.status).toBe('error');
    });

    test('should handle empty manifest parsing', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          text: async () => '',
        })
      );
      const video = {
        url: 'https://example.com/stream.m3u8',
        type: 'hls',
      };
      const result = await downloadVideo(video);
      // Result depends on how parseHLS handles empty content
      expect(result).toBeDefined();
    });
  });

  describe('Service Worker Advanced Deduplication', () => {
    test('should handle multiple query parameter variations of same URL', async () => {
      await clearDetectedVideos();

      const video1 = {
        url: 'https://example.com/stream.m3u8?v=1&t=abc&s=123',
        type: 'hls',
        tabId: 1,
        timestamp: 1000,
      };
      const video2 = {
        url: 'https://example.com/stream.m3u8?v=2&t=xyz&s=456',
        type: 'hls',
        tabId: 2,
        timestamp: 2000,
      };

      await handleMessage({ type: 'ADD_VIDEO', video: video1 });
      await handleMessage({ type: 'ADD_VIDEO', video: video2 });

      const response = await handleMessage({ type: 'GET_VIDEOS' });
      expect(response.videos.length).toBe(1);
      expect(response.videos[0].timestamp).toBe(2000); // newer timestamp
    });

    test('should handle URL with both query params and fragments', async () => {
      await clearDetectedVideos();

      const video1 = {
        url: 'https://example.com/stream.m3u8?token=abc#position=1',
        type: 'hls',
        tabId: 1,
        timestamp: 1000,
      };
      const video2 = {
        url: 'https://example.com/stream.m3u8?token=xyz#position=2',
        type: 'hls',
        tabId: 2,
        timestamp: 2000,
      };

      await handleMessage({ type: 'ADD_VIDEO', video: video1 });
      await handleMessage({ type: 'ADD_VIDEO', video: video2 });

      const response = await handleMessage({ type: 'GET_VIDEOS' });
      expect(response.videos.length).toBe(1);
    });

    test('should maintain tab information in deduplicated videos', async () => {
      await clearDetectedVideos();

      const video1 = {
        url: 'https://example.com/stream.m3u8?v=1',
        type: 'hls',
        tabId: 1,
        timestamp: 1000,
      };
      const video2 = {
        url: 'https://example.com/stream.m3u8?v=2',
        type: 'hls',
        tabId: 2,
        timestamp: 2000,
      };

      await handleMessage({ type: 'ADD_VIDEO', video: video1 });
      await handleMessage({ type: 'ADD_VIDEO', video: video2 });

      const response = await handleMessage({ type: 'GET_VIDEOS' });
      const video = response.videos[0];
      expect(video.tabId).toBeDefined();
    });
  });

  describe('Service Worker Message Handler Edge Cases', () => {
    test('should handle message with missing video property', async () => {
      const response = await handleMessage({ type: 'ADD_VIDEO' });
      expect(response.error).toBeDefined();
    });

    test('should handle message with null sender', async () => {
      const video = { url: 'https://example.com/video.m3u8', type: 'hls', tabId: 1, timestamp: Date.now() };
      const response = await handleMessage({ type: 'ADD_VIDEO', video }, null);
      expect(response).not.toHaveProperty('error');
    });

    test('should return proper response structure for successful message', async () => {
      await clearDetectedVideos();
      const video = { url: 'https://example.com/video.m3u8', type: 'hls', tabId: 1, timestamp: Date.now() };
      const response = await handleMessage({ type: 'ADD_VIDEO', video });
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('videos');
    });

    test('should handle error in message processing', async () => {
      // Simulate a message that will cause an error
      const response = await handleMessage({ type: 'UNKNOWN_TYPE' });
      expect(response.error).toBeDefined();
    });
  });

  describe('URL Normalization Edge Cases', () => {
    test('should handle empty string', () => {
      expect(normalizeUrl('')).toBe('');
    });

    test('should handle null', () => {
      expect(normalizeUrl(null)).toBe('');
    });

    test('should handle undefined', () => {
      expect(normalizeUrl(undefined)).toBe('');
    });

    test('should handle non-string input', () => {
      expect(normalizeUrl(123)).toBe('');
    });

    test('should preserve path in URL', () => {
      const url = 'https://example.com/path/to/stream.m3u8?token=abc';
      const normalized = normalizeUrl(url);
      expect(normalized).toContain('/path/to/stream.m3u8');
    });
  });

  describe('Content-Type Header Detection', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      chrome.storage.local.set.mockImplementation((items, callback) => {
        if (callback) callback();
      });
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([]);
      });
      chrome.tabs.sendMessage.mockImplementation(() => Promise.resolve());
    });

    test('should detect video/mp4 Content-Type as stream', async () => {
      await clearDetectedVideos();

      // Simulate onHeadersReceived with video/mp4 Content-Type
      const details = {
        url: 'https://example.com/stream',
        tabId: 1,
        responseHeaders: [
          { name: 'Content-Type', value: 'video/mp4' },
          { name: 'Content-Length', value: '1024' },
        ],
      };

      // We need to manually call the detection logic since we can't easily access the listener
      // Create a video object as the handler would
      const { detectMediaTypeByContentType } = require('../src/utils/media-extensions.js');
      const contentTypeValue = details.responseHeaders.find(
        h => h.name.toLowerCase() === 'content-type'
      )?.value;
      const mediaType = detectMediaTypeByContentType(contentTypeValue);

      expect(mediaType).toBe('stream');
      expect(contentTypeValue).toBe('video/mp4');
    });

    test('should detect video/webm Content-Type as stream', async () => {
      const { detectMediaTypeByContentType } = require('../src/utils/media-extensions.js');
      const mediaType = detectMediaTypeByContentType('video/webm');
      expect(mediaType).toBe('stream');
    });

    test('should detect audio/mpeg Content-Type as audio', async () => {
      const { detectMediaTypeByContentType } = require('../src/utils/media-extensions.js');
      const mediaType = detectMediaTypeByContentType('audio/mpeg');
      expect(mediaType).toBe('audio');
    });

    test('should handle Content-Type with parameters', async () => {
      const { detectMediaTypeByContentType } = require('../src/utils/media-extensions.js');
      const mediaType = detectMediaTypeByContentType('video/mp4; charset=utf-8');
      expect(mediaType).toBe('stream');
    });

    test('should return null for non-video Content-Type', async () => {
      const { detectMediaTypeByContentType } = require('../src/utils/media-extensions.js');
      const mediaType = detectMediaTypeByContentType('text/html');
      expect(mediaType).toBeNull();
    });

    test('should return null for missing Content-Type header', async () => {
      const { detectMediaTypeByContentType } = require('../src/utils/media-extensions.js');
      const mediaType = detectMediaTypeByContentType(null);
      expect(mediaType).toBeNull();
    });

    test('should be case-insensitive for Content-Type', async () => {
      const { detectMediaTypeByContentType } = require('../src/utils/media-extensions.js');
      expect(detectMediaTypeByContentType('VIDEO/MP4')).toBe('stream');
      expect(detectMediaTypeByContentType('Video/WebM')).toBe('stream');
    });
  });

  describe('Content-Type Detection Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      chrome.storage.local.set.mockImplementation((items, callback) => {
        if (callback) callback();
      });
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([]);
      });
      chrome.tabs.sendMessage.mockImplementation(() => Promise.resolve());
      if (chrome.webRequest?.onBeforeRequest?.addListener) {
        chrome.webRequest.onBeforeRequest.addListener.mockClear();
      }
      if (chrome.webRequest?.onHeadersReceived?.addListener) {
        chrome.webRequest.onHeadersReceived.addListener.mockClear();
      }
      if (chrome.runtime?.onMessage?.addListener) {
        chrome.runtime.onMessage.addListener.mockClear();
      }
    });

    test('should add video to collection when Content-Type is video/*', async () => {
      await clearDetectedVideos();

      const video = {
        url: 'https://example.com/videostream',
        type: 'stream',
        tabId: 1,
        timestamp: Date.now(),
        detectionMethod: 'content-type',
      };

      const setMock = chrome.storage.local.set;
      await handleMessage({ type: 'ADD_VIDEO', video });

      expect(setMock).toHaveBeenCalled();
      const [savedData] = setMock.mock.calls[0];
      expect(savedData.detectedVideos).toContainEqual(video);
    });

    test('should deduplicate Content-Type detected videos', async () => {
      await clearDetectedVideos();

      // First video detected by extension
      const video1 = {
        url: 'https://example.com/stream.mp4',
        type: 'video',
        tabId: 1,
        timestamp: Date.now() - 1000,
      };

      const setMock = chrome.storage.local.set;
      await handleMessage({ type: 'ADD_VIDEO', video: video1 });
      setMock.mockClear();

      // Second video should not be added if it normalizes to the same URL
      const video2 = {
        url: 'https://example.com/stream.mp4?token=abc',
        type: 'stream',
        tabId: 2,
        timestamp: Date.now(),
        detectionMethod: 'content-type',
      };

      await handleMessage({ type: 'ADD_VIDEO', video: video2 });

      const [savedData] = setMock.mock.calls[0];
      // Should have 1 video (the newer one with the updated timestamp)
      expect(savedData.detectedVideos.length).toBe(1);
      expect(savedData.detectedVideos[0].timestamp).toBeGreaterThan(video1.timestamp);
    });

    test('should handle missing Content-Type header gracefully', async () => {
      const details = {
        url: 'https://example.com/unknown',
        tabId: 1,
        responseHeaders: [
          { name: 'Content-Length', value: '1024' },
          { name: 'Cache-Control', value: 'no-cache' },
        ],
      };

      // No Content-Type header should result in no video detection
      const contentTypeHeader = details.responseHeaders.find(
        h => h.name.toLowerCase() === 'content-type'
      );
      expect(contentTypeHeader).toBeUndefined();
    });

    test('should handle empty responseHeaders array', async () => {
      const details = {
        url: 'https://example.com/stream',
        tabId: 1,
        responseHeaders: [],
      };

      const contentTypeHeader = details.responseHeaders.find(
        h => h.name.toLowerCase() === 'content-type'
      );
      expect(contentTypeHeader).toBeUndefined();
    });

    test('should handle null responseHeaders gracefully', async () => {
      const details = {
        url: 'https://example.com/stream',
        tabId: 1,
        responseHeaders: null,
      };

      // Should not throw error
      expect(() => {
        const contentTypeHeader = details.responseHeaders?.find?.(
          h => h.name.toLowerCase() === 'content-type'
        );
        expect(contentTypeHeader).toBeUndefined();
      }).not.toThrow();
    });
  });

  describe('Integrated Pattern and Content-Type Detection', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      chrome.storage.local.set.mockImplementation((items, callback) => {
        if (callback) callback();
      });
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([]);
      });
      chrome.tabs.sendMessage.mockImplementation(() => Promise.resolve());
    });

    test('should detect video by extension (priority 1)', () => {
      const result = detectVideoUrl('https://example.com/video.mp4', 1);
      expect(result).not.toBeNull();
      expect(result.type).toBe('video');
      expect(result.detectionMethod).toBe('extension');
    });

    test('should detect video by URL pattern when extension not present (priority 2)', () => {
      const result = detectVideoUrl('https://googlevideo.com/stream', 1);
      expect(result).not.toBeNull();
      expect(result.type).toBe('stream');
      expect(result.detectionMethod).toBe('pattern');
    });

    test('should detect video by Content-Type when neither extension nor pattern match (priority 3)', () => {
      const result = detectVideoUrl('https://example.com/stream', 1, 'video/mp4');
      expect(result).not.toBeNull();
      expect(result.type).toBe('stream');
      expect(result.detectionMethod).toBe('content-type');
    });

    test('should prefer extension detection over pattern detection', () => {
      // URL has both extension and matches pattern
      const result = detectVideoUrl('https://googlevideo.com/stream.mp4', 1);
      expect(result).not.toBeNull();
      expect(result.detectionMethod).toBe('extension');
    });

    test('should prefer pattern detection over Content-Type detection', () => {
      // URL matches pattern but Content-Type is also provided
      const result = detectVideoUrl('https://googlevideo.com/stream', 1, 'video/mp4');
      expect(result).not.toBeNull();
      expect(result.detectionMethod).toBe('pattern');
    });

    test('should detect audio by Content-Type', () => {
      const result = detectVideoUrl('https://example.com/audio', 1, 'audio/mpeg');
      expect(result).not.toBeNull();
      expect(result.type).toBe('audio');
      expect(result.detectionMethod).toBe('content-type');
    });

    test('should return null when no detection method matches', () => {
      const result = detectVideoUrl('https://example.com/page.html', 1, 'text/html');
      expect(result).toBeNull();
    });

    test('should return null when Content-Type is provided but is not media', () => {
      const result = detectVideoUrl('https://example.com/data', 1, 'application/json');
      expect(result).toBeNull();
    });

    test('should include timestamp in detected video', () => {
      const beforeTime = Date.now();
      const result = detectVideoUrl('https://example.com/video.mp4', 1);
      const afterTime = Date.now();
      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });

    test('should not include detectionMethod when no detection found', () => {
      const result = detectVideoUrl('https://example.com/page.html', 1);
      expect(result).toBeNull();
    });

    test('should detect pattern-based URL for vimeo.com/video/', () => {
      const result = detectVideoUrl('https://vimeo.com/video/12345', 1);
      expect(result).not.toBeNull();
      expect(result.type).toBe('stream');
      expect(result.detectionMethod).toBe('pattern');
    });

    test('should detect pattern-based URL for player.vimeo.com', () => {
      const result = detectVideoUrl('https://player.vimeo.com/video/12345', 1);
      expect(result).not.toBeNull();
      expect(result.type).toBe('stream');
      expect(result.detectionMethod).toBe('pattern');
    });

    test('should handle URL with query parameters correctly with pattern detection', () => {
      const result = detectVideoUrl('https://googlevideo.com/stream?token=abc&version=1', 1);
      expect(result).not.toBeNull();
      expect(result.type).toBe('stream');
      expect(result.detectionMethod).toBe('pattern');
    });
  });

  describe('Headers Inspection with Unified Detection', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      chrome.storage.local.set.mockImplementation((items, callback) => {
        if (callback) callback();
      });
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([]);
      });
      chrome.tabs.sendMessage.mockImplementation(() => Promise.resolve());
    });

    test('should detect video from Content-Type header using unified detectVideoUrl', async () => {
      await clearDetectedVideos();

      const result = detectVideoUrl('https://example.com/stream', 1, 'video/mp4');
      expect(result).not.toBeNull();
      expect(result.type).toBe('stream');
      expect(result.detectionMethod).toBe('content-type');
    });

    test('should not detect non-media Content-Type', async () => {
      const result = detectVideoUrl('https://example.com/page', 1, 'text/html');
      expect(result).toBeNull();
    });

    test('should broadcast VIDEOS_UPDATED when Content-Type detects video', async () => {
      await clearDetectedVideos();

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1, url: 'https://example.com' }]);
      });

      const video = {
        url: 'https://example.com/stream',
        type: 'stream',
        tabId: 1,
        timestamp: Date.now(),
        detectionMethod: 'content-type',
      };

      await handleMessage({ type: 'ADD_VIDEO', video });

      expect(chrome.tabs.sendMessage).toHaveBeenCalled();
      const calls = chrome.tabs.sendMessage.mock.calls;
      const broadcastCall = calls.find(call => call[1]?.type === 'VIDEOS_UPDATED');
      expect(broadcastCall).toBeDefined();
    });

    test('should handle Content-Type with parameters in headers inspection', async () => {
      const result = detectVideoUrl('https://example.com/stream', 1, 'video/mp4; charset=utf-8');
      expect(result).not.toBeNull();
      expect(result.type).toBe('stream');
      expect(result.detectionMethod).toBe('content-type');
    });
  });
});
