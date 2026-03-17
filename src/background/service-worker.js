/* global chrome */

/**
 * Service Worker - Background Script
 *
 * Responsabilidades:
 * - Interceptar requisições de rede (vídeos HLS/DASH/MP4)
 * - Armazenar URLs de vídeos detectados
 * - Comunicar com Content Script e Popup
 * - Gerenciar downloads
 */

import { isMediaURL, getMediaType, detectMediaTypeByContentType } from '../utils/media-extensions.js';
import { downloadFragments } from '../utils/fragment-downloader.js';
import { parseHLS } from '../utils/hls-parser.js';
import { parseDALE } from '../utils/dash-parser.js';
import { concatenateFragments } from '../utils/ffmpeg-concatenator.js';
import {
  downloadBlob,
  generateFilename,
} from '../utils/download-manager.js';

// Debug flag for logging
const DEBUG_SERVICE_WORKER = process.env.DEBUG_SERVICE_WORKER === 'true';

const log = (message, data) => {
  if (DEBUG_SERVICE_WORKER) {
    console.log(`[Service Worker] ${message}`, data || '');
  }
};

// In-memory cache of detected videos
let detectedVideos = [];

/**
 * Normalize URL for deduplication (remove query params and fragments)
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
export function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';

  // Remove query parameters and fragments
  const normalized = url.split('?')[0].split('#')[0];

  // Convert domain to lowercase for case-insensitive comparison
  try {
    const urlObj = new URL(normalized);
    urlObj.host = urlObj.host.toLowerCase();
    return urlObj.toString();
  } catch {
    // Fallback for invalid URLs
    return normalized.toLowerCase();
  }
}

/**
 * Detect if a URL is a video and classify it
 * @param {string} url - URL to check
 * @param {number} tabId - ID of the tab that made the request
 * @returns {object|null} Video object or null if not a media URL
 */
export function detectVideoUrl(url, tabId) {
  if (!isMediaURL(url)) {
    return null;
  }

  const type = getMediaType(url);
  if (type === 'unknown') {
    return null;
  }

  return {
    url,
    type,
    tabId,
    timestamp: Date.now(),
  };
}

/**
 * Check if video already exists in collection (by normalized URL)
 * @param {string} url - URL to check
 * @returns {number} Index of existing video or -1 if not found
 */
function findVideoByNormalizedUrl(url) {
  const normalized = normalizeUrl(url);
  return detectedVideos.findIndex(v => normalizeUrl(v.url) === normalized);
}

/**
 * Add or update video in detected list
 * @param {object} video - Video object with url, type, tabId, timestamp
 */
function addVideoToCollection(video) {
  const existingIndex = findVideoByNormalizedUrl(video.url);

  if (existingIndex >= 0) {
    // Update timestamp for duplicate (keep newer one)
    if (video.timestamp > detectedVideos[existingIndex].timestamp) {
      detectedVideos[existingIndex] = video;
    }
  } else {
    // Add new video
    detectedVideos.push(video);
  }
}

/**
 * Save detected videos to chrome storage
 */
async function saveVideos() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ detectedVideos }, () => {
      log('Videos saved to storage', { count: detectedVideos.length });
      resolve();
    });
  });
}

/**
 * Get all detected videos from storage
 * @returns {Promise<array>} Array of detected videos
 */
export async function getDetectedVideos() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['detectedVideos'], (result) => {
      if (result && result.detectedVideos) {
        detectedVideos = result.detectedVideos;
        resolve(detectedVideos);
      } else {
        detectedVideos = [];
        resolve([]);
      }
    });
  });
}

/**
 * Clear all detected videos
 */
export async function clearDetectedVideos() {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      detectedVideos = [];
      log('All videos cleared');
      // Broadcast clear notification to all tabs
      broadcastUpdate({ type: 'VIDEOS_CLEARED' });
      resolve();
    });
  });
}

/**
 * Broadcast update to all extension components
 * @param {object} message - Message to broadcast
 */
function broadcastUpdate(message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { ...message, source: 'service-worker' }).catch(() => {
        // Ignore errors for tabs that don't have content script
      });
    });
  });
}

