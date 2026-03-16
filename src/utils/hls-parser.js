/**
 * HLS Playlist Parser
 * Parses HLS (M3U8) playlists and extracts stream information
 * 
 * Features:
 * - Parse simple and variant playlists
 * - Extract segment URLs and metadata
 * - Support encryption (EXT-X-KEY)
 * - Resolve relative and absolute URLs
 * - Quality selection for variant playlists
 * - Debug logging
 */

// Debug flag for logging
const DEBUG = process.env.DEBUG_HLS_PARSER === 'true';

const log = (message, data) => {
  if (DEBUG) {
    console.log(`[HLS Parser] ${message}`, data || '');
  }
};

/**
 * Parse an HLS playlist and extract stream information
 * @param {string} m3u8Content - Raw M3U8 file content
 * @param {string} baseUrl - Base URL for resolving relative URLs
 * @returns {object} Parsed playlist with streams, variants, metadata
 */
export function parseHLS(m3u8Content, baseUrl) {
  log('Starting HLS parse', { baseUrl, contentLength: m3u8Content.length });
  
  const lines = m3u8Content.split('\n').map(line => line.trim()).filter(line => line);
  
  const result = {
    streams: [],
    variants: [],
    duration: 0,
    keyInfo: null,
    extDuration: null,
  };

  let currentExtInf = null;
  let isVariantPlaylist = false;
  let totalDuration = 0;
  let currentStreamInf = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line) {
      continue;
    }

    // Skip comments
    if (line.startsWith('#') && !line.toUpperCase().startsWith('#EXT')) {
      log('Skipping comment', line);
      continue;
    }

    // Detect header
    if (line.toUpperCase() === '#EXTM3U') {
      log('Found M3U header');
      continue;
    }

    // Parse EXT-X-DURATION
    if (line.toUpperCase().startsWith('#EXT-X-DURATION:')) {
      const durationStr = line.split(':')[1];
      result.extDuration = parseFloat(durationStr);
      log('Found EXT-X-DURATION', { duration: result.extDuration });
      continue;
    }

    // Parse EXT-X-STREAM-INF (variant playlist indicator)
    if (line.toUpperCase().startsWith('#EXT-X-STREAM-INF:')) {
      log('Found variant stream info');
      isVariantPlaylist = true;
      currentStreamInf = parseStreamInf(line);
      continue;
    }

    // Parse EXT-X-KEY (encryption info)
    if (line.toUpperCase().startsWith('#EXT-X-KEY:')) {
      log('Found encryption key info');
      result.keyInfo = parseKeyInfo(line, baseUrl);
      continue;
    }

    // Parse EXTINF (segment duration)
    if (line.toUpperCase().startsWith('#EXTINF:')) {
      const durationStr = line.split(':')[1].split(',')[0];
      currentExtInf = parseFloat(durationStr);
      totalDuration += currentExtInf;
      log('Found segment with duration', { duration: currentExtInf });
      continue;
    }

    // Skip other tags
    if (line.startsWith('#')) {
      log('Skipping unknown tag', line);
      continue;
    }

    // This should be a URL (segment or variant)
    const url = resolveUrl(line, baseUrl);
    log('Processing URL', { original: line, resolved: url });

    if (isVariantPlaylist && currentStreamInf) {
      // It's a variant playlist URL
      currentStreamInf.url = url;
      result.variants.push(currentStreamInf);
      log('Added variant stream', currentStreamInf);
      currentStreamInf = null;
    } else if (currentExtInf !== null) {
      // It's a regular segment URL
      result.streams.push({
        url,
        duration: currentExtInf,
      });
      log('Added segment stream', { url, duration: currentExtInf });
      currentExtInf = null;
    }
  }

  // Calculate total duration if not explicitly set
  if (!result.extDuration) {
    result.duration = totalDuration;
  } else {
    result.duration = result.extDuration;
  }

  log('Parse complete', {
    streamsCount: result.streams.length,
    variantsCount: result.variants.length,
    totalDuration: result.duration,
    hasEncryption: !!result.keyInfo,
  });

  return result;
}

/**
 * Parse EXT-X-STREAM-INF tag to extract quality information
 * @param {string} line - The EXT-X-STREAM-INF tag line
 * @returns {object} Parsed stream info
 */
