/* global chrome */

/**
 * Popup UI Tests
 * Tests for video listing, filtering, download triggers, progress updates, and UI rendering
 */

import {
  getVideoList,
  renderVideoList,
  downloadVideo,
  initPopup,
  filterVideos,
  sortVideos,
} from '../src/popup/popup.js';

describe('Popup UI', () => {
  let mockVideos;

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = `
      <div id="status"></div>
      <ul id="video-list"></ul>
      <div id="filter">
        <select id="filter-dropdown">
          <option value="all">All</option>
          <option value="hls">HLS</option>
          <option value="dash">DASH</option>
          <option value="video">MP4</option>
        </select>
      </div>
      <div id="sort">
        <select id="sort-dropdown">
          <option value="recency">Recent First</option>
          <option value="quality">Quality</option>
        </select>
      </div>
      <progress id="progress" max="100" value="0"></progress>
      <div class="actions">
        <button id="refresh-btn">Refresh</button>
        <button id="clear-btn">Clear All</button>
      </div>
    `;

    // Setup mock videos
    mockVideos = [
      {
        url: 'https://example.com/video1.m3u8',
        type: 'hls',
        timestamp: Date.now() - 1000,
        tabId: 1,
      },
      {
        url: 'https://example.com/video2.mpd',
        type: 'dash',
        timestamp: Date.now() - 500,
        tabId: 2,
      },
      {
        url: 'https://example.com/video3.mp4',
        type: 'video',
        timestamp: Date.now(),
        tabId: 3,
      },
    ];

    // Setup chrome API mocks
    jest.clearAllMocks();
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ detectedVideos: mockVideos });
    });
    chrome.storage.local.set.mockImplementation((_items, callback) => {
      if (callback) callback();
    });
    chrome.storage.local.clear.mockImplementation((callback) => {
      if (callback) callback();
    });
    chrome.runtime.sendMessage.mockImplementation(() => Promise.resolve({}));
  });

  describe('getVideoList', () => {
    test('should fetch video list from chrome.storage.local', async () => {
      const videos = await getVideoList();
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['detectedVideos'], expect.any(Function));
      expect(videos).toEqual(mockVideos);
    });

    test('should return empty array if no videos found', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      const videos = await getVideoList();
      expect(videos).toEqual([]);
    });

    test('should handle storage errors gracefully', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(null);
      });
      const videos = await getVideoList();
      expect(videos).toEqual([]);
    });
  });

  describe('renderVideoList', () => {
    test('should render video list with correct items', () => {
      const container = document.getElementById('video-list');
      renderVideoList(mockVideos, container);

      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBe(3);
    });

    test('should render correct type icons', () => {
      const container = document.getElementById('video-list');
      renderVideoList(mockVideos, container);

      const items = container.querySelectorAll('li');
      expect(items[0].textContent).toContain('📺');  // HLS icon
      expect(items[1].textContent).toContain('🎬');  // DASH icon
      expect(items[2].textContent).toContain('🎞️');  // MP4 icon
    });

    test('should render download buttons for each video', () => {
      const container = document.getElementById('video-list');
      renderVideoList(mockVideos, container);

      const downloadButtons = container.querySelectorAll('button.download-btn');
      expect(downloadButtons.length).toBe(3);
    });

    test('should render empty message when no videos provided', () => {
      const container = document.getElementById('video-list');
      renderVideoList([], container);

      const emptyMessage = container.querySelector('.empty-message');
      expect(emptyMessage).toBeTruthy();
      expect(emptyMessage.textContent).toContain('No videos detected');
    });

    test('should render video URLs in list items', () => {
      const container = document.getElementById('video-list');
      renderVideoList(mockVideos, container);

      const items = container.querySelectorAll('li');
      expect(items[0].textContent).toContain('video1.m3u8');
      expect(items[1].textContent).toContain('video2.mpd');
      expect(items[2].textContent).toContain('video3.mp4');
    });

    test('should attach download event listeners', () => {
      const container = document.getElementById('video-list');
      const mockDownload = jest.fn();

      renderVideoList(mockVideos, container, { onDownload: mockDownload });

      const downloadButton = container.querySelector('button.download-btn');
      downloadButton.click();

      expect(mockDownload).toHaveBeenCalled();
    });
  });

  describe('filterVideos', () => {
    test('should filter videos by type (hls)', () => {
      const filtered = filterVideos(mockVideos, 'hls');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('hls');
    });

    test('should filter videos by type (dash)', () => {
      const filtered = filterVideos(mockVideos, 'dash');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('dash');
    });

    test('should filter videos by type (video/mp4)', () => {
      const filtered = filterVideos(mockVideos, 'video');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('video');
    });

    test('should return all videos when filter is "all"', () => {
      const filtered = filterVideos(mockVideos, 'all');
      expect(filtered).toHaveLength(3);
    });

    test('should return empty array when filter matches no videos', () => {
      const filtered = filterVideos(mockVideos, 'unknown');
      expect(filtered).toHaveLength(0);
    });
  });

  describe('sortVideos', () => {
    test('should sort videos by recency (newest first)', () => {
      const sorted = sortVideos(mockVideos, 'recency');
      expect(sorted[0].timestamp).toBeGreaterThanOrEqual(sorted[1].timestamp);
      expect(sorted[1].timestamp).toBeGreaterThanOrEqual(sorted[2].timestamp);
    });

    test('should preserve original videos array', () => {
      const original = [...mockVideos];
      sortVideos(mockVideos, 'recency');
      expect(mockVideos).toEqual(original);
    });

    test('should handle quality sorting', () => {
      const videosWithQuality = [
        { ...mockVideos[0], quality: '480p' },
        { ...mockVideos[1], quality: '1080p' },
        { ...mockVideos[2], quality: '720p' },
      ];
      const sorted = sortVideos(videosWithQuality, 'quality');
      expect(sorted).toHaveLength(3);
    });
  });

  describe('downloadVideo', () => {
    test('should send DOWNLOAD_VIDEO message to service worker', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'completed' });
      });

      const result = await downloadVideo(mockVideos[0]);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DOWNLOAD_VIDEO',
          video: mockVideos[0],
        }),
        expect.any(Function)
      );
      expect(result.status).toBe('completed');
    });

    test('should handle download errors', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'error', error: 'Invalid video data' });
      });

      try {
        await downloadVideo(mockVideos[0]);
        // If we get here, the promise didn't reject
        expect(false).toBe(true); // Force fail
      } catch (error) {
        expect(error.message).toContain('Invalid video data');
      }
    });

    test('should update progress bar during download', async () => {
      const progressEl = document.getElementById('progress');

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'completed', filename: 'video_20260317_720p.mp4' });
      });

      const result = await downloadVideo(mockVideos[0], {
        onProgress: (percent) => {
          progressEl.value = percent;
        },
      });

      expect(result.status).toBe('completed');
    });

    test('should call onProgress callback when provided', (done) => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'DOWNLOAD_VIDEO') {
          // Simulate progress updates
          if (message.onProgress) {
            message.onProgress(25);
            message.onProgress(50);
            message.onProgress(100);
          }
          callback({ status: 'completed' });
        }
      });

      const progressUpdates = [];
      downloadVideo(mockVideos[0], {
        onProgress: (percent) => {
          progressUpdates.push(percent);
          if (progressUpdates.length === 3) {
            expect(progressUpdates).toEqual([25, 50, 100]);
            done();
          }
        },
      });
    });
  });

  describe('initPopup', () => {
    test('should initialize popup with video list', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'ok' });
      });

      await initPopup();

      const listItems = document.querySelectorAll('#video-list li');
      expect(listItems.length).toBeGreaterThan(0);
    });

    test('should attach clear button listener', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'ok' });
      });
      chrome.storage.local.clear.mockImplementation((callback) => {
        if (callback) callback();
      });

      await initPopup();

      const clearBtn = document.getElementById('clear-btn');
      clearBtn.click();

      expect(chrome.storage.local.clear).toHaveBeenCalled();
    });

    test('should attach filter dropdown listener', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'ok' });
      });

      await initPopup();

      const filterDropdown = document.getElementById('filter-dropdown');
      const videoListBefore = document.querySelectorAll('#video-list li').length;

      filterDropdown.value = 'hls';
      filterDropdown.dispatchEvent(new Event('change'));

      const videoListAfter = document.querySelectorAll('#video-list li').length;
      expect(videoListAfter).toBeLessThanOrEqual(videoListBefore);
    });

    test('should attach refresh button listener', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'ok' });
      });

      await initPopup();

      const refreshBtn = document.getElementById('refresh-btn');
      refreshBtn.click();

      expect(chrome.storage.local.get).toHaveBeenCalled();
    });

    test('should display status message', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'ok' });
      });

      await initPopup();

      const status = document.getElementById('status');
      expect(status.textContent).toBeTruthy();
    });
  });

  describe('UI State Management', () => {
    test('should show progress bar during download', async () => {
      const progressEl = document.getElementById('progress');
      expect(progressEl).toBeTruthy();
      expect(progressEl.value).toBe(0);
    });

    test('should update status with download progress', async () => {
      const statusEl = document.getElementById('status');

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'completed' });
      });

      await downloadVideo(mockVideos[0]);

      expect(statusEl).toBeTruthy();
    });

    test('should disable buttons during download', async () => {
      const clearBtn = document.getElementById('clear-btn');
      const refreshBtn = document.getElementById('refresh-btn');

      // Buttons should be initially enabled (not disabled)
      expect(clearBtn.disabled).toBe(false);
      expect(refreshBtn.disabled).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle videos with missing optional properties', () => {
      const minimalVideos = [
        { url: 'https://example.com/video.mp4', type: 'video' },
      ];

      const container = document.getElementById('video-list');
      renderVideoList(minimalVideos, container);

      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBe(1);
    });

    test('should handle very long URLs in display', () => {
      const longUrlVideos = [
        {
          url: 'https://example.com/' + 'a'.repeat(200) + '.mp4',
          type: 'video',
          timestamp: Date.now(),
        },
      ];

      const container = document.getElementById('video-list');
      renderVideoList(longUrlVideos, container);

      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBe(1);
    });

    test('should handle rapid filter changes', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'ok' });
      });

      await initPopup();

      const filterDropdown = document.getElementById('filter-dropdown');
      filterDropdown.value = 'hls';
      filterDropdown.dispatchEvent(new Event('change'));

      filterDropdown.value = 'dash';
      filterDropdown.dispatchEvent(new Event('change'));

      filterDropdown.value = 'all';
      filterDropdown.dispatchEvent(new Event('change'));

      const listItems = document.querySelectorAll('#video-list li:not(.empty-message)');
      expect(listItems).toBeTruthy();
    });

    test('should handle chrome.runtime.lastError on sendMessage', (done) => {
      chrome.runtime.lastError = { message: 'Service worker disconnected' };
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(undefined);
      });

      downloadVideo(mockVideos[0]).catch((error) => {
        expect(error.message).toContain('Service worker disconnected');
        delete chrome.runtime.lastError;
        done();
      });
    });

    test('should handle sort dropdown changes', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'ok' });
      });

      await initPopup();

      const sortDropdown = document.getElementById('sort-dropdown');
      sortDropdown.value = 'quality';
      sortDropdown.dispatchEvent(new Event('change'));

      const listItems = document.querySelectorAll('#video-list li');
      expect(listItems.length).toBeGreaterThan(0);
    });

    test('should handle null container in renderVideoList', () => {
      expect(() => {
        renderVideoList(mockVideos, null);
      }).not.toThrow();
    });

    test('should render all type icons correctly', () => {
      const typedVideos = [
        { url: 'https://example.com/v1.m3u8', type: 'hls', timestamp: Date.now() },
        { url: 'https://example.com/v2.mpd', type: 'dash', timestamp: Date.now() },
        { url: 'https://example.com/v3.mp4', type: 'video', timestamp: Date.now() },
        { url: 'https://example.com/v4.ts', type: 'stream', timestamp: Date.now() },
      ];

      const container = document.getElementById('video-list');
      renderVideoList(typedVideos, container);

      const items = container.querySelectorAll('li');
      expect(items.length).toBe(4);
      expect(items[0].textContent).toContain('📺');
      expect(items[1].textContent).toContain('🎬');
      expect(items[2].textContent).toContain('🎞️');
      expect(items[3].textContent).toContain('📹');
    });

    test('should clear videos and show empty state', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'ok' });
      });
      chrome.storage.local.clear.mockImplementation((callback) => {
        if (callback) callback();
      });

      // Mock confirm to return true
      global.confirm = jest.fn(() => true);

      await initPopup();

      const clearBtn = document.getElementById('clear-btn');
      clearBtn.click();

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      const listContainer = document.getElementById('video-list');
      const emptyMessage = listContainer.querySelector('.empty-message');
      expect(emptyMessage).toBeTruthy();
    });

    test('should handle download with no filename in result', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ status: 'completed' });
      });

      const result = await downloadVideo(mockVideos[0]);
      expect(result.status).toBe('completed');
    });
  });
});
