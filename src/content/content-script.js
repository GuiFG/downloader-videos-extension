/* global chrome */

/**
 * Content Script
 *
 * Responsabilidades:
 * - Escanear DOM por tags <video>
 * - Extrair URLs de vídeos
 * - Comunicar com Service Worker
 * - Detectar vídeos adicionados dinamicamente
 */

import { isMediaURL, cleanUrl } from '../utils/media-extensions.js';

// Debug flag
const DEBUG_CONTENT_SCRIPT = false;

/**
 * Log utility for debugging
 */
function log(...args) {
  if (DEBUG_CONTENT_SCRIPT) {
    console.log('[ContentScript]', ...args);
  }
}

/**
 * Finds all video elements in the DOM and extracts their URLs
 * Supports:
 * - Direct <video src="..."> attributes
 * - Nested <source src="..."> children
 * - Custom data-video-url and data-stream-url attributes
 * - Same-origin iframes
 * - Shadow DOM traversal
 *
 * @returns {Array} Array of objects with {url, source: 'dom'}
 */
export function findVideoElements() {
  const discoveredVideos = [];
  const seenUrls = new Set(); // Track normalized URLs for deduplication

  /**
   * Recursively traverse shadow DOM and collect video URLs
   */
  function traverseWithShadowDOM(root) {
    const videos = [];

    // Find all <video> elements
    const videoElements = root.querySelectorAll('video');
    videoElements.forEach((videoElement) => {
      // Extract from direct src attribute
      if (videoElement.src && isMediaURL(videoElement.src)) {
        videos.push(videoElement.src);
      }

      // Extract from nested <source> children
      const sourceElements = videoElement.querySelectorAll('source');
      sourceElements.forEach((sourceElement) => {
        if (sourceElement.src && isMediaURL(sourceElement.src)) {
          videos.push(sourceElement.src);
        }
      });
    });

    // Extract from custom data attributes
    const dataVideoElements = root.querySelectorAll('[data-video-url]');
    dataVideoElements.forEach((el) => {
      const url = el.getAttribute('data-video-url');
      if (url && isMediaURL(url)) {
        videos.push(url);
      }
    });

    const dataStreamElements = root.querySelectorAll('[data-stream-url]');
    dataStreamElements.forEach((el) => {
      const url = el.getAttribute('data-stream-url');
      if (url && isMediaURL(url)) {
        videos.push(url);
      }
    });

    // Traverse shadow DOM
    const allElements = root.querySelectorAll('*');
    allElements.forEach((el) => {
      if (el.shadowRoot) {
        videos.push(...traverseWithShadowDOM(el.shadowRoot));
      }
    });

    return videos;
  }

  // Traverse main document
  const videoUrls = traverseWithShadowDOM(document);

  // Traverse same-origin iframes
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc) {
        const iframeVideos = traverseWithShadowDOM(iframeDoc);
        videoUrls.push(...iframeVideos);
      }
    } catch (e) {
      // Cross-origin iframe - skip
      log('Skipping cross-origin iframe:', e.message);
    }
  });

  // Deduplicate URLs
  videoUrls.forEach((url) => {
    if (url) {
      const normalizedUrl = cleanUrl(url);
      if (normalizedUrl && !seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        discoveredVideos.push({
          url,
          source: 'dom',
        });
      }
    }
  });

  log('Found videos:', discoveredVideos);
  return discoveredVideos;
}

/**
 * Sends discovered videos to the Service Worker
 */
async function sendVideosToServiceWorker(videos) {
  if (videos.length === 0) return;

  for (const video of videos) {
    try {
      await chrome.runtime.sendMessage({
        type: 'ADD_VIDEO',
        url: video.url,
        source: video.source,
      });
      log('Sent video to service worker:', video.url);
    } catch (error) {
      log('Error sending video to service worker:', error);
    }
  }
}

/**
 * Initialize the content script with MutationObserver for dynamic video elements
 */
export function initContentScript() {
  log('Initializing content script');

  // Debounce timer for MutationObserver
  let debounceTimer = null;

  // Set up MutationObserver for dynamically added elements
  const mutationObserver = new MutationObserver(() => {
    // Debounce the callback to avoid spam
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      log('MutationObserver triggered');
      const videos = findVideoElements();
      sendVideosToServiceWorker(videos);
    }, 100);
  });

  // Configure and start observing
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Scan DOM on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded triggered');
    const videos = findVideoElements();
    sendVideosToServiceWorker(videos);
  });

  // Also scan immediately if DOM is already loaded
  if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
  } else {
    // DOM is already loaded
    const videos = findVideoElements();
    sendVideosToServiceWorker(videos);
  }
}

// Auto-initialize on script load
initContentScript();