function parseStreamInf(line) {
  const info = {
    bandwidth: null,
    resolution: null,
  };

  // Extract attributes: BANDWIDTH=5000000,RESOLUTION=1920x1080
  const attributes = line.substring(line.indexOf(':') + 1);
  
  const bandwidthMatch = attributes.match(/BANDWIDTH=(\d+)/);
  if (bandwidthMatch) {
    info.bandwidth = parseInt(bandwidthMatch[1], 10);
  }

  const resolutionMatch = attributes.match(/RESOLUTION=([\d\w×x]+)/);
  if (resolutionMatch) {
    info.resolution = resolutionMatch[1];
  }

  return info;
}

/**
 * Parse EXT-X-KEY tag to extract encryption information
 * @param {string} line - The EXT-X-KEY tag line
 * @param {string} baseUrl - Base URL for resolving key URI
 * @returns {object} Parsed key info
 */
function parseKeyInfo(line, baseUrl) {
  const keyInfo = {
    method: null,
    uri: null,
  };

  // Extract attributes: METHOD=AES-128,URI="https://..."
  const attributes = line.substring(line.indexOf(':') + 1);

  const methodMatch = attributes.match(/METHOD=([\w\-0-9]+)/);
  if (methodMatch) {
    keyInfo.method = methodMatch[1];
  }

  const uriMatch = attributes.match(/URI="([^"]+)"/);
  if (uriMatch) {
    keyInfo.uri = resolveUrl(uriMatch[1], baseUrl);
  }

  return keyInfo;
}

/**
 * Resolve a URL (relative or absolute) against a base URL
 * Handles various URL formats and edge cases
 * @param {string} url - The URL to resolve
 * @param {string} baseUrl - The base URL
 * @returns {string} Absolute URL
 */
