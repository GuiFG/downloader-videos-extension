/* global chrome */

/**
 * Popup UI Logic
 *
 * Responsibilities:
 * - Display list of detected videos
 * - Allow downloading videos
 * - Show download progress
 * - Communicate with Service Worker
 */

/**
 * Fetch video list from chrome.storage.local
 * @returns {Promise<array>} Array of detected videos
 */
export async function getVideoList() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['detectedVideos'], (result) => {
      if (result && result.detectedVideos && Array.isArray(result.detectedVideos)) {
        resolve(result.detectedVideos);
      } else {
        resolve([]);
      }
    });
  });
}

/**
 * Filter videos by type
 * @param {array} videos - Array of videos to filter
 * @param {string} type - Type to filter by ('all', 'hls', 'dash', 'video')
 * @returns {array} Filtered videos
 */
export function filterVideos(videos, type) {
  if (type === 'all' || !type) {
    return videos;
  }
  return videos.filter(v => v.type === type);
}

/**
 * Sort videos by specified criterion
 * @param {array} videos - Array of videos to sort
 * @param {string} criterion - Sort criterion ('recency', 'quality')
 * @returns {array} Sorted videos (new array)
 */
export function sortVideos(videos, criterion) {
  const sorted = [...videos];

  if (criterion === 'recency') {
    // Sort by timestamp, newest first
    sorted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } else if (criterion === 'quality') {
    // Sort by quality if available (placeholder for future enhancement)
    // Currently maintains relative order
  }

  return sorted;
}

/**
 * Get type icon emoji for video
 * @param {string} type - Video type
 * @returns {string} Icon emoji
 */
function getTypeIcon(type) {
  switch (type) {
    case 'hls':
      return '📺';
    case 'dash':
      return '🎬';
    case 'video':
      return '🎞️';
    default:
      return '📹';
  }
}

/**
 * Get human-readable type label
 * @param {string} type - Video type
 * @returns {string} Type label
 */
function getTypeLabel(type) {
  switch (type) {
    case 'hls':
      return 'HLS';
    case 'dash':
      return 'DASH';
    case 'video':
      return 'MP4';
    default:
      return type.toUpperCase();
  }
}

/**
 * Format date for display
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} Formatted date
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Render video list in DOM
 * @param {array} videos - Array of videos to render
 * @param {Element} container - Container element to render into
 * @param {object} options - Rendering options
 */
export function renderVideoList(videos, container, options = {}) {
  if (!container) return;

  container.innerHTML = '';

  if (!videos || videos.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-message';
    emptyDiv.textContent = 'No videos detected yet. Visit a website with video content.';
    container.appendChild(emptyDiv);
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'video-list';

  videos.forEach((video, _index) => {
    const li = document.createElement('li');
    li.className = 'video-item';
    li.dataset.url = video.url;

    const icon = getTypeIcon(video.type);
    const typeLabel = getTypeLabel(video.type);

    // Create info section
    const infoDiv = document.createElement('div');
    infoDiv.className = 'video-info';

    const urlDiv = document.createElement('div');
    urlDiv.className = 'video-url';
    // Extract just the filename from URL
    const urlObj = new URL(video.url);
    const displayUrl = urlObj.pathname.split('/').pop() || video.url.substring(0, 50);
    urlDiv.textContent = `${icon} ${displayUrl}`;
    urlDiv.title = video.url;

    const typeDiv = document.createElement('div');
    typeDiv.className = 'video-type';
    typeDiv.textContent = `Type: ${typeLabel}`;

    const dateDiv = document.createElement('div');
    dateDiv.className = 'video-date';
    dateDiv.textContent = `Detected: ${formatDate(video.timestamp)}`;

    infoDiv.appendChild(urlDiv);
    infoDiv.appendChild(typeDiv);
    infoDiv.appendChild(dateDiv);

    // Create download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn download-btn';
    downloadBtn.textContent = 'Download';

    downloadBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (options.onDownload) {
        options.onDownload(video);
      }
    });

    li.appendChild(infoDiv);
    li.appendChild(downloadBtn);
    ul.appendChild(li);
  });

  container.appendChild(ul);
}

/**
 * Download a video via service worker
 * @param {object} video - Video object to download
 * @param {object} options - Download options (onProgress, etc.)
 * @returns {Promise<object>} Download result
 */
