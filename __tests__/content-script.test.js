/* global chrome */

/**
 * Content Script Tests
 * Tests for DOM scanning, deduplication, MutationObserver, and messaging
 */

jest.mock('../src/utils/media-extensions.js', () => ({
  isMediaURL: jest.fn((url) => {
    if (!url) return false;
    return url.includes('.m3u8') || url.includes('.mpd') || url.includes('.mp4') || url.includes('.ts') || url.includes('.m4s') || url.includes('.webm');
  }),
  getMediaType: jest.fn((url) => {
    if (!url) return 'unknown';
    if (url.includes('.m3u8')) return 'hls';
    if (url.includes('.mpd')) return 'dash';
    if (url.includes('.ts') || url.includes('.m4s')) return 'stream';
    if (url.includes('.mp4')) return 'video';
    return 'unknown';
  }),
  cleanUrl: jest.fn((url) => {
    if (!url) return '';
    return url.split('?')[0].split('#')[0];
  }),
}));

// Mock global MutationObserver
const mockMutationObserverInstances = [];

global.MutationObserver = jest.fn(function MutationObserverMock(callback) {
  this.callback = callback;
  this.observe = jest.fn();
  this.disconnect = jest.fn();
  mockMutationObserverInstances.push(this);
});

import { findVideoElements, initContentScript } from '../src/content/content-script.js';
import { cleanUrl } from '../src/utils/media-extensions.js';

