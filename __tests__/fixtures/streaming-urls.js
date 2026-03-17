/**
 * Test fixtures for streaming platform URLs
 * Real-world examples of YouTube and Vimeo URLs
 */

// YouTube videos use googlevideo.com for streaming URLs
// These are realistic URLs that come from actual YouTube video playback
const YOUTUBE_FIXTURES = {
  // Typical YouTube googlevideo.com URL with video playback parameters
  basicPlayback: {
    url: 'https://r1---sn-5hne6nzs.googlevideo.com/videoplayback?expire=1710547200&ei=abc123&ip=192.168.1.1&id=xyz789&itag=18&source=youtube&requiressl=yes&mh=AB&mm=31&mn=sn-5hne6nzs&ms=sqd&mv=m&mvi=1&pl=24',
    type: 'stream',
    detectionMethod: 'pattern',
  },
  // YouTube URL with just the domain (minimal)
  minimal: {
    url: 'https://googlevideo.com/videoplayback',
    type: 'stream',
    detectionMethod: 'pattern',
  },
  // YouTube URL with variant subdomain
  variantSubdomain: {
    url: 'https://r5---sn-p5qlsn7r.googlevideo.com/videoplayback?id=test&itag=22',
    type: 'stream',
    detectionMethod: 'pattern',
  },
  // YouTube with fragment
  withFragment: {
    url: 'https://r1---sn-5hne6nzs.googlevideo.com/videoplayback#t=10',
    type: 'stream',
    detectionMethod: 'pattern',
  },
  // YouTube URL with extension (shouldn't happen but test anyway)
  withExtension: {
    url: 'https://googlevideo.com/videoplayback.mp4?itag=18',
    type: 'video', // extension takes priority in detection order
    detectionMethod: 'extension',
  },
};

// Vimeo uses vimeo.com/video/ and player.vimeo.com for streaming
const VIMEO_FIXTURES = {
  // Vimeo video URL pattern
  vimeoVideoBasic: {
    url: 'https://vimeo.com/video/123456789',
    type: 'stream',
    detectionMethod: 'pattern',
  },
  // Vimeo video with path
  vimeoVideoWithPath: {
    url: 'https://vimeo.com/video/987654321/config',
    type: 'stream',
    detectionMethod: 'pattern',
  },
  // Vimeo player URL
  vimeoPlayerBasic: {
    url: 'https://player.vimeo.com/video/555666777',
    type: 'stream',
    detectionMethod: 'pattern',
  },
  // Vimeo player with external content
  vimeoPlayerExternal: {
    url: 'https://player.vimeo.com/external/111222333.mp4',
    type: 'video', // extension takes priority
    detectionMethod: 'extension',
  },
  // Vimeo player with auth token
  vimeoPlayerWithAuth: {
    url: 'https://player.vimeo.com/video/444555666?token=abc123&auth=xyz789',
    type: 'stream',
    detectionMethod: 'pattern',
  },
};

// Content-Type fixtures for streaming URLs without extension or pattern
const CONTENT_TYPE_FIXTURES = {
  // Streaming URL that matches none of our patterns but has video Content-Type
  unknownStreamingURL: {
    url: 'https://streaming.example.com/stream/abc123/segment',
    contentType: 'video/mp4',
    type: 'stream',
    detectionMethod: 'content-type',
  },
  // CDN URL with multiple parameters
  cdnURL: {
    url: 'https://cdn.streaming-platform.com/video?id=abc&quality=hd&auth=token123',
    contentType: 'video/mp4; charset=utf-8',
    type: 'stream',
    detectionMethod: 'content-type',
  },
  // Streaming URL without extension
  unknownDomain: {
    url: 'https://xyz123stream.example.org/media/video/playback',
    contentType: 'video/webm',
    type: 'stream',
    detectionMethod: 'content-type',
  },
  // Audio streaming
  audioStream: {
    url: 'https://audio.streaming.com/track/12345',
    contentType: 'audio/mpeg',
    type: 'audio',
    detectionMethod: 'content-type',
  },
};

// Combined fixtures: same URL detected via different methods
// Used to test deduplication and priority
const DEDUPLICATION_FIXTURES = {
  // A URL that would match pattern but has .mp4 extension (extension takes priority)
  youtubeWithExtension: {
    url: 'https://googlevideo.com/videoplayback.mp4?token=123&id=abc',
    detectionMethods: ['extension', 'pattern'],
    type: 'video',
    primaryMethod: 'extension',
  },
  // A URL that matches pattern and has content-type (pattern takes priority over content-type)
  vimeoWithContentType: {
    url: 'https://vimeo.com/video/123456',
    detectionMethods: ['pattern', 'content-type'],
    contentType: 'video/mp4',
    type: 'stream',
    primaryMethod: 'pattern',
  },
  // A URL that matches all three detection methods (extension > pattern > content-type)
  allThreeMethods: {
    url: 'https://googlevideo.com/videoplayback.mp4',
    detectionMethods: ['extension', 'pattern', 'content-type'],
    contentType: 'video/mp4',
    type: 'video',
    primaryMethod: 'extension',
  },
};

module.exports = {
  YOUTUBE_FIXTURES,
  VIMEO_FIXTURES,
  CONTENT_TYPE_FIXTURES,
  DEDUPLICATION_FIXTURES,
};