export async function downloadVideo(video, options = {}) {
  return new Promise((resolve, reject) => {
    if (!video || !video.url) {
      reject(new Error('Invalid video data'));
      return;
    }

    const message = {
      type: 'DOWNLOAD_VIDEO',
      video,
    };

    // Add progress callback if provided
    if (options.onProgress) {
      message.onProgress = options.onProgress;
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response || {});
      }
    });
  });
}

/**
 * Clear all videos from storage
 * @returns {Promise<void>}
 */
export async function clearAllVideos() {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      resolve();
    });
  });
}

/**
 * Update status message in UI
 * @param {string} message - Status message
 * @param {string} type - Status type ('info', 'success', 'error')
 */
function updateStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

/**
 * Update progress bar
 * @param {number} percent - Progress percentage (0-100)
 */
function updateProgress(percent) {
  const progressEl = document.getElementById('progress');
  if (!progressEl) return;

  const value = Math.max(0, Math.min(100, percent));
  progressEl.value = value;
}

/**
 * Initialize popup UI
 * Fetch videos, render list, attach event listeners
 */
export async function initPopup() {
  try {
    updateStatus('Loading videos...', 'info');

    // Fetch video list
    const videos = await getVideoList();
    const listContainer = document.getElementById('video-list');

    // Initial render
    const sorted = sortVideos(videos, 'recency');
    renderVideoList(sorted, listContainer, {
      onDownload: handleDownloadClick,
    });

    updateStatus(`${videos.length} video(s) detected`, 'info');

    // Setup filter dropdown
    const filterDropdown = document.getElementById('filter-dropdown');
    if (filterDropdown) {
      filterDropdown.addEventListener('change', async (e) => {
        const filterType = e.target.value;
        const allVideos = await getVideoList();
        const filtered = filterVideos(allVideos, filterType);
        const sorted2 = sortVideos(filtered, 'recency');
        renderVideoList(sorted2, listContainer, {
          onDownload: handleDownloadClick,
        });
      });
    }

    // Setup sort dropdown
    const sortDropdown = document.getElementById('sort-dropdown');
    if (sortDropdown) {
      sortDropdown.addEventListener('change', async (e) => {
        const sortCriterion = e.target.value;
        const filterDropdown2 = document.getElementById('filter-dropdown');
        const filterType = filterDropdown2 ? filterDropdown2.value : 'all';

        const allVideos = await getVideoList();
        const filtered = filterVideos(allVideos, filterType);
        const sorted3 = sortVideos(filtered, sortCriterion);
        renderVideoList(sorted3, listContainer, {
          onDownload: handleDownloadClick,
        });
      });
    }

    // Setup clear button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all videos?')) {
          await clearAllVideos();
          renderVideoList([], listContainer);
          updateStatus('All videos cleared', 'success');
        }
      });
    }

    // Setup refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        updateStatus('Refreshing...', 'info');
        const freshVideos = await getVideoList();
        const sorted4 = sortVideos(freshVideos, 'recency');
        renderVideoList(sorted4, listContainer, {
          onDownload: handleDownloadClick,
        });
        updateStatus(`${freshVideos.length} video(s) detected`, 'info');
      });
    }
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    updateStatus(`Error: ${error.message}`, 'error');
  }
}

/**
 * Handle download button click
 * @param {object} video - Video to download
 */
async function handleDownloadClick(video) {
  try {
    updateStatus('Starting download...', 'info');
    updateProgress(0);

    const result = await downloadVideo(video, {
      onProgress: (progress) => {
        if (typeof progress === 'number') {
          updateProgress(progress);
        } else if (progress && progress.percent) {
          updateProgress(progress.percent);
        }
      },
    });

    if (result.error) {
      updateStatus(`Download failed: ${result.error}`, 'error');
      updateProgress(0);
    } else {
      updateStatus(`✓ Download completed: ${result.filename || 'video'}`, 'success');
      updateProgress(100);
    }
  } catch (error) {
    console.error('Download error:', error);
    updateStatus(`Download error: ${error.message}`, 'error');
    updateProgress(0);
  }
}

// Auto-initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup().catch(error => {
    console.error('Failed to initialize popup:', error);
  });
}