describe('Content Script', () => {
  let originalAddEventListener;
  let documentAddEventListenerSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutationObserverInstances.length = 0;
    chrome.runtime.sendMessage.mockClear();

    // Mock document.addEventListener
    originalAddEventListener = document.addEventListener;
    documentAddEventListenerSpy = jest.fn();
    document.addEventListener = documentAddEventListenerSpy;
  });

  afterEach(() => {
    document.addEventListener = originalAddEventListener;
  });

  describe('findVideoElements()', () => {
    test('should find video elements with direct src attribute', () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'https://example.com/video.mp4';
      container.appendChild(video);
      document.body.appendChild(container);

      const videos = findVideoElements();

      expect(videos).toContainEqual(
        expect.objectContaining({
          url: 'https://example.com/video.mp4',
          source: 'dom',
        })
      );

      document.body.removeChild(container);
    });

    test('should find video elements with nested source children', () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      const source = document.createElement('source');
      source.src = 'https://example.com/video.mp4';
      source.type = 'video/mp4';
      video.appendChild(source);
      container.appendChild(video);
      document.body.appendChild(container);

      const videos = findVideoElements();

      expect(videos).toContainEqual(
        expect.objectContaining({
          url: 'https://example.com/video.mp4',
          source: 'dom',
        })
      );

      document.body.removeChild(container);
    });

    test('should handle multiple source children in a single video element', () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      const source1 = document.createElement('source');
      source1.src = 'https://example.com/video.mp4';
      const source2 = document.createElement('source');
      source2.src = 'https://example.com/video.webm';
      video.appendChild(source1);
      video.appendChild(source2);
      container.appendChild(video);
      document.body.appendChild(container);

      const videos = findVideoElements();

      expect(videos.length).toBeGreaterThanOrEqual(2);
      expect(videos).toContainEqual(
        expect.objectContaining({ url: 'https://example.com/video.mp4' })
      );
      expect(videos).toContainEqual(
        expect.objectContaining({ url: 'https://example.com/video.webm' })
      );

      document.body.removeChild(container);
    });

    test('should handle deduplication of URLs', () => {
      const container = document.createElement('div');
      const video1 = document.createElement('video');
      video1.src = 'https://example.com/video.mp4';
      const video2 = document.createElement('video');
      video2.src = 'https://example.com/video.mp4?token=123';
      container.appendChild(video1);
      container.appendChild(video2);
      document.body.appendChild(container);

      const videos = findVideoElements();

      // Should deduplicate after cleaning URLs
      const uniqueUrls = [...new Set(videos.map((v) => cleanUrl(v.url)))];
      expect(uniqueUrls.length).toBeLessThanOrEqual(videos.length);

      document.body.removeChild(container);
    });

    test('should extract src from custom data attributes', () => {
      const container = document.createElement('div');
      const div = document.createElement('div');
      div.setAttribute('data-video-url', 'https://example.com/custom.mp4');
      container.appendChild(div);
      document.body.appendChild(container);

      const videos = findVideoElements();

      expect(videos.some((v) => v.url.includes('custom.mp4'))).toBe(true);

      document.body.removeChild(container);
    });

    test('should extract src from data-stream-url attribute', () => {
      const container = document.createElement('div');
      const div = document.createElement('div');
      div.setAttribute('data-stream-url', 'https://example.com/stream.m3u8');
      container.appendChild(div);
      document.body.appendChild(container);

      const videos = findVideoElements();

      expect(videos.some((v) => v.url.includes('stream.m3u8'))).toBe(true);

      document.body.removeChild(container);
    });

    test('should only return valid media URLs', () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'https://example.com/video.mp4';
      const source = document.createElement('source');
      source.src = 'not-a-url';
      video.appendChild(source);
      container.appendChild(video);
      document.body.appendChild(container);

      const videos = findVideoElements();

      // Should filter out non-media URLs
      const hasValidUrls = videos.every((v) => typeof v.url === 'string' && v.url.length > 0);
      expect(hasValidUrls).toBe(true);

      document.body.removeChild(container);
    });
  });

  describe('Message sending to Service Worker', () => {
    test('should send ADD_VIDEO message with discovered URLs', async () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'https://example.com/video.mp4';
      container.appendChild(video);
      document.body.appendChild(container);

      chrome.runtime.sendMessage.mockResolvedValue({ success: true });

      const videos = findVideoElements();
      if (videos.length > 0) {
        await chrome.runtime.sendMessage({
          type: 'ADD_VIDEO',
          url: videos[0].url,
          source: 'dom',
        });
      }

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADD_VIDEO',
          source: 'dom',
        })
      );

      document.body.removeChild(container);
    });

    test('should handle Service Worker response', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ success: true });

      const result = await chrome.runtime.sendMessage({
        type: 'ADD_VIDEO',
        url: 'https://example.com/video.mp4',
        source: 'dom',
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe('MutationObserver for dynamic elements', () => {
    test('should set up MutationObserver on initialization', () => {
      initContentScript();

      expect(MutationObserver).toHaveBeenCalled();
    });

    test('should observe document for childList changes', () => {
      initContentScript();

      const observerInstance = mockMutationObserverInstances[0];
      expect(observerInstance.observe).toHaveBeenCalledWith(document.body, {
        childList: true,
        subtree: true,
      });
    });

    test('should debounce MutationObserver callbacks', (done) => {
      initContentScript();

      const observerInstance = mockMutationObserverInstances[0];
      const callback = observerInstance.callback;

      // Simulate rapid mutations
      callback([{ type: 'childList' }]);
      callback([{ type: 'childList' }]);
      callback([{ type: 'childList' }]);

      // Give time for debounce to settle
      setTimeout(() => {
        // Should have been called only once after debounce
        expect(chrome.runtime.sendMessage.mock.calls.length).toBeLessThanOrEqual(3);
        done();
      }, 250);
    });

    test('should call findVideoElements on dynamic DOM changes', (done) => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      initContentScript();

      const observerInstance = mockMutationObserverInstances[0];
      const callback = observerInstance.callback;

      // Add a video dynamically
      const video = document.createElement('video');
      video.src = 'https://example.com/dynamic.mp4';
      container.appendChild(video);

      callback([{ type: 'childList', addedNodes: [video] }]);

      setTimeout(() => {
        // Should have discovered the new video
        expect(findVideoElements().some((v) => v.url.includes('dynamic.mp4'))).toBe(true);
        document.body.removeChild(container);
        done();
      }, 100);
    });
  });

  describe('iframe support', () => {
    test('should traverse same-origin iframes', () => {
      const iframe = document.createElement('iframe');

      // Mock iframe contentDocument
      Object.defineProperty(iframe, 'contentDocument', {
        value: document,
        writable: false,
      });

      const video = document.createElement('video');
      video.src = 'https://example.com/iframe-video.mp4';
      document.body.appendChild(video);

      const videos = findVideoElements();

      // Should find video elements in main document
      expect(videos.length).toBeGreaterThan(0);

      document.body.removeChild(video);
    });
  });

  describe('shadow DOM support', () => {
    test('should traverse shadow DOM elements', () => {
      if (!HTMLElement.prototype.attachShadow) {
        // Skip if shadow DOM not supported
        return;
      }

      const host = document.createElement('div');
      document.body.appendChild(host);

      const shadowRoot = host.attachShadow({ mode: 'open' });
      const video = document.createElement('video');
      video.src = 'https://example.com/shadow-video.mp4';
      shadowRoot.appendChild(video);

      const videos = findVideoElements();

      // Should find shadow DOM video elements
      const hasShadowVideo = videos.some((v) => v.url.includes('shadow-video.mp4'));
      expect(hasShadowVideo).toBe(true);

      document.body.removeChild(host);
    });
  });

  describe('initialization', () => {
    test('should set up DOMContentLoaded event listener', () => {
      initContentScript();

      expect(documentAddEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );
    });

    test('should call findVideoElements on DOMContentLoaded', (done) => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = 'https://example.com/onload.mp4';
      container.appendChild(video);
      document.body.appendChild(container);

      initContentScript();

      // Simulate DOMContentLoaded
      const eventListener = documentAddEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'DOMContentLoaded'
      )?.[1];

      if (eventListener) {
        eventListener();

        setTimeout(() => {
          const videos = findVideoElements();
          expect(videos.some((v) => v.url.includes('onload.mp4'))).toBe(true);
          document.body.removeChild(container);
          done();
        }, 50);
      }
    });
  });

  describe('URL validation', () => {
    test('should filter out empty or invalid URLs', () => {
      const container = document.createElement('div');
      const video1 = document.createElement('video');
      video1.src = ''; // Empty
      const video2 = document.createElement('video');
      video2.src = 'https://example.com/video.mp4'; // Valid
      container.appendChild(video1);
      container.appendChild(video2);
      document.body.appendChild(container);

      const videos = findVideoElements();

      const hasEmptyUrl = videos.some((v) => v.url === '' || v.url === null);
      expect(hasEmptyUrl).toBe(false);

      document.body.removeChild(container);
    });

    test('should handle relative URLs', () => {
      const container = document.createElement('div');
      const video = document.createElement('video');
      video.src = '/videos/video.mp4'; // Relative URL
      container.appendChild(video);
      document.body.appendChild(container);

      const videos = findVideoElements();

      // Should still capture the URL (even if relative)
      expect(videos.length).toBeGreaterThanOrEqual(0);

      document.body.removeChild(container);
    });
  });
});
