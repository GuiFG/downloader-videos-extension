/**
 * DASH Parser - Parses DASH manifests (MPD files)
 * Supports SegmentTemplate, SegmentTimeline, and multiple representations
 */

// Simple cache for parsed manifests
const manifestCache = new Map();

/**
 * Generate a simple hash of the MPD content for cache key
 * @private
 */
function generateCacheKey(mpdContent, baseUrl) {
  let hash = 0;
  for (let i = 0; i < mpdContent.length; i++) {
    const char = mpdContent.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${baseUrl}_${Math.abs(hash).toString(36)}`;
}

/**
 * Parse DASH manifest (MPD) and extract representations
 * @param {string} mpdContent - XML content of the MPD file
 * @param {string} baseUrl - Base URL for resolving relative URLs
 * @param {Object} options - Parser options
 * @returns {Object} Parsed DASH manifest structure
 */
export function parseDALE(mpdContent, baseUrl, options = {}) {
  const { cache = true, generateSegmentUrls: shouldGenerateSegmentUrls = true } = options;

  // Check cache
  if (cache) {
    const cacheKey = generateCacheKey(mpdContent, baseUrl);
    if (manifestCache.has(cacheKey)) {
      return manifestCache.get(cacheKey);
    }
  }
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(mpdContent, 'text/xml');

    // Check for parsing errors
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      console.warn('Failed to parse MPD, returning empty structure');
      return {
        representations: [],
        mediaDuration: 0,
      };
    }

    // Extract media presentation duration
    const mpdElement = xmlDoc.getElementsByTagName('MPD')[0];
    const mediaDurationStr = mpdElement?.getAttribute('mediaPresentationDuration') || 'PT0S';
    const mediaDuration = parseDurationISO8601(mediaDurationStr);
    
    // Check if this is a live stream
    const isLive = mpdElement?.getAttribute('type') === 'dynamic';

    // Extract all representations from all periods and adaptation sets
    const representations = [];
    const periods = xmlDoc.getElementsByTagName('Period');

    for (let p = 0; p < periods.length; p++) {
      const period = periods[p];
      const adaptationSets = period.getElementsByTagName('AdaptationSet');

      for (let a = 0; a < adaptationSets.length; a++) {
        const adaptationSet = adaptationSets[a];
        const mimeType = adaptationSet.getAttribute('mimeType');
        const type = mimeType?.startsWith('video') ? 'video' : 'audio';

        const reps = adaptationSet.getElementsByTagName('Representation');

        for (let r = 0; r < reps.length; r++) {
          const rep = reps[r];
          const representation = parseRepresentation(rep, type, baseUrl, adaptationSet, shouldGenerateSegmentUrls);
          representations.push(representation);
        }
      }
    }

    const result = {
      representations,
      mediaDuration,
      isLive,
    };

    // Cache the result
    if (cache) {
      const cacheKey = generateCacheKey(mpdContent, baseUrl);
      manifestCache.set(cacheKey, result);
    }

    return result;
  } catch (error) {
    console.error('Error parsing DASH manifest:', error);
    return {
      representations: [],
      mediaDuration: 0,
      isLive: false,
    };
  }
}

/**
 * Parse individual representation element
 * @private
 */
function parseRepresentation(repElement, type, baseUrl, adaptationSet, shouldGenerateSegmentUrls = true) {
  const id = repElement.getAttribute('id');
  const bandwidth = parseInt(repElement.getAttribute('bandwidth'), 10) || 0;
  const width = parseInt(repElement.getAttribute('width'), 10) || null;
  const height = parseInt(repElement.getAttribute('height'), 10) || null;
  const audioSamplingRate = repElement.getAttribute('audioSamplingRate');
  const lang = repElement.getAttribute('lang') || 'unknown';

  // Get SegmentTemplate info
  const segmentTemplate = parseSegmentTemplate(repElement);

  // Get SegmentTimeline if exists
  const segmentTimeline = parseSegmentTimeline(repElement);

  // Generate segment URLs if we have timeline and flag is true
  let segmentUrls = [];
  if (shouldGenerateSegmentUrls && segmentTimeline && segmentTimeline.length > 0) {
    segmentUrls = generateSegmentUrls(segmentTemplate.media, segmentTimeline, baseUrl, segmentTemplate.startNumber);
  }

  const representation = {
    id,
    type,
    bandwidth,
    bitrate: bandwidth,
  };

  // Add video-specific properties
  if (type === 'video' && width && height) {
    representation.width = width;
    representation.height = height;
    representation.resolution = `${width}x${height}`;
  }

  // Add audio-specific properties
  if (type === 'audio') {
    representation.audioSamplingRate = audioSamplingRate;
    representation.lang = lang;
  }

  // Add segment info
  if (segmentTemplate) {
    representation.segmentTemplate = segmentTemplate;
    representation.segmentDuration = calculateSegmentDuration(segmentTemplate, segmentTimeline);
  }

  if (segmentTimeline && segmentTimeline.length > 0) {
    representation.segmentTimeline = segmentTimeline;
    representation.segmentUrls = segmentUrls;
    representation.totalSegments = segmentTimeline.length;
  }

  return representation;
}

/**
 * Parse SegmentTemplate element
 * @private
 */
function parseSegmentTemplate(element) {
  const segmentTemplate = element.getElementsByTagName('SegmentTemplate')[0];
  if (!segmentTemplate) {
    return null;
  }

  return {
    media: segmentTemplate.getAttribute('media'),
    initialization: segmentTemplate.getAttribute('initialization'),
    timescale: parseInt(segmentTemplate.getAttribute('timescale'), 10) || 1000,
    duration: parseInt(segmentTemplate.getAttribute('duration'), 10),
    startNumber: parseInt(segmentTemplate.getAttribute('startNumber'), 10) || 0,
  };
}

/**
 * Parse SegmentTimeline element
 * @private
 */
function parseSegmentTimeline(element) {
  const segmentTimeline = element.getElementsByTagName('SegmentTimeline')[0];
  if (!segmentTimeline) {
    return null;
  }

  const segments = [];
  const sElements = segmentTimeline.getElementsByTagName('S');

  for (let i = 0; i < sElements.length; i++) {
    const s = sElements[i];
    const d = parseInt(s.getAttribute('d'), 10);
    const t = s.getAttribute('t') ? parseInt(s.getAttribute('t'), 10) : null;
    const r = s.getAttribute('r') ? parseInt(s.getAttribute('r'), 10) : 0;

    // Handle repeat attribute
    for (let rep = 0; rep <= r; rep++) {
      segments.push({ d, t });
    }
  }

  return segments;
}

/**
 * Calculate segment duration in seconds
 * @private
 */
function calculateSegmentDuration(segmentTemplate, segmentTimeline) {
  if (!segmentTemplate) return 0;

  if (segmentTimeline && segmentTimeline.length > 0) {
    return segmentTimeline[0].d / segmentTemplate.timescale;
  }

  if (segmentTemplate.duration && segmentTemplate.timescale) {
    return segmentTemplate.duration / segmentTemplate.timescale;
  }

  return 0;
}

/**
 * Generate segment URLs from template
 * @private
 */
function generateSegmentUrls(mediaTemplate, segmentTimeline, baseUrl, startNumber = 0) {
  const urls = [];

  if (!mediaTemplate || !segmentTimeline) {
    return urls;
  }

  for (let i = 0; i < segmentTimeline.length; i++) {
    const segmentNumber = startNumber + i;
    const url = mediaTemplate.replace('$Number$', segmentNumber);
    const resolvedUrl = resolveUrl(url, baseUrl);
    urls.push(resolvedUrl);
  }

  return urls;
}

/**
 * Parse ISO 8601 duration format (e.g., PT1H2M3S = 3723 seconds)
 * @private
 */
function parseDurationISO8601(duration) {
  if (!duration) return 0;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;

  const hours = (parseInt(match[1], 10) || 0) * 3600;
  const minutes = (parseInt(match[2], 10) || 0) * 60;
  const seconds = parseFloat(match[3]) || 0;

  return hours + minutes + seconds;
}

/**
 * Resolve relative URL against base URL
 * @private
 */
function resolveUrl(url, baseUrl) {
  if (!url) return baseUrl;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  try {
    return new URL(url, baseUrl).href;
  } catch (error) {
    return url;
  }
}

/**
 * Select representation by quality preference
 * @param {Array} representations - Array of representations
 * @param {string|number} preference - 'low', 'medium', 'high', or specific bitrate in bps
 * @returns {Object} Selected representation
 */
export function selectQuality(representations, preference = 'high') {
  if (!representations || representations.length === 0) {
    return null;
  }

  const videoReps = representations.filter(r => r.type === 'video');
  if (videoReps.length === 0 && representations.length > 0) {
    // No video, return first available
    return representations[0];
  }

  const sorted = [...videoReps].sort((a, b) => a.bitrate - b.bitrate);

  // Handle numeric bitrate preference
  if (typeof preference === 'number') {
    // Find closest bitrate
    let closest = sorted[0];
    let minDiff = Math.abs(closest.bitrate - preference);
    for (const rep of sorted) {
      const diff = Math.abs(rep.bitrate - preference);
      if (diff < minDiff) {
        minDiff = diff;
        closest = rep;
      }
    }
    return closest;
  }

  // Handle string preference
  if (preference === 'low') {
    return sorted[0];
  } else if (preference === 'medium') {
    return sorted[Math.floor(sorted.length / 2)];
  } else {
    // high (default)
    return sorted[sorted.length - 1];
  }
}

/**
 * Get list of available resolutions
 * @param {Array} representations - Array of representations
 * @returns {Array} List of unique resolutions
 */
export function getAvailableResolutions(representations) {
  const resolutions = representations
    .filter(r => r.type === 'video' && r.resolution)
    .map(r => r.resolution);

  return [...new Set(resolutions)];
}

/**
 * Get list of available bitrates
 * @param {Array} representations - Array of representations
 * @returns {Array} List of unique bitrates in ascending order
 */
export function getAvailableBitrates(representations) {
  const bitrates = representations
    .map(r => r.bitrate)
    .filter(b => b > 0);

  return [...new Set(bitrates)].sort((a, b) => a - b);
}

/**
 * Get total duration
 * @param {Object} parsedManifest - Result from parseDALE
 * @returns {number} Total duration in seconds
 */
export function getTotalDuration(parsedManifest) {
  return parsedManifest.mediaDuration || 0;
}

/**
 * Clear manifest cache
 * Useful for memory management or forced refresh
 */
export function clearManifestCache() {
  manifestCache.clear();
}

/**
 * Check if manifest is live (dynamic)
 * @param {Object} parsedManifest - Result from parseDALE
 * @returns {boolean} True if live stream
 */
export function isLiveStream(parsedManifest) {
  return parsedManifest.isLive || false;
}

/**
 * Get codec information from representations
 * @param {Array} representations - Array of representations
 * @returns {Array} List of unique codec strings
 */
export function getAvailableCodecs(representations) {
  const codecs = representations
    .map(r => r.codecs)
    .filter(c => c)
    .map(c => c.split(','));

  return [...new Set(codecs.flat())];
}