function resolveUrl(url, baseUrl) {
  // Validate inputs
  if (!url || typeof url !== 'string') {
    log('Invalid URL to resolve', { url });
    return '';
  }

  if (!baseUrl || typeof baseUrl !== 'string') {
    log('Invalid baseUrl', { baseUrl });
    return url;
  }

  try {
    // If it's already an absolute URL, return as-is
    if (url.match(/^https?:\/\//i)) {
      log('URL is already absolute', { url });
      return url;
    }

    // Use URL API to resolve relative URLs
    const resolved = new URL(url, baseUrl);
    log('Resolved URL', { from: url, to: resolved.href });
    return resolved.href;
  } catch (error) {
    log('URL resolution failed, using fallback', { url, baseUrl, error: error.message });
    
    // Fallback: simple concatenation with path normalization
    let result = baseUrl;
    
    // Ensure baseUrl ends with /
    if (!result.endsWith('/')) {
      const lastSlash = result.lastIndexOf('/');
      if (lastSlash > 'https://'.length) {
        result = result.substring(0, lastSlash + 1);
      } else {
        result += '/';
      }
    }

    // Handle ../ and ./
    if (url.startsWith('../')) {
      // Go up one directory
      result = result.substring(0, result.lastIndexOf('/', result.length - 2) + 1);
      result += url.substring(3);
    } else if (url.startsWith('./')) {
      result += url.substring(2);
    } else if (url.startsWith('/')) {
      // Absolute path - extract domain and apply path
      const domainMatch = baseUrl.match(/^https?:\/\/[^/]+/);
      if (domainMatch) {
        result = domainMatch[0] + url;
      } else {
        result += url;
      }
    } else {
      result += url;
    }

    log('Fallback URL resolution', { result });
    return result;
  }
}

/**
 * Select a quality variant from available options
 * Supports multiple preference types:
 * - 'highest' or 'lowest': by bandwidth
 * - '720p', '1080p', etc.: by resolution
 * - number: closest bandwidth to target
 * @param {array} variants - Array of variant objects with bandwidth/resolution
 * @param {string|number} preference - Quality preference
 * @returns {object} Selected variant
 */
export function selectQuality(variants, preference = 'highest') {
  log('Selecting quality', { variantsCount: variants.length, preference });
  
  if (!variants || variants.length === 0) {
    log('No variants available');
    return null;
  }

  // Default: return first
  if (!preference) {
    log('No preference specified, returning first variant');
    return variants[0];
  }

  // Highest quality (by bandwidth)
  if (preference === 'highest') {
    const selected = variants.reduce((prev, current) => {
      const prevBandwidth = prev.bandwidth || 0;
      const currBandwidth = current.bandwidth || 0;
      return currBandwidth > prevBandwidth ? current : prev;
    });
    log('Selected highest quality', { bandwidth: selected.bandwidth, resolution: selected.resolution });
    return selected;
  }

  // Lowest quality (by bandwidth)
  if (preference === 'lowest') {
    const selected = variants.reduce((prev, current) => {
      const prevBandwidth = prev.bandwidth || Infinity;
      const currBandwidth = current.bandwidth || Infinity;
      return currBandwidth < prevBandwidth ? current : prev;
    });
    log('Selected lowest quality', { bandwidth: selected.bandwidth, resolution: selected.resolution });
    return selected;
  }

  // Resolution preference (e.g., '720p', '1080p')
  if (typeof preference === 'string' && preference.match(/\d+p/i)) {
    const resolutionNum = parseInt(preference, 10);
    const found = variants.find(v => {
      if (!v.resolution) return false;
      // Extract height from "1280x720" format (number after 'x')
      const heightMatch = v.resolution.match(/x(\d+)/i);
      const vNum = heightMatch ? parseInt(heightMatch[1], 10) : parseInt(v.resolution, 10);
      return vNum === resolutionNum;
    });
    
    if (found) {
      log('Selected by resolution', { resolution: found.resolution });
      return found;
    }
    
    // If exact match not found, find closest
    const closest = variants.reduce((prev, current) => {
      const prevHeightMatch = prev.resolution ? prev.resolution.match(/x(\d+)/i) : null;
      const currHeightMatch = current.resolution ? current.resolution.match(/x(\d+)/i) : null;
      const prevRes = prevHeightMatch ? parseInt(prevHeightMatch[1], 10) : 0;
      const currRes = currHeightMatch ? parseInt(currHeightMatch[1], 10) : 0;
      const prevDiff = Math.abs(prevRes - resolutionNum);
      const currDiff = Math.abs(currRes - resolutionNum);
      return currDiff < prevDiff ? current : prev;
    });
    
    log('No exact resolution match, selected closest', { requested: preference, selected: closest.resolution });
    return closest;
  }

  // Bandwidth preference (numeric)
  if (typeof preference === 'number') {
    const selected = variants.reduce((prev, current) => {
      const prevDiff = Math.abs((prev.bandwidth || 0) - preference);
      const currDiff = Math.abs((current.bandwidth || 0) - preference);
      return currDiff < prevDiff ? current : prev;
    });
    log('Selected by bandwidth', { requested: preference, selected: selected.bandwidth });
    return selected;
  }

  log('No matching preference, returning first variant');
  return variants[0];
}

/**
 * Get segment URLs from a parsed HLS result
 * Useful for directly accessing all segments to download
 * @param {object} parsed - Result from parseHLS()
 * @returns {array} Array of segment URLs
 */
export function getSegmentUrls(parsed) {
  if (!parsed || !parsed.streams) return [];
  return parsed.streams.map(stream => stream.url);
}

/**
 * Get total duration of parsed HLS
 * @param {object} parsed - Result from parseHLS()
 * @returns {number} Total duration in seconds
 */
export function getTotalDuration(parsed) {
  if (!parsed) return 0;
  return parsed.duration || 0;
}

/**
 * Check if HLS is encrypted
 * @param {object} parsed - Result from parseHLS()
 * @returns {boolean} True if encrypted
 */
export function isEncrypted(parsed) {
  if (!parsed) return false;
  return !!parsed.keyInfo;
}

/**
 * Get available resolutions from variant playlists
 * @param {object} parsed - Result from parseHLS()
 * @returns {array} Array of resolution strings (e.g., ['1920x1080', '1280x720'])
 */
export function getAvailableResolutions(parsed) {
  if (!parsed || !parsed.variants) return [];
  return parsed.variants
    .map(v => v.resolution)
    .filter((res, idx, arr) => res && arr.indexOf(res) === idx); // unique
}