/**
 * Handle download of a video
 * @param {object} video - Video object with url, type
 * @param {function} onProgress - Optional progress callback
 * @returns {Promise<object>} Download result
 */
export async function downloadVideo(video, onProgress) {
  try {
    if (!video || !video.url || !video.type) {
      log('Download failed: invalid video data');
      throw new Error('Invalid video data');
    }

    log('Starting video download', { url: video.url, type: video.type });

    // Validate URL
    try {
      new URL(video.url);
    } catch {
      throw new Error('Invalid video URL');
    }

    const filename = generateFilename(video.url, video.type, '720p');
    let blob;

    if (video.type === 'hls') {
      blob = await downloadHLS(video.url, onProgress);
    } else if (video.type === 'dash') {
      blob = await downloadDALE(video.url, onProgress);
    } else if (video.type === 'video') {
      blob = await downloadSimpleVideo(video.url, onProgress);
    } else {
      throw new Error(`Unsupported video type: ${video.type}`);
    }

    // Download the blob
    await downloadBlob(blob, filename, { onProgress });

    log('Video download completed', { filename });
    return { status: 'completed', filename };
  } catch (error) {
    log('Video download failed', { error: error.message });
    return { status: 'error', error: error.message };
  }
}

/**
 * Download HLS stream
 * @param {string} url - M3U8 playlist URL
 * @param {function} onProgress - Progress callback
 * @returns {Promise<Blob>} Concatenated video blob
 */
async function downloadHLS(url, onProgress) {
  log('Downloading HLS', { url });

  // Fetch M3U8
  const response = await fetch(url);
  const m3u8Content = await response.text();

  // Parse playlist
  const baseUrl = url.split('?')[0].split('#')[0];
  const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  const parsed = parseHLS(m3u8Content, basePath);

  if (parsed.variants && parsed.variants.length > 0) {
    // Use highest quality variant
    const highestQuality = parsed.variants.reduce((prev, current) =>
      (current.bandwidth > prev.bandwidth) ? current : prev
    );
    return downloadHLS(highestQuality.url, onProgress);
  }

  // Download segments
  const segmentUrls = parsed.streams.map(s => {
    if (s.url.startsWith('http')) return s.url;
    return basePath + s.url;
  });

  const { blobs } = await downloadFragments(segmentUrls, {
    maxParallel: 6,
    onProgress,
  });

  // Concatenate fragments
  const outputBlob = await concatenateFragments(blobs, 'mp4', { onProgress });
  return outputBlob;
}

/**
 * Download DASH stream
 * @param {string} url - MPD manifest URL
 * @param {function} onProgress - Progress callback
 * @returns {Promise<Blob>} Concatenated video blob
 */
async function downloadDALE(url, onProgress) {
  log('Downloading DASH', { url });

  // Fetch MPD
  const response = await fetch(url);
  const mpdContent = await response.text();

  // Parse manifest
  const baseUrl = url.split('?')[0].split('#')[0];
  const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  const parsed = parseDALE(mpdContent, basePath);

  if (!parsed || !parsed.segments || parsed.segments.length === 0) {
    throw new Error('No segments found in DASH manifest');
  }

  // Download segments
  const segmentUrls = parsed.segments.map(s => {
    if (s.url.startsWith('http')) return s.url;
    return basePath + s.url;
  });

  const { blobs } = await downloadFragments(segmentUrls, {
    maxParallel: 6,
    onProgress,
  });

  // Concatenate fragments
  const outputBlob = await concatenateFragments(blobs, 'mp4', { onProgress });
  return outputBlob;
}

/**
 * Download simple video file
 * @param {string} url - Direct video URL
 * @param {function} onProgress - Progress callback
 * @returns {Promise<Blob>} Video blob
 */
async function downloadSimpleVideo(url, onProgress) {
  log('Downloading simple video', { url });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  const reader = response.body.getReader();
  const chunks = [];
  let downloadedSize = 0;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      downloadedSize += value.length;

      if (onProgress && contentLength) {
        const percent = Math.round((downloadedSize / contentLength) * 100);
        onProgress({ current: downloadedSize, total: contentLength, percent });
      }
    }
  } finally {
    reader.releaseLock();
  }

  const blob = new Blob(chunks, { type: 'video/mp4' });
  return blob;
}

