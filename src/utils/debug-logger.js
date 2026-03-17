/**
 * Debug Logger Utility
 *
 * Provides structured debug logging for video detection with:
 * - Conditional logging based on DEBUG_VIDEO_DETECTION environment variable
 * - Timestamps for each log entry
 * - Source identification (service worker or content script)
 * - Detection method tracking (extension, pattern, Content-Type)
 * - Detailed attempt/failure logging
 */

// Check if debug mode is enabled via environment variable
const DEBUG_VIDEO_DETECTION = process.env.DEBUG_VIDEO_DETECTION === 'true';

/**
 * Format timestamp in ISO format
 * @returns {string} Current timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Log detection attempt (which methods were tried)
 * @param {string} url - The URL being detected
 * @param {string} source - Source of detection ('service-worker' or 'content-script')
 * @param {object} attempts - Object describing which methods were tried and results
 */
export function logDetectionAttempt(url, source, attempts) {
  if (!DEBUG_VIDEO_DETECTION) return;

  const timestamp = getTimestamp();
  const attemptDetails = [];

  // Log extension detection attempt
  if (attempts.extension !== undefined) {
    attemptDetails.push(
      `extension: ${attempts.extension.matched ? '✓ matched' : `✗ failed (${attempts.extension.reason})`}`
    );
  }

  // Log pattern detection attempt
  if (attempts.pattern !== undefined) {
    attemptDetails.push(
      `pattern: ${attempts.pattern.matched ? '✓ matched' : `✗ failed (${attempts.pattern.reason})`}`
    );
  }

  // Log Content-Type detection attempt
  if (attempts.contentType !== undefined) {
    attemptDetails.push(
      `content-type: ${attempts.contentType.matched ? '✓ matched' : `✗ failed (${attempts.contentType.reason})`}`
    );
  }

  console.log(
    `[${timestamp}] [${source}] Video Detection Attempts: ${url}`,
    attemptDetails
  );
}

/**
 * Log successful video detection
 * @param {string} url - The URL that was detected
 * @param {string} type - Media type detected ('video', 'audio', 'stream', 'hls', 'dash', etc)
 * @param {string} detectionMethod - Which method matched ('extension', 'pattern', 'content-type')
 * @param {string} source - Source of detection ('service-worker' or 'content-script')
 */
export function logDetectionSuccess(url, type, detectionMethod, source) {
  if (!DEBUG_VIDEO_DETECTION) return;

  const timestamp = getTimestamp();
  console.log(
    `[${timestamp}] [${source}] ✓ Video Detected: ${url}`,
    {
      type,
      method: detectionMethod,
    }
  );
}

/**
 * Log detection failure (no method matched)
 * @param {string} url - The URL that was not detected
 * @param {string} source - Source of detection attempt
 * @param {string} reason - Why detection failed
 */
export function logDetectionFailure(url, source, reason = 'no matching method') {
  if (!DEBUG_VIDEO_DETECTION) return;

  const timestamp = getTimestamp();
  console.log(
    `[${timestamp}] [${source}] ✗ Detection Failed: ${url}`,
    { reason }
  );
}

/**
 * Log debug information about detection methods
 * @param {string} message - Debug message
 * @param {object} data - Additional data to log
 * @param {string} source - Source of the log
 */
export function logDebug(message, data, source = 'video-detection') {
  if (!DEBUG_VIDEO_DETECTION) return;

  const timestamp = getTimestamp();
  console.log(
    `[${timestamp}] [${source}] ${message}`,
    data || ''
  );
}

/**
 * Get debug status
 * @returns {boolean} Whether debug logging is enabled
 */
export function isDebugEnabled() {
  return DEBUG_VIDEO_DETECTION;
}

export default {
  logDetectionAttempt,
  logDetectionSuccess,
  logDetectionFailure,
  logDebug,
  isDebugEnabled,
};