/**
 * Handle incoming messages from popup and content script
 * @param {object} message - Message object
 * @param {object} sender - Sender info
 * @returns {Promise<object>} Response
 */
export async function handleMessage(message, sender) {
  log('Message received', { type: message.type, sender: sender?.url });

  try {
    switch (message.type) {
      case 'GET_VIDEOS':
        return { videos: detectedVideos };

      case 'ADD_VIDEO': {
        const video = message.video;
        if (!video || !video.url) {
          return { error: 'Invalid video data' };
        }
        addVideoToCollection(video);
        await saveVideos();
        // Broadcast to all tabs
        broadcastUpdate({ type: 'VIDEOS_UPDATED', videos: detectedVideos });
        return { success: true, videos: detectedVideos };
      }

      case 'CLEAR_VIDEOS': {
        await clearDetectedVideos();
        return { success: true };
      }

      case 'DOWNLOAD_VIDEO': {
        const video = message.video;
        if (!video || !video.url) {
          return { status: 'error', error: 'Invalid video data' };
        }
        const result = await downloadVideo(video, message.onProgress);
        return result;
      }

      default:
        return { error: `Unknown message type: ${message.type}` };
    }
  } catch (error) {
    log('Error handling message', { error: error.message });
    return { error: error.message };
  }
}

/**
 * Handle network request interception
 * @param {object} details - Request details
 * @returns {object} Cancel/redirect details
 */
function onBeforeRequest(details) {
  const { url, tabId } = details;

  // Detect video URLs
  const video = detectVideoUrl(url, tabId);
  if (video) {
    log('Video URL detected', { url, type: video.type });
    addVideoToCollection(video);
    // Save and broadcast immediately
    saveVideos();
    broadcastUpdate({ type: 'VIDEOS_UPDATED', videos: detectedVideos });
  }

  return {};
}

/**
 * Handle response headers inspection
 * @param {object} details - Request details including response headers
 * @returns {object} Empty object (no blocking)
 */
function onHeadersReceived(details) {
  const { url, tabId, responseHeaders } = details;

  // Check if video already detected
  const alreadyDetected = findVideoByNormalizedUrl(url) >= 0;
  if (alreadyDetected) {
    return {};
  }

  // Check Content-Type header
  if (!responseHeaders) {
    return {};
  }

  const contentTypeHeader = responseHeaders.find(
    header => header.name.toLowerCase() === 'content-type'
  );

  if (!contentTypeHeader) {
    return {};
  }

  const mediaType = detectMediaTypeByContentType(contentTypeHeader.value);
  if (mediaType) {
    const video = {
      url,
      type: mediaType,
      tabId,
      timestamp: Date.now(),
      detectionMethod: 'content-type',
    };
    log('Video detected by Content-Type header', { url, type: mediaType, contentType: contentTypeHeader.value });
    addVideoToCollection(video);
    // Save and broadcast immediately
    saveVideos();
    broadcastUpdate({ type: 'VIDEOS_UPDATED', videos: detectedVideos });
  }

  return {};
}

/**
 * Initialize the service worker
 */
export async function initializeServiceWorker() {
  log('Service Worker initializing');

  // Load persisted videos
  await getDetectedVideos();
  log('Loaded persisted videos', { count: detectedVideos.length });

  // Register request interceptor
  chrome.webRequest.onBeforeRequest.addListener(
    onBeforeRequest,
    { urls: ['<all_urls>'] },
    []
  );

  // Register response headers inspector for Content-Type detection
  chrome.webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    { urls: ['<all_urls>'] },
    ['responseHeaders']
  );

  // Register message handler
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(response => {
      sendResponse(response);
    }).catch(error => {
      sendResponse({ error: error.message });
    });
    // Return true to indicate we'll send response asynchronously
    return true;
  });

  log('Service Worker initialized');
}

// Auto-initialize on load
initializeServiceWorker().catch(error => {
  console.error('Failed to initialize service worker:', error);
});
